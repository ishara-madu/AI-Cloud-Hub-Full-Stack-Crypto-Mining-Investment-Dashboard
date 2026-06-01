import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, AlertCircle, Package, Edit3, CreditCard, Coins, Check, AlertTriangle } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


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
  const [creditScore, setCreditScore] = useState(100);

  // New fields for withdrawal methods & crypto
  const [activeMethods, setActiveMethods] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState("bank_transfer");
  const [walletAddress, setWalletAddress] = useState("");
  const [cryptoCoin, setCryptoCoin] = useState("USDT TRC20");
  const [pendingWithdrawalSum, setPendingWithdrawalSum] = useState(0);

  const hasMinDeposit = totalDeposited >= 500;
  const feePercent = 5 + ((100 - creditScore) * 0.1);
  const minWithdrawal = 1000 + ((100 - creditScore) * 50);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [walletRes, bankRes, pkgRes, profileRes, pendingRes, methodsRes] = await Promise.all([
        supabase.from("wallets").select("balance, total_deposited").eq("user_id", user.id).maybeSingle(),
        supabase.from("bank_accounts").select("id, bank_name, account_number").eq("user_id", user.id).eq("is_default", true).maybeSingle(),
        supabase.from("user_packages").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
        supabase.from("profiles").select("is_frozen, credit_score").eq("user_id", user.id).maybeSingle(),
        supabase.from("withdrawal_requests").select("amount").eq("user_id", user.id).eq("status", "pending"),
        supabase.from("withdrawal_methods").select("*").eq("is_active", true),
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
      setCreditScore(profileRes.data?.credit_score ?? 100);

      const pendingSum = (pendingRes.data || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
      setPendingWithdrawalSum(pendingSum);

      const methods = methodsRes.data || [];
      setActiveMethods(methods);
      if (methods.length > 0) {
        // Set default to first active method, preferably bank_transfer if available
        const hasBank = methods.some(m => m.id === "bank_transfer");
        setSelectedMethod(hasBank ? "bank_transfer" : methods[0].id);
      }

      setDataLoading(false);
    };
    fetchData();
  }, [user]);

  const availableBalance = Math.max(0, balance - pendingWithdrawalSum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFrozen) { toast.error("Your account is frozen. Contact support."); return; }
    if (!hasActivePackage) { toast.error("You need an active package to withdraw."); return; }
    if (!hasMinDeposit) { toast.error("You must deposit at least Rs 500 before withdrawing."); return; }
    
    if (selectedMethod === "bank_transfer" && !hasBankDetails) {
      toast.error("Please save your bank details first.");
      return;
    }
    if (selectedMethod === "crypto" && (!walletAddress.trim() || !cryptoCoin)) {
      toast.error("Please enter a valid wallet address and select a coin.");
      return;
    }

    const amt = parseFloat(amount);
    if (!amt || amt < minWithdrawal) { toast.error(`Minimum withdrawal: Rs ${minWithdrawal.toLocaleString()}`); return; }
    if (amt > availableBalance) {
      toast.error("Insufficient available balance (pending withdrawals are locked).");
      return;
    }
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase.rpc("submit_withdrawal", {
      p_amount: amt,
      p_method_id: selectedMethod,
      p_bank_account_id: selectedMethod === "bank_transfer" ? bankAccountId : null,
      p_wallet_address: selectedMethod === "crypto" ? walletAddress : null,
      p_crypto_coin: selectedMethod === "crypto" ? cryptoCoin : null,
    });

    setLoading(false);
    if (error || (data && !(data as any).success)) {
      toast.error((data as any)?.error || "Failed to submit withdrawal");
    } else {
      setSubmitted(true);
    }
  };

  if (dataLoading) {
    return <LoadingScreen title="Loading Withdrawal Portal" subtitle="Fetching account balance & active limits..." />;
  }

  if (submitted) {
    return (
      <div className="px-4 py-8 animate-fade-in">
        <div className="shadow-neu rounded-2xl bg-card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground">Withdrawal Submitted</h2>
          <p className="text-sm text-muted-foreground">
            Your withdrawal of <strong>Rs {parseFloat(amount).toFixed(2)}</strong> via{" "}
            {selectedMethod === "crypto" ? "Cryptocurrency" : "Bank Transfer"} is pending approval.
          </p>
          <Button onClick={() => { setSubmitted(false); setAmount(""); setWalletAddress(""); }} variant="outline" className="rounded-xl">Done</Button>
        </div>
      </div>
    );
  }

  const fee = parseFloat(amount) > 0 ? (parseFloat(amount) * feePercent / 100) : 0;

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
        {activeMethods.length === 0 ? (
          <div className="shadow-neu rounded-2xl bg-card p-6 text-center space-y-4 border border-destructive/20 mt-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive animate-pulse shrink-0" />
              <span>System Maintenance Active</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We are currently performing scheduled maintenance on our payout systems. Payout withdrawals are temporarily offline. You can't payout now. Please try again later.
            </p>
            <div className="pt-2">
              <Link to="/dashboard">
                <Button className="rounded-xl w-full font-semibold" variant="outline">
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
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
            <div className="gradient-secondary rounded-2xl p-5 text-secondary-foreground shadow-neu grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs opacity-80">Total Balance</p>
                <p className="text-xl font-heading font-bold mt-1">
                  Rs {balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="border-l border-white/20 pl-4">
                <p className="text-xs opacity-80">Available Balance</p>
                <p className="text-xl font-heading font-bold mt-1 text-primary-foreground">
                  Rs {availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                {pendingWithdrawalSum > 0 && (
                  <p className="text-[10px] opacity-70 mt-1">
                    Locked: Rs {pendingWithdrawalSum.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Withdrawal Method Selection */}
            {activeMethods.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Select Withdrawal Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  {activeMethods.map((method) => {
                    const isSelected = selectedMethod === method.id;
                    const Icon = method.id === "crypto" ? Coins : CreditCard;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedMethod(method.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs font-semibold font-heading">{method.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeMethods.length > 0 && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Bank Transfer Details Form */}
                {selectedMethod === "bank_transfer" && (
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
                )}

                {/* Crypto Payout Details Form */}
                {selectedMethod === "crypto" && (
                  <div className="shadow-neu rounded-2xl bg-card p-5 space-y-4">
                    <h3 className="text-sm font-heading font-bold text-foreground">Crypto Payout Details</h3>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Select Cryptocurrency Coin</Label>
                      <Select value={cryptoCoin} onValueChange={setCryptoCoin}>
                        <SelectTrigger className="rounded-xl h-10 bg-muted/30">
                          <SelectValue placeholder="Select coin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USDT TRC20">USDT (TRC20)</SelectItem>
                          <SelectItem value="TRX">TRON (TRX)</SelectItem>
                          <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                          <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                          <SelectItem value="LTC">Litecoin (LTC)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Wallet Address</Label>
                      <Input
                        placeholder="Enter your public wallet address"
                        className="rounded-xl h-10 bg-muted/30 font-mono text-xs"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        required
                      />
                      <p className="text-[10px] text-muted-foreground leading-normal mt-1 flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
                        <span>Double-check your address! Outgoing crypto transfers cannot be cancelled or refunded if sent to a wrong address.</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Withdrawal Amount */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Withdrawal Amount (Rs)</Label>
                    <Input
                      type="number"
                      min={minWithdrawal}
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
                  <p>Handling fee: {feePercent.toFixed(1)}%{fee > 0 && <span className="text-foreground font-medium"> (Rs {fee.toFixed(2)})</span>}</p>
                  <p>Minimum withdrawal: Rs {minWithdrawal.toLocaleString()}</p>
                  {creditScore < 100 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mt-2">
                      <p className="text-yellow-600 font-medium text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Credit Score Penalty ({creditScore}%)</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Fee increased by {((100 - creditScore) * 0.1).toFixed(1)}% and minimum withdrawal raised by Rs {((100 - creditScore) * 50).toLocaleString()} due to low credit score.
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-xl h-12 font-semibold text-base text-destructive-foreground"
                  style={{ background: "linear-gradient(135deg, hsl(0 72% 51%), hsl(340 82% 52%))" }}
                  disabled={
                    loading ||
                    isFrozen ||
                    !hasActivePackage ||
                    !hasMinDeposit ||
                    (selectedMethod === "bank_transfer" && !hasBankDetails) ||
                    (selectedMethod === "crypto" && !walletAddress.trim())
                  }
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Withdrawal Request
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Withdraw;
