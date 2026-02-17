import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
}

const Withdraw = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [bankRes, walletRes] = await Promise.all([
        supabase.from("bank_accounts").select("id, bank_name, account_number").eq("user_id", user.id),
        supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      ]);
      setBankAccounts((bankRes.data as BankAccount[]) || []);
      setBalance(walletRes.data?.balance ? Number(walletRes.data.balance) : 0);
      setDataLoading(false);
    };
    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > balance) { toast.error("Insufficient balance"); return; }
    if (!bankAccountId) { toast.error("Select a bank account"); return; }
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user.id, amount: amt, bank_account_id: bankAccountId,
    });

    if (!error) {
      await supabase.from("transactions").insert({
        user_id: user.id, type: "withdrawal" as const, amount: amt, status: "pending" as const,
        description: "Withdrawal request",
      });
    }

    setLoading(false);
    if (error) { toast.error("Failed to submit withdrawal request"); } else { setSubmitted(true); }
  };

  if (dataLoading) return <div className="max-w-lg mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>;

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <Card className="shadow-card border-border/50 text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <CardTitle className="font-heading">Withdrawal Request Submitted</CardTitle>
            <p className="text-muted-foreground">Your withdrawal of <strong>${parseFloat(amount).toFixed(2)}</strong> is pending admin approval.</p>
            <Button onClick={() => { setSubmitted(false); setAmount(""); }} variant="outline">Make Another Withdrawal</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Withdraw Funds</h1>
      <p className="text-muted-foreground mb-6">Available balance: <strong className="text-foreground">${balance.toFixed(2)}</strong></p>

      {bankAccounts.length === 0 ? (
        <Card className="shadow-card border-border/50 text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <AlertCircle className="w-10 h-10 text-warning mx-auto" />
            <p className="text-muted-foreground">You need to add a bank account before making a withdrawal.</p>
            <Link to="/settings"><Button variant="outline">Add Bank Account</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card border-border/50">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-lg font-heading">New Withdrawal</CardTitle>
              <CardDescription>Funds will be sent after admin approval</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Bank Account</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((ba) => (
                      <SelectItem key={ba.id} value={ba.id}>{ba.bank_name} - ****{ba.account_number.slice(-4)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                  <Input id="amount" type="number" min="1" max={balance} step="0.01" placeholder="0.00" className="pl-7 text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground" size="lg" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Request Withdrawal
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
};

export default Withdraw;
