import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, Package, Users, Gift, CalendarCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
}

const typeIcon = (type: string, description: string | null) => {
  if (type === "commission" && description?.toLowerCase().includes("daily package")) return <Package className="w-4 h-4 text-primary" />;
  if (type === "commission") return <Users className="w-4 h-4 text-success" />;
  if (type === "refund") return <Gift className="w-4 h-4 text-primary" />;
  return <TrendingUp className="w-4 h-4 text-muted-foreground" />;
};

const typeLabel = (type: string, description: string | null) => {
  if (type === "commission" && description?.toLowerCase().includes("daily package")) return "Package Income";
  if (type === "commission") return "Referral Commission";
  if (type === "refund") return "Cashback";
  return "Earned";
};

const EarnedHistory = () => {
  const { user } = useAuth();
  const [todayTx, setTodayTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayTotal, setTodayTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchTodayEarned = async () => {
      // Use Sri Lanka timezone (UTC+5:30) for "today" boundary
      const sriLankaOffsetMs = 5.5 * 60 * 60 * 1000;
      const sriLankaNow = new Date(Date.now() + sriLankaOffsetMs);
      const sriLankaMidnight = new Date(Date.UTC(
        sriLankaNow.getUTCFullYear(),
        sriLankaNow.getUTCMonth(),
        sriLankaNow.getUTCDate(),
        0, 0, 0, 0
      ));
      const todayStart = new Date(sriLankaMidnight.getTime() - sriLankaOffsetMs);

      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .in("type", ["commission", "refund"])
        .eq("status", "approved")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false });

      const rows = (data || []) as Transaction[];
      setTodayTx(rows);
      setTodayTotal(rows.reduce((s, t) => s + Number(t.amount), 0));
      setLoading(false);
    };
    fetchTodayEarned();
  }, [user]);

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Today's Earnings</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarCheck className="w-3 h-3" />
            {new Date(Date.now() + 5.5 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* Summary card */}
      <div className="gradient-primary rounded-2xl p-5 text-primary-foreground shadow-neu">
        <p className="text-sm opacity-80 mb-1">Total Earned Today</p>
        <p className="text-3xl font-heading font-bold">
          Rs {todayTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        {!loading && (
          <p className="text-xs opacity-70 mt-1">{todayTx.length} transaction{todayTx.length !== 1 ? "s" : ""}</p>
        )}
      </div>

      {/* Transactions list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : todayTx.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
          <p className="text-sm text-muted-foreground">No earnings yet today</p>
          <p className="text-xs text-muted-foreground">Package income, referral commissions and cashback will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todayTx.map((tx) => (
            <div key={tx.id} className="bg-card shadow-neu rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {typeIcon(tx.type, tx.description)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{typeLabel(tx.type, tx.description)}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-[180px]">{tx.description || "—"}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(tx.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-success">+Rs {Number(tx.amount).toLocaleString()}</p>
                <Badge className={cn(
                  "text-[8px] px-1",
                  tx.status === "approved" ? "bg-success/20 text-success border-success/30" : "bg-warning/20 text-warning"
                )}>
                  {tx.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EarnedHistory;
