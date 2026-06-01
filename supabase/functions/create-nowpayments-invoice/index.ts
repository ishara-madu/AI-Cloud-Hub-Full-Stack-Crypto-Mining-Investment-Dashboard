import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Initialize Supabase client with user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user session" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request body (read once)
    const body = await req.json();
    const { amount, pay_currency, action } = body;

    // 3. Initialize Admin Supabase Client to read secure settings & write transaction records
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "nowpayments_settings")
      .maybeSingle();

    if (settingsError || !settingsData?.value) {
      return new Response(
        JSON.stringify({ error: "Cryptocurrency configuration not found on server" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { enabled } = settingsData.value as { enabled: boolean };
    
    // Check if the method is enabled
    if (!enabled) {
      return new Response(
        JSON.stringify({ error: "Cryptocurrency payments are currently disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use environment variable secret (Supabase Secret)
    const apiKey = Deno.env.get("NOWPAYMENTS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Cryptocurrency API Key is not configured on the server" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payCurrency = pay_currency || "usdttrc20";

    // --- ACTION: GET MINIMUM AMOUNT ---
    if (action === "get_min_amount") {
      // 1. Fetch live LKR/USD exchange rate
      let rateUsed = 300.0;
      try {
        const exchangeRes = await fetch("https://open.er-api.com/v6/latest/USD");
        if (exchangeRes.ok) {
          const rateData = await exchangeRes.json();
          rateUsed = rateData.rates?.LKR || 300.0;
        }
      } catch (e) {
        console.error("Exchange rate api fetch failed:", e);
      }

      // 2. Query NOWPayments min-amount
      const minAmountRes = await fetch(
        `https://api.nowpayments.io/v1/min-amount?currency_from=${payCurrency}&currency_to=${payCurrency}&fiat_equivalent=usd`,
        {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!minAmountRes.ok) {
        const errText = await minAmountRes.text();
        console.error("NOWPayments min-amount API error:", minAmountRes.status, errText);
        return new Response(
          JSON.stringify({ error: `Cryptocurrency API returned error: ${minAmountRes.statusText}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const minAmountData = await minAmountRes.json();
      const minAmount = minAmountData.min_amount;
      const fiatEquivalent = minAmountData.fiat_equivalent || minAmount;

      // Convert USD fiat equivalent to Rupees
      const rsEquivalent = parseFloat((fiatEquivalent * rateUsed).toFixed(2));

      return new Response(
        JSON.stringify({
          min_amount: minAmount,
          fiat_equivalent: fiatEquivalent,
          rs_equivalent: rsEquivalent,
          exchange_rate: rateUsed,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- ACTION: CREATE PAYMENT ---
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 500) {
      return new Response(JSON.stringify({ error: "Minimum deposit is Rs 500" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create a pending record in deposit_requests
    const { data: depositRequest, error: depositError } = await supabaseAdmin
      .from("deposit_requests")
      .insert({
        user_id: user.id,
        amount: parsedAmount,
        payment_method: "crypto_nowpayments",
        status: "pending",
        notes: `Crypto payment initiated via Cryptocurrency: ${payCurrency.toUpperCase()}`,
      })
      .select("id")
      .single();

    if (depositError || !depositRequest) {
      console.error("Failed to insert deposit request:", depositError);
      return new Response(
        JSON.stringify({ error: "Failed to initialize deposit request record" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create a pending transaction record
    const { error: txnError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "deposit",
        amount: parsedAmount,
        status: "pending",
        description: `Crypto Deposit (${payCurrency.toUpperCase()}) request via Cryptocurrency`,
        reference_id: depositRequest.id,
      });

    if (txnError) {
      console.error("Failed to log transaction:", txnError);
    }

    // 6. Fetch real-time exchange rates (convert LKR/Rs to USD)
    let usdAmount = parsedAmount;
    let rateUsed = 300.0; // fallback LKR to USD conversion rate
    try {
      const exchangeRes = await fetch("https://open.er-api.com/v6/latest/USD");
      if (exchangeRes.ok) {
        const rateData = await exchangeRes.json();
        const lkrRate = rateData.rates?.LKR || 300.0;
        rateUsed = lkrRate;
        usdAmount = parsedAmount / lkrRate;
      }
    } catch (e) {
      console.error("Exchange rate api fetch failed, using fallback:", e);
      usdAmount = parsedAmount / 300.0;
    }

    // Format to 2 decimal places
    const finalUsdAmount = parseFloat(usdAmount.toFixed(2));
    
    // 7. Call NOWPayments API to create payment
    const nowpaymentsRes = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: finalUsdAmount,
        price_currency: "usd",
        pay_currency: payCurrency,
        order_id: depositRequest.id,
        order_description: `Wallet Deposit - Rs ${parsedAmount.toLocaleString()}`,
      }),
    });

    if (!nowpaymentsRes.ok) {
      const errorText = await nowpaymentsRes.text();
      console.error("NOWPayments API error details:", nowpaymentsRes.status, errorText);
      
      let clientErrorMessage = `Cryptocurrency API error: ${nowpaymentsRes.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.code === "AMOUNT_MINIMAL_ERROR" || (errorJson.message && errorJson.message.includes("less than minimal"))) {
          clientErrorMessage = `The deposit amount is below the minimum limit for ${payCurrency.toUpperCase()}. Please try a larger amount.`;
        } else if (errorJson.message) {
          clientErrorMessage = errorJson.message;
        }
      } catch (e) {
        // Fallback
      }

      return new Response(
        JSON.stringify({ error: clientErrorMessage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nowpaymentsData = await nowpaymentsRes.json();
    const payAddress = nowpaymentsData.pay_address;
    const payAmount = nowpaymentsData.pay_amount;

    if (!payAddress) {
      console.error("NOWPayments response missing pay_address:", nowpaymentsData);
      return new Response(
        JSON.stringify({ error: "Failed to generate payment address from gateway" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare JSON metadata to store in database notes
    const paymentDetails = {
      pay_address: payAddress,
      pay_amount: payAmount,
      pay_currency: nowpaymentsData.pay_currency || payCurrency,
      payment_id: nowpaymentsData.payment_id,
      usd_amount: finalUsdAmount,
      exchange_rate: rateUsed,
    };

    // Update the pending deposit request with JSON-encoded notes
    const { error: updateNotesError } = await supabaseAdmin
      .from("deposit_requests")
      .update({
        notes: JSON.stringify(paymentDetails),
      })
      .eq("id", depositRequest.id);

    if (updateNotesError) {
      console.error("Failed to update deposit notes with crypto details:", updateNotesError);
    }

    return new Response(
      JSON.stringify({
        id: depositRequest.id,
        pay_address: payAddress,
        pay_amount: payAmount,
        pay_currency: nowpaymentsData.pay_currency || payCurrency,
        payment_id: nowpaymentsData.payment_id,
        usd_amount: finalUsdAmount,
        exchange_rate: rateUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("NOWPayments payment creation internal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
