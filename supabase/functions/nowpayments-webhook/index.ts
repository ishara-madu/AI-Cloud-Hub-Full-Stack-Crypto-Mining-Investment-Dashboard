import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-nowpayments-sig",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const receivedSignature = req.headers.get("x-nowpayments-sig");
    if (!receivedSignature) {
      console.error("Missing x-nowpayments-sig header");
      return new Response(
        JSON.stringify({ error: "Missing signature header" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const ipnSecret = Deno.env.get("NOWPAYMENTS_IPN_SECRET");
    if (!ipnSecret) {
      console.error("NOWPAYMENTS_IPN_SECRET environment variable is not set");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const rawBody = await req.text();
    if (!rawBody) {
      console.error("Received empty request body");
      return new Response(JSON.stringify({ error: "Empty body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, any>;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("Failed to parse request JSON:", e);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL FIX: Deeply sort the JSON object alphabetically
    const sortObject = (obj: any): any => {
      if (typeof obj !== "object" || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(sortObject);

      return Object.keys(obj)
        .sort()
        .reduce((result: any, key) => {
          result[key] = sortObject(obj[key]);
          return result;
        }, {});
    };

    const sortedJsonString = JSON.stringify(sortObject(body));

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(ipnSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(sortedJsonString),
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const calculatedSignature = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (calculatedSignature !== receivedSignature) {
      console.error(
        "Signature mismatch. Received:",
        receivedSignature,
        "Calculated:",
        calculatedSignature,
      );
      return new Response(
        JSON.stringify({ error: "Invalid signature verification" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const orderId = body.order_id;
    const paymentStatus = (body.payment_status || "").toLowerCase();

    console.log(
      `IPN verified successfully for order_id: ${orderId}, payment_status: ${paymentStatus}`
    );

    if (!orderId) {
      console.warn("IPN missing order_id. Skipping database processing.");
      return new Response(
        JSON.stringify({ success: true, message: "Missing order_id" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let simulatedPaymentStatus = paymentStatus;
    if (simulatedPaymentStatus === "waiting") {
      console.log(
        "⚠️ TESTING MODE: Changed status from 'waiting' to 'finished'"
      );
      simulatedPaymentStatus = "finished";
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "process_nowpayments_deposit",
      {
        p_deposit_id: orderId,
        p_payment_status: simulatedPaymentStatus,
      }
    );

    if (rpcError) {
      console.error(
        "Error executing database function process_nowpayments_deposit:",
        rpcError
      );
      return new Response(
        JSON.stringify({
          error: "Database fulfillment processing failed",
          details: rpcError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (result && !result.success) {
      console.warn(
        "Fulfillment RPC completed with error status:",
        result.error,
      );
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: result?.status || "updated" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("Unexpected error handling webhook:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
