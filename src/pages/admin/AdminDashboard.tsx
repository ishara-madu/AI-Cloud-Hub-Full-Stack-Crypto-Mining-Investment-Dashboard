import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  Users, Wallet, ArrowDownToLine, ArrowUpFromLine, Package,
  ChevronRight, Clock, TrendingUp, Activity,
  BarChart3, ShieldAlert, Globe, Zap, PieChart, Brain, Loader2,
  Settings, FileText, Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell,
} from "recharts";
import { toast } from "sonner";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(142, 76%, 36%)", "hsl(45, 93%, 47%)", "hsl(199, 89%, 48%)"];

const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [packageStats, setPackageStats] = useState<any[]>([]);
  const [frozenUsers, setFrozenUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [profilesRes, walletsRes, depsRes, wdsRes, pkgsRes, allProfilesRes, txRes, userPkgsRes, frozenRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("wallets").select("balance, total_deposited, total_withdrawn, total_commission"),
        supabase.from("deposit_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("withdrawal_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("user_packages").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("profiles").select("user_id, display_name, created_at"),
        supabase.from("transactions").select("type, amount, status, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("user_packages").select("package_id, price_paid, ai_packages(name)"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_frozen", true),
      ]);

      const pMap = new Map((allProfilesRes.data || []).map((p: any) => [p.user_id, p.display_name]));
      setProfileMap(pMap);
      setFrozenUsers(frozenRes.count || 0);

      const wallets = walletsRes.data || [];
      const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0);
      const totalDeposited = wallets.reduce((s, w) => s + Number(w.total_deposited), 0);
      const totalWithdrawn = wallets.reduce((s, w) => s + Number(w.total_withdrawn), 0);
      const totalCommission = wallets.reduce((s, w) => s + Number(w.total_commission), 0);

      const todayStr = new Date().toISOString().split("T")[0];
      const todayTx = (txRes.data || []).filter((t: any) => t.created_at.startsWith(todayStr));
      const todayDeposits = todayTx.filter((t: any) => t.type === "deposit" && t.status === "approved").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const todayWithdrawals = todayTx.filter((t: any) => t.type === "withdrawal" && t.status === "approved").reduce((s: number, t: any) => s + Number(t.amount), 0);

      setStats({
        totalUsers: profilesRes.count || 0,
        totalBalance, totalDeposited, totalWithdrawn, totalCommission,
        activePackages: pkgsRes.count || 0,
        pendingDepositsCount: (depsRes.data || []).length,
        pendingWithdrawalsCount: (wdsRes.data || []).length,
        todayDeposits, todayWithdrawals,
        todayNewUsers: (allProfilesRes.data || []).filter((p: any) => p.created_at.startsWith(todayStr)).length,
      });
      setPendingDeposits(depsRes.data || []);
      setPendingWithdrawals(wdsRes.data || []);
      setRecentTransactions((txRes.data || []).slice(0, 10));

      const growth: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
        const count = (allProfilesRes.data || []).filter((p: any) => p.created_at.startsWith(dateStr)).length;
        growth.push({ day: dayLabel, users: count });
      }
      setUserGrowth(growth);

      const pkgMap = new Map<string, { name: string; count: number; revenue: number }>();
      (userPkgsRes.data || []).forEach((up: any) => {
        const name = up.ai_packages?.name || "Unknown";
        const existing = pkgMap.get(name) || { name, count: 0, revenue: 0 };
        existing.count++;
        existing.revenue += Number(up.price_paid);
        pkgMap.set(name, existing);
      });
      setPackageStats(Array.from(pkgMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5));

      setLoading(false);
    };
    fetch();
  }, []);

  const generateAiInsights = async () => {
    if (!stats) return;
    setAiLoading(true);
    setAiInsight(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-ai-insights", {
        body: {
          stats,
          userGrowth,
          packageStats,
          recentTransactions: recentTransactions.slice(0, 20),
        },
      });
      if (error) throw error;
      setAiInsight(data?.insight || "Unable to generate insights at this time.");
    } catch (err) {
      console.error("AI insight error:", err);
      toast.error("Failed to generate AI insights");
    }
    setAiLoading(false);
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary", bgColor: "bg-primary/10" },
    { label: "Platform Balance", value: `Rs ${stats.totalBalance.toLocaleString()}`, icon: Wallet, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    { label: "Total Deposited", value: `Rs ${stats.totalDeposited.toLocaleString()}`, icon: ArrowDownToLine, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    { label: "Total Withdrawn", value: `Rs ${stats.totalWithdrawn.toLocaleString()}`, icon: ArrowUpFromLine, color: "text-red-500", bgColor: "bg-red-500/10" },
    { label: "Total Commission", value: `Rs ${stats.totalCommission.toLocaleString()}`, icon: TrendingUp, color: "text-amber-500", bgColor: "bg-amber-500/10" },
    { label: "Active Packages", value: stats.activePackages, icon: Package, color: "text-teal-500", bgColor: "bg-teal-500/10" },
  ];

  const txTypeIcon = (type: string) => {
    if (type === "deposit") return <ArrowDownToLine className="w-3 h-3 text-blue-500" />;
    if (type === "withdrawal") return <ArrowUpFromLine className="w-3 h-3 text-red-500" />;
    return <Activity className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform overview & analytics</p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-xs">
          <Globe className="w-3 h-3 mr-1" /> Live
        </Badge>
      </div>

      {/* Today's Highlights */}
      <div className="gradient-primary rounded-2xl p-6 text-primary-foreground shadow-lg">
        <p className="text-sm font-medium opacity-80 mb-3">📊 Today's Highlights</p>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-2xl font-heading font-bold">+{stats.todayNewUsers}</p>
            <p className="text-xs opacity-80">New Users</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-heading font-bold">Rs {stats.todayDeposits.toLocaleString()}</p>
            <p className="text-xs opacity-80">Deposits</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-heading font-bold">Rs {stats.todayWithdrawals.toLocaleString()}</p>
            <p className="text-xs opacity-80">Withdrawals</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="shadow-neu border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.bgColor)}>
                  <s.icon className={cn("w-4 h-4", s.color)} />
                </div>
              </div>
              <p className="text-lg font-heading font-bold text-foreground">{s.value}</p>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts Bar */}
      <div className="flex gap-3 flex-wrap">
        {stats.pendingDepositsCount > 0 && (
          <Link to="/admin/deposits">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-600">{stats.pendingDepositsCount} pending deposits</span>
            </div>
          </Link>
        )}
        {stats.pendingWithdrawalsCount > 0 && (
          <Link to="/admin/withdrawals">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-500">{stats.pendingWithdrawalsCount} pending withdrawals</span>
            </div>
          </Link>
        )}
        {frozenUsers > 0 && (
          <Link to="/admin/users">
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">{frozenUsers} frozen accounts</span>
            </div>
          </Link>
        )}
      </div>

      {/* AI Insights */}
      <Card className="shadow-neu border-0 bg-gradient-to-br from-card to-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> AI Analytics & Predictions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!aiInsight && !aiLoading && (
            <Button onClick={generateAiInsights} className="rounded-xl gradient-primary text-primary-foreground">
              <Brain className="w-4 h-4 mr-2" /> Generate AI Insights
            </Button>
          )}
          {aiLoading && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Analyzing platform data...</span>
            </div>
          )}
          {aiInsight && (
            <div className="space-y-3">
              <div className="prose prose-sm max-w-none text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {aiInsight}
              </div>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={generateAiInsights}>
                <Brain className="w-3 h-3 mr-1" /> Refresh Analysis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card className="shadow-neu border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> User Growth (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="users" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Package */}
        {packageStats.length > 0 && (
          <Card className="shadow-neu border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" /> Revenue by Package
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <RechartsPie>
                    <Pie data={packageStats} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>
                      {packageStats.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {packageStats.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{p.name}</span>
                      </div>
                      <span className="font-bold text-foreground">Rs {p.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Financial Overview */}
      <Card className="shadow-neu border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Financial Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total In (Deposits)", value: stats.totalDeposited, color: "bg-emerald-500", pct: 100 },
              { label: "Total Out (Withdrawals)", value: stats.totalWithdrawn, color: "bg-red-500", pct: stats.totalDeposited > 0 ? (stats.totalWithdrawn / stats.totalDeposited) * 100 : 0 },
              { label: "Commission Paid", value: stats.totalCommission, color: "bg-amber-500", pct: stats.totalDeposited > 0 ? (stats.totalCommission / stats.totalDeposited) * 100 : 0 },
              { label: "Net Retained", value: stats.totalBalance, color: "bg-primary", pct: stats.totalDeposited > 0 ? (stats.totalBalance / stats.totalDeposited) * 100 : 0 },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-bold text-foreground">Rs {item.value.toLocaleString()}</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", item.color)} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending + Recent Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card className="shadow-neu border-0 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {recentTransactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2">
                  {txTypeIcon(tx.type)}
                  <div>
                    <p className="text-[11px] font-medium text-foreground capitalize">{tx.type}</p>
                    <p className="text-[9px] text-muted-foreground">{new Date(tx.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-foreground">Rs {Number(tx.amount).toLocaleString()}</p>
                  <Badge className={cn("text-[8px] px-1",
                    tx.status === "approved" ? "bg-emerald-500/20 text-emerald-600" :
                    tx.status === "pending" ? "bg-yellow-500/20 text-yellow-600" :
                    "bg-red-500/20 text-red-500"
                  )}>{tx.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending Deposits */}
        <Card className="shadow-neu border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading">Pending Deposits</CardTitle>
              <Link to="/admin/deposits"><Button variant="ghost" size="sm" className="text-xs">View All <ChevronRight className="w-3 h-3 ml-1" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingDeposits.length === 0 && <p className="text-xs text-muted-foreground">No pending deposits</p>}
            {pendingDeposits.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs font-medium">{profileMap.get(d.user_id) || "User"}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">Rs {Number(d.amount).toLocaleString()}</p>
                  <Badge className="text-[9px] bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Pending</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending Withdrawals */}
        <Card className="shadow-neu border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading">Pending Withdrawals</CardTitle>
              <Link to="/admin/withdrawals"><Button variant="ghost" size="sm" className="text-xs">View All <ChevronRight className="w-3 h-3 ml-1" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingWithdrawals.length === 0 && <p className="text-xs text-muted-foreground">No pending withdrawals</p>}
            {pendingWithdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs font-medium">{profileMap.get(w.user_id) || "User"}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(w.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">Rs {Number(w.amount).toLocaleString()}</p>
                  <Badge className="text-[9px] bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Pending</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links - Desktop Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link to="/admin/users"><Button variant="outline" className="w-full h-14 rounded-xl text-sm"><Users className="w-4 h-4 mr-2" />Users</Button></Link>
        <Link to="/admin/packages"><Button variant="outline" className="w-full h-14 rounded-xl text-sm"><Package className="w-4 h-4 mr-2" />Packages</Button></Link>
        <Link to="/admin/deposits"><Button variant="outline" className="w-full h-14 rounded-xl text-sm"><ArrowDownToLine className="w-4 h-4 mr-2" />Deposits</Button></Link>
        <Link to="/admin/withdrawals"><Button variant="outline" className="w-full h-14 rounded-xl text-sm"><ArrowUpFromLine className="w-4 h-4 mr-2" />Withdrawals</Button></Link>
        <Link to="/admin/redeem-codes"><Button variant="outline" className="w-full h-14 rounded-xl text-sm">🎫 Redeem Codes</Button></Link>
        <Link to="/admin/sliders"><Button variant="outline" className="w-full h-14 rounded-xl text-sm"><ImageIcon className="w-4 h-4 mr-2" />Sliders</Button></Link>
        <Link to="/admin/user-packages"><Button variant="outline" className="w-full h-14 rounded-xl text-sm"><Package className="w-4 h-4 mr-2" />User Pkgs</Button></Link>
        <Link to="/admin/settings"><Button variant="outline" className="w-full h-14 rounded-xl text-sm"><Settings className="w-4 h-4 mr-2" />Settings</Button></Link>
        <Link to="/admin/alerts"><Button variant="outline" className="w-full h-14 rounded-xl text-sm"><ShieldAlert className="w-4 h-4 mr-2" />Alerts</Button></Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
