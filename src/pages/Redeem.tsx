import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Redeem = () => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [creditScore, setCreditScore] = useState(100);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("credit_score").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCreditScore(data?.credit_score ?? 100));
  }, [user]);

  const handleRedeem = async () => {
    if (!code.trim()) { toast.error("Please enter a promo code"); return; }
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase.rpc("redeem_promo_code", { p_code: code.trim() });

    if (error) {
      toast.error("Failed to redeem code. Please try again.");
      setLoading(false);
      setCode("");
      return;
    }

    const result = data as any;
    if (!result?.success) {
      toast.error(result?.error || "Failed to redeem code");
      setLoading(false);
      setCode("");
      return;
    }

    const actualReward = result.reward;
    const cs = result.credit_score;
    toast.success(`Rs ${Number(actualReward).toLocaleString()} added to your wallet!${cs < 100 ? ` (${cs}% credit score applied)` : ""}`);
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
