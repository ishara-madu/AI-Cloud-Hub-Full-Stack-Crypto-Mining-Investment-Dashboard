import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, AlertCircle, Package, Edit3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

const Withdraw = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [hasBankDetails, setHasBankDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [hasActivePackage, setHasActivePackage] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const hasMinDeposit = totalDeposited >= 500;

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [walletRes, bankRes, pkgRes, profileRes] = await Promise.all([
        supabase.from("wallets").select("balance, total_deposited").eq("user_id", user.id).maybeSingle(),
        supabase.from("bank_accounts").select("id, bank_name, account_number").eq("user_id", user.id).eq("is_default", true).maybeSingle(),
        supabase.from("user_packages").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
        supabase.from("profiles").select("is_frozen").eq("user_id", user.id).maybeSingle(),
      ]);
      setBalance(walletRes.data?.balance ? Number(walletRes.data.balance) : 0);
      setTotalDeposited(walletRes.data?.total_deposited ? Number(walletRes.data.total_deposited) : 0);
      if (bankRes.data) {
        setBankName(bankRes.data.bank_name || "");
        setAccountNumber(bankRes.data.account_number || "");
        setBankAccountId(bankRes.data.id || null);
        setHasBankDetails(true);
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
    if (!hasActivePackage) { toast.error("You need an active package to withdraw."); return; }
    if (!hasMinDeposit) { toast.error("You must deposit at least Rs 500 before withdrawing."); return; }
    if (!hasBankDetails) { toast.error("Please save your bank details first."); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < 1000) { toast.error("Minimum withdrawal: Rs 1,000"); return; }
    if (amt > balance) { toast.error("Insufficient balance"); return; }
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase.rpc("submit_withdrawal", {
      p_amount: amt,
      p_bank_account_id: bankAccountId,
    });

    setLoading(false);
    if (error || (data && !(data as any).success)) {
      toast.error((data as any)?.error || "Failed to submit withdrawal");
    } else {
      setSubmitted(true);
    }
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
      <div className="px-4 py-4 flex items-center gap-3">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-heading font-bold text-foreground">Withdraw</h1>
      </div>

      <div className="px-4 space-y-5 pb-8">
        {isFrozen && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">Your account is frozen. Withdrawals are disabled.</p>
          </div>
        )}

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

        {!hasMinDeposit && !isFrozen && hasActivePackage && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
            <div>
              <p className="text-sm text-yellow-600 font-medium">Minimum deposit required</p>
              <p className="text-xs text-muted-foreground">You must deposit at least Rs 500 before making a withdrawal. Current deposits: Rs {totalDeposited.toLocaleString()}.</p>
              <Link to="/deposit" className="text-xs text-primary font-semibold underline">Make a Deposit</Link>
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
          {/* Bank Details (read-only, auto-filled) */}
          <div className="shadow-neu rounded-2xl bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-heading font-bold text-foreground">Bank Account Details</h3>
              <Link to="/bank-info" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                <Edit3 className="w-3 h-3" /> Edit
              </Link>
            </div>
            {hasBankDetails ? (
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-medium text-foreground">{bankName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Account Number</span>
                  <span className="font-medium text-foreground">{accountNumber}</span>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center space-y-2">
                <p className="text-xs text-yellow-600 font-medium">No bank details saved</p>
                <Link to="/bank-info">
                  <Button size="sm" variant="outline" className="rounded-xl text-xs">
                    Add Bank Details
                  </Button>
                </Link>
              </div>
            )}
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
          </div>

          {/* Fee info */}
          <div className="text-xs text-muted-foreground space-y-1 px-1">
            <p>Handling fee: 5%{fee > 0 && <span className="text-foreground font-medium"> (Rs {fee.toFixed(2)})</span>}</p>
            <p>Minimum withdrawal: Rs 1,000</p>
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl h-12 font-semibold text-base text-destructive-foreground"
            style={{ background: "linear-gradient(135deg, hsl(0 72% 51%), hsl(340 82% 52%))" }}
            disabled={loading || isFrozen || !hasActivePackage || !hasBankDetails || !hasMinDeposit}
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
