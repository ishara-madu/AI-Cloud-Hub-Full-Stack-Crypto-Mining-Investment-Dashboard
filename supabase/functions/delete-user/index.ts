import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete related data first — order matters for FK constraints
    await supabaseAdmin.from("notifications").delete().eq("user_id", user_id);
    await supabaseAdmin.from("device_logs").delete().eq("user_id", user_id);
    await supabaseAdmin.from("daily_signins").delete().eq("user_id", user_id);
    // Delete commissions where user earned OR was the source
    await supabaseAdmin.from("commissions").delete().eq("user_id", user_id);
    await supabaseAdmin.from("commissions").delete().eq("from_user_id", user_id);
    await supabaseAdmin.from("referrals").delete().or(`referrer_id.eq.${user_id},referred_id.eq.${user_id}`);
    await supabaseAdmin.from("redeem_code_uses").delete().eq("user_id", user_id);
    await supabaseAdmin.from("user_packages").delete().eq("user_id", user_id);
    await supabaseAdmin.from("transactions").delete().eq("user_id", user_id);
    await supabaseAdmin.from("deposit_requests").delete().eq("user_id", user_id);
    await supabaseAdmin.from("withdrawal_requests").delete().eq("user_id", user_id);
    await supabaseAdmin.from("bank_accounts").delete().eq("user_id", user_id);
    await supabaseAdmin.from("wallets").delete().eq("user_id", user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    // Clear referred_by references before deleting profile
    await supabaseAdmin.from("profiles").update({ referred_by: null }).eq("referred_by", user_id);
    await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

    // Delete auth user (this also invalidates all sessions/tokens)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
