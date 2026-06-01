import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Clock, Copy, CreditCard, Coins } from "lucide-react";
import { Link } from "react-router-dom";

const statusColor: Record<string, string> = {
  pending_approval: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-500 border-red-500/30",
  pending: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  approved: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
};

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map());
  const [bankMap, setBankMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchWithdrawals = async () => {
    const [wdsRes, profilesRes, bankRes] = await Promise.all([
      supabase.from("withdrawal_requests").select("*, bank_accounts(bank_name, account_number)").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name, phone"),
      supabase.from("bank_accounts").select("user_id, bank_name, account_number, iban"),
    ]);
    setProfileMap(new Map((profilesRes.data || []).map((p: any) => [p.user_id, { name: p.display_name, phone: p.phone }])));
    setBankMap(new Map((bankRes.data || []).map((b: any) => [b.user_id, b])));
    setWithdrawals(wdsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchWithdrawals(); }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const handleApproveWithdrawal = async (id: string) => {
    setProcessing(id);
    try {
      const { data, error } = await supabase.rpc("approve_withdrawal_admin", {
        p_withdrawal_id: id,
      });
      if (error || (data && !(data as any).success)) {
        toast.error((data as any)?.error || error?.message || "Failed to approve withdrawal");
        return;
      }
      toast.success("Withdrawal approved and completed successfully!");
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred during approval");
    } finally {
      setProcessing(null);
      fetchWithdrawals();
    }
  };

  const handleRejectWithdrawal = async (id: string, notes: string = "") => {
    setProcessing(id);
    try {
      const { data, error } = await supabase.rpc("reject_withdrawal_admin", {
        p_withdrawal_id: id,
        p_notes: notes || "Withdrawal rejected by admin",
      });

      if (error || (data && !(data as any).success)) {
        toast.error((data as any)?.error || error?.message || "Failed to reject withdrawal");
      } else {
        toast.success("Withdrawal request rejected successfully");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred during rejection");
    } finally {
      setProcessing(null);
      fetchWithdrawals();
    }
  };

  if (loading) return <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-2xl font-heading font-bold text-foreground">Withdrawal Requests (Pending)</h1>
      </div>

      {withdrawals.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No pending withdrawal requests</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {withdrawals.map((w) => {
          const bank = bankMap.get(w.user_id) || w.bank_accounts;
          const profile = profileMap.get(w.user_id);
          return (
            <Card key={w.id} className="shadow-neu">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold">{profile?.name || "User"}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />{new Date(w.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">Rs {Number(w.amount).toLocaleString()}</p>
                    <Badge className={`text-[9px] ${statusColor[w.status] || "bg-muted"}`}>{w.status}</Badge>
                  </div>
                </div>

                {/* Dynamic method details rendering */}
                {w.method_id === "crypto" ? (
                  <div className="bg-muted/30 rounded-xl p-3 mb-3 space-y-1.5">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-primary" /> Crypto Details
                    </p>
                    <div className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                      <div><span className="text-muted-foreground">Coin: </span><span className="font-semibold text-foreground uppercase">{w.crypto_coin}</span></div>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                      <div className="truncate mr-2"><span className="text-muted-foreground">Address: </span><span className="font-mono text-[11px] text-foreground break-all">{w.wallet_address}</span></div>
                      <button onClick={() => copyToClipboard(w.wallet_address || "")} className="text-primary hover:text-primary/80 shrink-0"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ) : (
                  bank && (
                    <div className="bg-muted/30 rounded-xl p-3 mb-3 space-y-1.5">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-primary" /> Bank Details
                      </p>
                      <div className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                        <div><span className="text-muted-foreground">Bank: </span><span className="font-semibold text-foreground">{bank.bank_name}</span></div>
                        <button onClick={() => copyToClipboard(bank.bank_name || "")} className="text-primary hover:text-primary/80"><Copy className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                        <div><span className="text-muted-foreground">A/C: </span><span className="font-mono font-bold text-foreground tracking-wide text-sm">{bank.account_number}</span></div>
                        <button onClick={() => copyToClipboard(bank.account_number || "")} className="text-primary hover:text-primary/80"><Copy className="w-3.5 h-3.5" /></button>
                      </div>
                      {bank.iban && (
                        <div className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                          <div><span className="text-muted-foreground">IBAN: </span><span className="font-mono font-bold text-foreground">{bank.iban}</span></div>
                          <button onClick={() => copyToClipboard(bank.iban || "")} className="text-primary hover:text-primary/80"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  )
                )}

                {profile?.phone && (
                  <div className="flex items-center justify-between text-xs bg-muted/20 border border-border/40 rounded-lg px-3 py-1.5 mb-3">
                    <div><span className="text-muted-foreground">User Phone: </span><span className="font-medium text-foreground">{profile.phone}</span></div>
                    <button onClick={() => copyToClipboard(profile.phone || "")} className="text-primary hover:text-primary/80"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                )}

                {w.notes && <p className="text-xs text-muted-foreground mb-3">Note: {w.notes}</p>}
                
                {w.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white" disabled={processing === w.id} onClick={() => handleApproveWithdrawal(w.id)}>
                      <Check className="w-3.5 h-3.5 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 rounded-xl" disabled={processing === w.id} onClick={() => handleRejectWithdrawal(w.id)}>
                      <X className="w-3.5 h-3.5 mr-1" />Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminWithdrawals;
