import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
}

const statusColor = (s: string) => {
  if (s === "approved") return "bg-success/10 text-success";
  if (s === "pending") return "bg-warning/10 text-warning";
  return "bg-destructive/10 text-destructive";
};

const typeColor = (t: string) => {
  if (t === "deposit" || t === "commission") return "text-success";
  if (t === "withdrawal" || t === "purchase") return "text-destructive";
  return "text-foreground";
};

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setTransactions((data || []) as Transaction[]);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const filterTx = (type?: string) => {
    let filtered = transactions;
    if (type) filtered = filtered.filter((t) => t.type === type);
    if (statusFilter !== "all") filtered = filtered.filter((t) => t.status === statusFilter);
    return filtered;
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>;

  const TxList = ({ items }: { items: Transaction[] }) => (
    items.length === 0 ? (
      <Card className="shadow-card text-center"><CardContent className="py-12"><Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No transactions found</p></CardContent></Card>
    ) : (
      <Card className="shadow-card border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left p-4 text-muted-foreground font-medium">Date</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Type</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Description</th>
                <th className="text-right p-4 text-muted-foreground font-medium">Amount</th>
                <th className="text-right p-4 text-muted-foreground font-medium">Status</th>
              </tr></thead>
              <tbody>
                {items.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="p-4 capitalize font-medium">{tx.type}</td>
                    <td className="p-4 text-muted-foreground">{tx.description || "-"}</td>
                    <td className={`p-4 text-right font-semibold ${typeColor(tx.type)}`}>
                      {tx.type === "withdrawal" || tx.type === "purchase" ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                    </td>
                    <td className="p-4 text-right">
                      <Badge className={statusColor(tx.status)}>{tx.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">Transactions</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="deposit">Deposits</TabsTrigger>
          <TabsTrigger value="withdrawal">Withdrawals</TabsTrigger>
          <TabsTrigger value="purchase">Purchases</TabsTrigger>
          <TabsTrigger value="commission">Commissions</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4"><TxList items={filterTx()} /></TabsContent>
        <TabsContent value="deposit" className="mt-4"><TxList items={filterTx("deposit")} /></TabsContent>
        <TabsContent value="withdrawal" className="mt-4"><TxList items={filterTx("withdrawal")} /></TabsContent>
        <TabsContent value="purchase" className="mt-4"><TxList items={filterTx("purchase")} /></TabsContent>
        <TabsContent value="commission" className="mt-4"><TxList items={filterTx("commission")} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Transactions;
