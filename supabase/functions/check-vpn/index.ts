import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    // Use ip-api.com (free, no key needed) — includes proxy/VPN/hosting detection
    // The batch endpoint isn't needed; single IP check is fine
    const { ip } = await req.json();

    if (!ip) {
      return new Response(
        JSON.stringify({ is_vpn: false, error: "No IP provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,proxy,hosting,query`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      console.error("ip-api error:", response.status);
      return new Response(
        JSON.stringify({
          is_vpn: false,
          error: "Detection service unavailable",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    // proxy = true means VPN/proxy; hosting = true means datacenter/server IP
    const isVpn = data.proxy === true || data.hosting === true;

    return new Response(JSON.stringify({ is_vpn: isVpn, ip: data.query }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("VPN check error:", error);
    return new Response(
      JSON.stringify({ is_vpn: false, error: "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
