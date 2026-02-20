import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Redeem = () => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [creditScore, setCreditScore] = useState(100);

  // Fetch credit score on mount
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("credit_score").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCreditScore(data?.credit_score ?? 100));
  }, [user]);

  const handleRedeem = async () => {
    if (!code.trim()) { toast.error("Please enter a promo code"); return; }
    if (!user) return;
    setLoading(true);

    // Find the code
    const { data: codeData } = await supabase
      .from("redeem_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (!codeData) {
      toast.error("Invalid or expired promo code. Please try again.");
      setLoading(false);
      setCode("");
      return;
    }

    // Check expiry
    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      toast.error("This promo code has expired.");
      setLoading(false);
      setCode("");
      return;
    }

    // Check max uses
    if (codeData.current_uses >= codeData.max_uses) {
      toast.error("This promo code has reached its usage limit.");
      setLoading(false);
      setCode("");
      return;
    }

    // Check if user already used this code
    const { data: existing } = await supabase
      .from("redeem_code_uses")
      .select("id")
      .eq("code_id", codeData.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      toast.error("You have already used this promo code.");
      setLoading(false);
      setCode("");
      return;
    }

    // Scale reward by credit score
    const baseReward = Number(codeData.reward_amount);
    const scaledReward = Math.round(baseReward * creditScore / 100 * 100) / 100;
    const actualReward = Math.max(scaledReward, 1); // minimum 1

    // Get wallet balance BEFORE update for verification
    const { data: walletBefore } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
    const balBefore = Number(walletBefore?.balance ?? 0);

    // Credit wallet
    const { error: walletError } = await supabase.from("wallets")
      .update({ balance: balBefore + actualReward })
      .eq("user_id", user.id);

    if (walletError) {
      toast.error("Failed to credit wallet. Please try again.");
      setLoading(false);
      return;
    }

    // Verify balance was actually updated
    const { data: walletAfter } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
    const balAfter = Number(walletAfter?.balance ?? 0);

    if (Math.abs(balAfter - (balBefore + actualReward)) > 0.01) {
      // Balance mismatch - log alert for admin
      await supabase.from("admin_alerts").insert({
        alert_type: "integrity_error",
        severity: "critical",
        title: "⚠️ Balance Mismatch on Redeem Code",
        description: `User redeemed code ${codeData.code}. Before: Rs ${balBefore}, Reward: Rs ${actualReward}, Expected: Rs ${balBefore + actualReward}, Actual: Rs ${balAfter}`,
        related_user_ids: [user.id],
      });
    }

    await supabase.from("redeem_code_uses").insert({ code_id: codeData.id, user_id: user.id });
    await supabase.from("redeem_codes").update({ current_uses: codeData.current_uses + 1 }).eq("id", codeData.id);

    // Create transaction as 'refund' type so it shows in Today's Earnings
    await supabase.from("transactions").insert({
      user_id: user.id, type: "refund" as const, amount: actualReward,
      status: "approved" as const,
      description: `Redeemed promo code: ${codeData.code}${creditScore < 100 ? ` (scaled by ${creditScore}% credit)` : ""}`,
    });

    // Create notification
    await supabase.from("notifications").insert({
      user_id: user.id, type: "promo",
      title: "Promo Code Redeemed!",
      description: `You received Rs ${actualReward.toLocaleString()} from promo code ${codeData.code}.${creditScore < 100 ? ` (Reduced from Rs ${baseReward.toLocaleString()} due to ${creditScore}% credit score)` : ""}`,
    });

    toast.success(`Rs ${actualReward.toLocaleString()} added to your wallet!${creditScore < 100 ? ` (${creditScore}% credit score applied)` : ""}`);
    setCode("");
    setLoading(false);
  };

  return (
    <div className="animate-fade-in px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="w-16 h-16 rounded-full gradient-secondary mx-auto flex items-center justify-center shadow-lg">
          <Gift className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-xl font-heading font-bold text-foreground mt-3">Redeem Code</h1>
        <p className="text-xs text-muted-foreground">Enter your promotional code below</p>
      </div>

      {/* Input */}
      <div className="shadow-neu rounded-2xl bg-card p-6 space-y-5">
        <div className="space-y-2">
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter Promo Code"
              className="rounded-xl h-14 pl-11 text-center text-lg font-heading font-bold shadow-neu-inset bg-muted/30 tracking-widest uppercase"
              maxLength={20}
            />
          </div>
        </div>

        <Button
          onClick={handleRedeem}
          disabled={loading}
          className="w-full rounded-2xl h-14 text-base font-heading font-bold gradient-secondary text-secondary-foreground glow-teal shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
        >
          {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Tag className="w-5 h-5 mr-2" />}
          Redeem
        </Button>
      </div>

      {/* Info */}
      <div className="shadow-neu rounded-2xl bg-card p-4 text-center space-y-1">
        {creditScore < 100 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-2">
            <p className="text-yellow-600 font-medium text-xs">⚠️ Credit Score: {creditScore}%</p>
            <p className="text-[10px] text-muted-foreground mt-1">Your rewards are scaled to {creditScore}% of the original value.</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">📋 Promo codes are case-insensitive and single-use per user.</p>
        <p className="text-[10px] text-muted-foreground">Contact support if you experience any issues.</p>
      </div>
    </div>
  );
};

export default Redeem;