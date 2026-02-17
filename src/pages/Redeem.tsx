import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Gift } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Redeem = () => {
  const [code, setCode] = useState("");
  const [redeemed, setRedeemed] = useState(false);

  const handleRedeem = () => {
    if (!code.trim()) {
      toast.error("Please enter a promo code");
      return;
    }
    // Simulate redemption
    toast.error("Invalid or expired promo code. Please try again.");
    setCode("");
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
          className="w-full rounded-2xl h-14 text-base font-heading font-bold gradient-secondary text-secondary-foreground glow-teal shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Tag className="w-5 h-5 mr-2" />
          Redeem
        </Button>
      </div>

      {/* Info */}
      <div className="shadow-neu rounded-2xl bg-card p-4 text-center space-y-1">
        <p className="text-xs text-muted-foreground">📋 Promo codes are case-insensitive and single-use.</p>
        <p className="text-[10px] text-muted-foreground">Contact support if you experience any issues.</p>
      </div>
    </div>
  );
};

export default Redeem;
