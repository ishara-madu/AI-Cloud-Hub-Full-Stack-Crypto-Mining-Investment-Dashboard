import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";

const VpnGuard = ({ children }: { children: React.ReactNode }) => {
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkVpn = async () => {
      try {
        // First get the user's IP via a public API
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const { ip } = await ipRes.json();

        const { data, error } = await supabase.functions.invoke("check-vpn", {
          body: { ip },
        });

        if (!error && data?.is_vpn) {
          setBlocked(true);
          // Force logout if logged in
          await supabase.auth.signOut();
        }
      } catch (err) {
        // If check fails, allow access (fail-open to not block legitimate users)
        console.error("VPN check failed:", err);
      }
      setChecking(false);
    };

    checkVpn();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-heading font-bold text-foreground">
              VPN Detected
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For security purposes, access to this platform is not allowed while using a VPN, proxy, or hosting network. Please disconnect your VPN and try again.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default VpnGuard;
