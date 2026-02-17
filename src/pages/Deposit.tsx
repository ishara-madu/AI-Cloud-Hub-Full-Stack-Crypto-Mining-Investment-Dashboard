import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CreditCard, Bitcoin, Building2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const paymentMethods = [
  { value: "bank_transfer" as const, label: "Bank Transfer", icon: Building2, desc: "1-3 business days" },
  { value: "crypto" as const, label: "Crypto", icon: Bitcoin, desc: "Instant confirmation" },
  { value: "credit_card" as const, label: "Credit Card", icon: CreditCard, desc: "Processed manually" },
];

const Deposit = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank_transfer" | "crypto" | "credit_card">("bank_transfer");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > 100000) { toast.error("Maximum deposit is $100,000"); return; }
    if (!user) return;
    setLoading(true);

    const { error: depErr } = await supabase.from("deposit_requests").insert({
      user_id: user.id, amount: amt, payment_method: method,
    });

    if (!depErr) {
      await supabase.from("transactions").insert({
        user_id: user.id, type: "deposit" as const, amount: amt, status: "pending" as const,
        description: `Deposit via ${method.replace("_", " ")}`,
      });
    }

    setLoading(false);
    if (depErr) { toast.error("Failed to submit deposit request"); } else { setSubmitted(true); }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <Card className="shadow-card border-border/50 text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <CardTitle className="font-heading">Deposit Request Submitted</CardTitle>
            <p className="text-muted-foreground">Your deposit of <strong>${parseFloat(amount).toFixed(2)}</strong> is pending admin approval.</p>
            <Button onClick={() => { setSubmitted(false); setAmount(""); }} variant="outline">Make Another Deposit</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-6">Deposit Funds</h1>
      <Card className="shadow-card border-border/50">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-lg font-heading">New Deposit</CardTitle>
            <CardDescription>Select a payment method and enter the amount</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {paymentMethods.map((pm) => (
                  <button
                    key={pm.value}
                    type="button"
                    onClick={() => setMethod(pm.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      method === pm.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    )}
                  >
                    <pm.icon className={cn("w-6 h-6", method === pm.value ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-medium">{pm.label}</span>
                    <span className="text-xs text-muted-foreground">{pm.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input id="amount" type="number" min="1" max="100000" step="0.01" placeholder="0.00" className="pl-7 text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground" size="lg" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Deposit Request
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Deposit;
