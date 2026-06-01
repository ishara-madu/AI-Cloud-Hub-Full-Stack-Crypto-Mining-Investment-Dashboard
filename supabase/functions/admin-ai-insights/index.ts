import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { stats, userGrowth, packageStats, recentTransactions } =
      await req.json();

    // 1. Google Gemini API Key එක ගන්නවා
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const promptText = `You are an AI business analyst for a financial platform. Analyze this data and provide insights:

    **Platform Stats:**
    - Total Users: ${stats.totalUsers}
    - Platform Balance: Rs ${stats.totalBalance}
    - Total Deposited: Rs ${stats.totalDeposited}
    - Total Withdrawn: Rs ${stats.totalWithdrawn}
    - Total Commission: Rs ${stats.totalCommission}
    - Active Packages: ${stats.activePackages}
    - Today's New Users: ${stats.todayNewUsers}
    - Today's Deposits: Rs ${stats.todayDeposits}
    - Today's Withdrawals: Rs ${stats.todayWithdrawals}
    - Pending Deposits: ${stats.pendingDepositsCount}
    - Pending Withdrawals: ${stats.pendingWithdrawalsCount}

    **User Growth (last 7 days):** ${JSON.stringify(userGrowth)}

    **Package Revenue:** ${JSON.stringify(packageStats)}

    **Recent Transactions:** ${JSON.stringify(recentTransactions)}

    IMPORTANT: You must write the ENTIRE response in the Sinhala language. Use professional and clear Sinhala suitable for a business report.
        IMPORTANT FORMATTING RULE: Add a clear double line break (empty blank line) between each main section and every bullet point to ensure maximum line spacing and readability.

        Provide:
        1. 📈 **ආදායම් පුරෝකථනය** - Estimated next day income based on trends
        2. 🎯 **ප්‍රධාන නිරීක්ෂණ** - 3 actionable insights about user behavior & revenue
        3. ⚠️ **අවදානම් පිළිබඳ ඇඟවීම්** - Any concerning patterns (withdrawal/deposit ratio, frozen accounts, etc.)
        4. 💡 **යෝජනා** - 2-3 specific actions to improve platform performance

        Keep it concise and actionable. Use emojis for clarity. Format with markdown.`;

    // 2. Google Gemini API එකට Request එක යවනවා
    // මෙතන පාවිච්චි කරලා තියෙන්නේ gemini-1.5-flash මොඩල් එක (ගොඩක් වේගවත් සහ ලාබදායකයි)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const text = await response.text();
      console.error("Gemini API error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();

    // 3. Gemini API එකෙන් එන response එකේ විදියටම text එක එළියට ගන්නවා
    const insight =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No insights generated.";

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
