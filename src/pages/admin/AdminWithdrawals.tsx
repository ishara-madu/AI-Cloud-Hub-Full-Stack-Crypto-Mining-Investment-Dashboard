import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  approved: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-500 border-red-500/30",
};

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map());
  const [bankMap, setBankMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchWithdrawals = async () => {
    const [wdsRes, profilesRes, bankRes] = await Promise.all([
      supabase.from("withdrawal_requests").select("*, bank_accounts(bank_name, account_number)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name, phone"),
      supabase.from("bank_accounts").select("user_id, bank_name, account_number, iban"),
    ]);
    setProfileMap(new Map((profilesRes.data || []).map((p: any) => [p.user_id, { name: p.display_name, phone: p.phone }])));
    setBankMap(new Map((bankRes.data || []).map((b: any) => [b.user_id, b])));
    setWithdrawals(wdsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchWithdrawals(); }, []);

  const handleAction = async (id: string, userId: string, amount: number, action: "approved" | "rejected") => {
    setProcessing(id);
    const { error } = await supabase.from("withdrawal_requests").update({ status: action }).eq("id", id);
    if (error) { toast.error("Failed to update"); setProcessing(null); return; }

    if (action === "approved") {
      const { data: wallet } = await supabase.from("wallets").select("total_withdrawn").eq("user_id", userId).maybeSingle();
      if (wallet) {
        await supabase.from("wallets").update({
          total_withdrawn: Number(wallet.total_withdrawn) + amount,
        }).eq("user_id", userId);
      }
      await supabase.from("transactions").insert({
        user_id: userId, type: "withdrawal", amount, status: "approved",
        description: "Withdrawal approved by admin", reference_id: id,
      });
      await supabase.from("notifications").insert({
        user_id: userId, type: "money",
        title: "Withdrawal Approved ✅",
        description: `Your withdrawal of Rs ${amount.toLocaleString()} has been processed successfully.`,
      });
    } else {
      // Refund the frozen balance back
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
      if (wallet) {
        await supabase.from("wallets").update({
          balance: Number(wallet.balance) + amount,
        }).eq("user_id", userId);
      }
      // Update existing pending withdrawal transaction to rejected
      await supabase.from("transactions").update({ status: "rejected", description: "Withdrawal rejected by admin" })
        .eq("user_id", userId).eq("type", "withdrawal").eq("status", "pending");
      // Fallback: insert if no matching pending transaction found
      const { data: existingTx } = await supabase.from("transactions").select("id").eq("user_id", userId).eq("type", "withdrawal").eq("status", "rejected").limit(1);
      if (!existingTx || existingTx.length === 0) {
        await supabase.from("transactions").insert({
          user_id: userId, type: "withdrawal", amount, status: "rejected",
          description: "Withdrawal rejected by admin",
        });
      }
      await supabase.from("notifications").insert({
        user_id: userId, type: "money",
        title: "Withdrawal Rejected ❌",
        description: `Your withdrawal of Rs ${amount.toLocaleString()} was rejected. The amount has been returned to your wallet.`,
      });
      // Decrease credit score
      const { data: profile } = await supabase.from("profiles").select("credit_score").eq("user_id", userId).maybeSingle();
      if (profile) {
        await supabase.from("profiles").update({ credit_score: Math.max(0, (profile.credit_score || 100) - 10) }).eq("user_id", userId);
      }
    }

    toast.success(`Withdrawal ${action}`);
    setProcessing(null);
    fetchWithdrawals();
  };

  if (loading) return <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-xl font-heading font-bold text-foreground">Withdrawal Requests</h1>
      </div>

      {withdrawals.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No withdrawal requests</p>}

      <div className="space-y-3">
        {withdrawals.map((w) => (
          <Card key={w.id} className="shadow-neu">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold">{profileMap.get(w.user_id)?.name || "User"}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />{new Date(w.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">Rs {Number(w.amount).toLocaleString()}</p>
                  <Badge className={`text-[9px] ${statusColor[w.status]}`}>{w.status}</Badge>
                </div>
              </div>
              {/* User Account Details */}
              {(() => {
                const bank = bankMap.get(w.user_id) || w.bank_accounts;
                const profile = profileMap.get(w.user_id);
                return bank || profile?.phone ? (
                  <div className="bg-muted/30 rounded-xl p-3 mb-2 space-y-1 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground text-[11px]">💳 User Account Details</p>
                    {bank?.bank_name && <p>Bank: <span className="text-foreground">{bank.bank_name}</span></p>}
                    {bank?.account_number && <p>A/C: <span className="text-foreground">{bank.account_number}</span></p>}
                    {bank?.iban && <p>IBAN: <span className="text-foreground">{bank.iban}</span></p>}
                    {profile?.phone && <p>Phone: <span className="text-foreground">{profile.phone}</span></p>}
                  </div>
                ) : null;
              })()}
              {w.notes && <p className="text-xs text-muted-foreground mb-2">Note: {w.notes}</p>}
              {w.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white" disabled={processing === w.id} onClick={() => handleAction(w.id, w.user_id, Number(w.amount), "approved")}>
                    <Check className="w-3 h-3 mr-1" />Deposited
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 rounded-xl" disabled={processing === w.id} onClick={() => handleAction(w.id, w.user_id, Number(w.amount), "rejected")}>
                    <X className="w-3 h-3 mr-1" />Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminWithdrawals;
