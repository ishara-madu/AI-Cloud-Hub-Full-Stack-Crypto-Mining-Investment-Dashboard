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

const AdminDeposits = () => {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchDeposits = async () => {
    const [depsRes, profilesRes] = await Promise.all([
      supabase.from("deposit_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name"),
    ]);
    setProfileMap(new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.display_name])));
    setDeposits(depsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDeposits(); }, []);

  const handleAction = async (id: string, userId: string, amount: number, action: "approved" | "rejected") => {
    setProcessing(id);
    const { error } = await supabase.from("deposit_requests").update({ status: action }).eq("id", id);
    if (error) { toast.error("Failed to update"); setProcessing(null); return; }

    if (action === "approved") {
      // Update wallet balance
      const { data: wallet } = await supabase.from("wallets").select("balance, total_deposited").eq("user_id", userId).maybeSingle();
      if (wallet) {
        await supabase.from("wallets").update({
          balance: Number(wallet.balance) + amount,
          total_deposited: Number(wallet.total_deposited) + amount,
        }).eq("user_id", userId);
      }
      // Create transaction record
      await supabase.from("transactions").insert({
        user_id: userId,
        type: "deposit",
        amount,
        status: "approved",
        description: "Deposit approved by admin",
        reference_id: id,
      });
    }

    toast.success(`Deposit ${action}`);
    setProcessing(null);
    fetchDeposits();
  };

  if (loading) return <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-xl font-heading font-bold text-foreground">Deposit Requests</h1>
      </div>

      {deposits.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No deposit requests</p>}

      <div className="space-y-3">
        {deposits.map((d) => (
          <Card key={d.id} className="shadow-neu">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold">{profileMap.get(d.user_id) || "User"}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />{new Date(d.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">Rs {Number(d.amount).toLocaleString()}</p>
                  <Badge className={`text-[9px] ${statusColor[d.status]}`}>{d.status}</Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                <span>Method: {d.payment_method}</span>
                {d.notes && <span className="ml-3">Note: {d.notes}</span>}
              </div>
              {d.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                    disabled={processing === d.id}
                    onClick={() => handleAction(d.id, d.user_id, Number(d.amount), "approved")}
                  >
                    <Check className="w-3 h-3 mr-1" />Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 rounded-xl"
                    disabled={processing === d.id}
                    onClick={() => handleAction(d.id, d.user_id, Number(d.amount), "rejected")}
                  >
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

export default AdminDeposits;
