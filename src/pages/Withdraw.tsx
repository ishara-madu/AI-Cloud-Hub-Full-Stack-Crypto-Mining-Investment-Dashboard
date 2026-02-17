import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, AlertCircle, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

const Withdraw = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [walletPassword, setWalletPassword] = useState("");
  const [holderName, setHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [hasActivePackage, setHasActivePackage] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [walletRes, bankRes, pkgRes, profileRes] = await Promise.all([
        supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("bank_accounts").select("bank_name, account_number").eq("user_id", user.id).eq("is_default", true).maybeSingle(),
        supabase.from("user_packages").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
        supabase.from("profiles").select("is_frozen").eq("user_id", user.id).maybeSingle(),
      ]);
      setBalance(walletRes.data?.balance ? Number(walletRes.data.balance) : 0);
      if (bankRes.data) {
        setBankName(bankRes.data.bank_name || "");
        setAccountNumber(bankRes.data.account_number || "");
      }
      setHasActivePackage((pkgRes.data || []).length > 0);
      setIsFrozen(profileRes.data?.is_frozen || false);
      setDataLoading(false);
    };
    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFrozen) { toast.error("Your account is frozen. Contact support."); return; }
    if (!hasActivePackage) { toast.error("You need an active package to withdraw. Please purchase a package first."); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < 1000) { toast.error("Minimum withdrawal: Rs 1,000"); return; }
    if (amt > balance) { toast.error("Insufficient balance"); return; }
    if (!accountNumber.trim() || !bankName.trim()) { toast.error("Please enter bank details"); return; }
    if (!user) return;
    setLoading(true);

    // Deduct from wallet balance (freeze)
    const { data: walletData } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
    if (walletData) {
      await supabase.from("wallets").update({ balance: Number(walletData.balance) - amt }).eq("user_id", user.id);
    }

    // Save/update bank account
    const { data: bankData } = await supabase.from("bank_accounts").upsert({
      user_id: user.id, bank_name: bankName.trim(), account_number: accountNumber.trim(),
      is_default: true,
    }, { onConflict: "user_id,account_number" as any }).select("id").single();

    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user.id, amount: amt, bank_account_id: bankData?.id || null,
    });

    if (!error) {
      await supabase.from("transactions").insert({
        user_id: user.id, type: "withdrawal" as const, amount: amt, status: "pending" as const,
        description: "Withdrawal request",
      });
      // Create notification
      await supabase.from("notifications").insert({
        user_id: user.id, type: "money",
        title: "Withdrawal Request Submitted",
        description: `Your withdrawal of Rs ${amt.toLocaleString()} is pending admin approval.`,
      });
    }

    setLoading(false);
    if (error) { toast.error("Failed to submit withdrawal"); } else { setSubmitted(true); }
  };

  if (dataLoading) return <div className="px-4 py-4 space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;

  if (submitted) {
    return (
      <div className="px-4 py-8 animate-fade-in">
        <div className="shadow-neu rounded-2xl bg-card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground">Withdrawal Submitted</h2>
          <p className="text-sm text-muted-foreground">Your withdrawal of <strong>Rs {parseFloat(amount).toFixed(2)}</strong> is pending approval.</p>
          <Button onClick={() => { setSubmitted(false); setAmount(""); }} variant="outline" className="rounded-xl">Done</Button>
        </div>
      </div>
    );
  }

  const fee = parseFloat(amount) > 0 ? (parseFloat(amount) * 0.05) : 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-3">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-heading font-bold text-foreground">Withdraw</h1>
      </div>

      <div className="px-4 space-y-5 pb-8">
        {/* Frozen Account Warning */}
        {isFrozen && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">Your account is frozen. Withdrawals are disabled. Contact support.</p>
          </div>
        )}

        {/* No Package Warning */}
        {!hasActivePackage && !isFrozen && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-3">
            <Package className="w-5 h-5 text-yellow-600 shrink-0" />
            <div>
              <p className="text-sm text-yellow-600 font-medium">Active package required</p>
              <p className="text-xs text-muted-foreground">You must have at least one active package to withdraw.</p>
              <Link to="/packages" className="text-xs text-primary font-semibold underline">Browse Packages</Link>
            </div>
          </div>
        )}

        {/* Balance Display */}
        <div className="gradient-secondary rounded-2xl p-5 text-secondary-foreground shadow-neu">
          <p className="text-sm opacity-80">Current Balance</p>
          <p className="text-3xl font-heading font-bold mt-1">
            Rs {balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Bank Account Bind */}
          <div className="shadow-neu rounded-2xl bg-card p-5 space-y-4">
            <h3 className="text-sm font-heading font-bold text-foreground">Bank Account Details</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Account Holder Name</Label>
                <Input className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bank Name</Label>
                <Input className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Commercial Bank" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Account Number</Label>
                <Input className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Enter account number" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Branch Code</Label>
                <Input className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="e.g. 007" />
              </div>
            </div>
          </div>

          {/* Withdrawal Amount */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Withdrawal Amount (Rs)</Label>
              <Input
                type="number"
                min="1000"
                step="0.01"
                placeholder="0.00"
                className="rounded-xl h-12 text-lg shadow-neu-inset bg-muted/30"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Wallet Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                className="rounded-xl h-12 shadow-neu-inset bg-muted/30"
                value={walletPassword}
                onChange={(e) => setWalletPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Fee info */}
          <div className="text-xs text-muted-foreground space-y-1 px-1">
            <p>Handling fee: 5%{fee > 0 && <span className="text-foreground font-medium"> (Rs {fee.toFixed(2)})</span>}</p>
            <p>Minimum withdrawal: Rs 1,000</p>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full rounded-xl h-12 font-semibold text-base text-destructive-foreground"
            style={{ background: "linear-gradient(135deg, hsl(0 72% 51%), hsl(340 82% 52%))" }}
            disabled={loading || isFrozen || !hasActivePackage}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Submit Withdrawal Request
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Withdraw;
