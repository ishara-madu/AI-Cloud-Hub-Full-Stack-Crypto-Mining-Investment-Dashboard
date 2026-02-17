import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
}

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!user) return;
    const fetchTx = async () => {
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setTransactions((data || []) as Transaction[]);
      setLoading(false);
    };
    fetchTx();
  }, [user]);

  const filtered = activeTab === "all"
    ? transactions
    : activeTab === "earnings"
      ? transactions.filter(t => t.type === "commission" || t.type === "refund")
      : transactions.filter(t => t.type === activeTab);

  const isIncome = (t: string) => t === "deposit" || t === "commission" || t === "refund";
  const statusBadge = (s: string) => {
    if (s === "approved") return "bg-success/10 text-success";
    if (s === "pending") return "bg-warning/10 text-warning";
    return "bg-destructive/10 text-destructive";
  };

  if (loading) return <div className="px-4 py-4 space-y-4"><Skeleton className="h-8 w-32" /><Skeleton className="h-64 rounded-2xl" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4">
        <h1 className="text-lg font-heading font-bold text-foreground mb-4">History</h1>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {["all", "deposit", "withdrawal", "earnings"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                activeTab === tab
                  ? "gradient-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {tab === "all" ? "All" : tab === "deposit" ? "Deposit" : tab === "withdrawal" ? "Withdraw" : "Earnings"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-8">
        {filtered.length === 0 ? (
          <div className="shadow-neu rounded-2xl bg-card p-8 text-center">
            <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tx) => (
              <div key={tx.id} className="shadow-neu rounded-xl bg-card p-3 flex items-center gap-3">
                {/* Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  isIncome(tx.type) ? "bg-success/10" : "bg-destructive/10"
                )}>
                  {isIncome(tx.type)
                    ? <ArrowDownLeft className="w-5 h-5 text-success" />
                    : <ArrowUpRight className="w-5 h-5 text-destructive" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground capitalize truncate">
                    {tx.description || tx.type.replace("_", " ")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                {/* Amount + Status */}
                <div className="text-right flex-shrink-0">
                  <p className={cn(
                    "text-sm font-semibold",
                    isIncome(tx.type) ? "text-success" : "text-destructive"
                  )}>
                    {isIncome(tx.type) ? "+" : "-"}Rs {Math.abs(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <Badge className={cn("text-[9px] px-1.5 py-0", statusBadge(tx.status))}>
                    {tx.status === "approved" ? "Success" : tx.status === "pending" ? "Pending" : "Failed"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;
