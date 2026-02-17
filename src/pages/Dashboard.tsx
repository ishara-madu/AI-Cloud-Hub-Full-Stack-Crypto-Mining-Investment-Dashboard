import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Gift, Package, ArrowRight, TrendingUp, Receipt } from "lucide-react";

interface WalletData {
  balance: number;
  total_deposited: number;
  total_withdrawn: number;
  total_commission: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activePackages, setActivePackages] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [walletRes, txRes, pkgRes, profileRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("user_packages").select("id").eq("user_id", user.id).eq("is_active", true),
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      ]);
      setWallet(walletRes.data as WalletData | null);
      setTransactions((txRes.data as Transaction[]) || []);
      setActivePackages(pkgRes.data?.length || 0);
      setDisplayName(profileRes.data?.display_name || user.email?.split("@")[0] || "User");
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const stats = [
    { label: "Wallet Balance", value: wallet?.balance ?? 0, icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Deposits", value: wallet?.total_deposited ?? 0, icon: ArrowDownToLine, color: "text-success", bg: "bg-success/10" },
    { label: "Total Withdrawals", value: wallet?.total_withdrawn ?? 0, icon: ArrowUpFromLine, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Total Commissions", value: wallet?.total_commission ?? 0, icon: Gift, color: "text-secondary", bg: "bg-secondary/10" },
  ];

  const statusColor = (s: string) => s === "approved" ? "text-success bg-success/10" : s === "pending" ? "text-warning bg-warning/10" : "text-destructive bg-destructive/10";

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Welcome back, {displayName}! 👋</h1>
        <p className="text-muted-foreground mt-1">Here's your account overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-card hover:shadow-card-hover transition-shadow border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-heading font-bold text-foreground">${stat.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions + Active packages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/deposit">
              <Button className="w-full justify-between gradient-primary text-primary-foreground" size="lg">
                <span className="flex items-center gap-2"><ArrowDownToLine className="w-4 h-4" /> Deposit Funds</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/packages">
              <Button className="w-full justify-between" variant="outline" size="lg">
                <span className="flex items-center gap-2"><Package className="w-4 h-4" /> Browse Packages</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-card border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-heading">Active Packages</CardTitle>
            <span className="text-2xl font-heading font-bold text-primary">{activePackages}</span>
          </CardHeader>
          <CardContent>
            {activePackages === 0 ? (
              <div className="text-center py-6">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No active packages yet</p>
                <Link to="/packages"><Button variant="link" className="text-primary mt-1">Browse AI Packages</Button></Link>
              </div>
            ) : (
              <p className="text-muted-foreground">You have {activePackages} active package{activePackages > 1 ? "s" : ""}.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-heading">Recent Activity</CardTitle>
          <Link to="/transactions"><Button variant="ghost" size="sm" className="text-primary">View All</Button></Link>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No recent transactions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{tx.type}</p>
                    <p className="text-xs text-muted-foreground">{tx.description || new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${tx.type === "deposit" || tx.type === "commission" ? "text-success" : "text-foreground"}`}>
                      {tx.type === "withdrawal" || tx.type === "purchase" ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(tx.status)}`}>{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
