import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  Users, Wallet, ArrowDownToLine, ArrowUpFromLine, Package,
  ChevronRight, Clock, TrendingUp, TrendingDown, Activity,
  BarChart3, ShieldAlert, Globe, Zap, PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, AreaChart, Area,
} from "recharts";

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

      // Today's stats
      const todayStr = new Date().toISOString().split("T")[0];
      const todayTx = (txRes.data || []).filter((t: any) => t.created_at.startsWith(todayStr));
      const todayDeposits = todayTx.filter((t: any) => t.type === "deposit" && t.status === "approved").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const todayWithdrawals = todayTx.filter((t: any) => t.type === "withdrawal" && t.status === "approved").reduce((s: number, t: any) => s + Number(t.amount), 0);

      setStats({
        totalUsers: profilesRes.count || 0,
        totalBalance,
        totalDeposited,
        totalWithdrawn,
        totalCommission,
        activePackages: pkgsRes.count || 0,
        pendingDepositsCount: (depsRes.data || []).length,
        pendingWithdrawalsCount: (wdsRes.data || []).length,
        todayDeposits,
        todayWithdrawals,
        todayNewUsers: (allProfilesRes.data || []).filter((p: any) => p.created_at.startsWith(todayStr)).length,
      });
      setPendingDeposits(depsRes.data || []);
      setPendingWithdrawals(wdsRes.data || []);
      setRecentTransactions((txRes.data || []).slice(0, 10));

      // User growth data (last 7 days)
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

      // Package distribution
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

  if (loading) return <div className="p-4 space-y-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

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
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">Platform overview & analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-[10px]">
            <Globe className="w-3 h-3 mr-1" /> Live
          </Badge>
        </div>
      </div>

      {/* Today's Highlights */}
      <div className="gradient-primary rounded-2xl p-4 text-primary-foreground shadow-lg">
        <p className="text-xs font-medium opacity-80 mb-2">📊 Today's Highlights</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-heading font-bold">+{stats.todayNewUsers}</p>
            <p className="text-[10px] opacity-80">New Users</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-heading font-bold">Rs {stats.todayDeposits.toLocaleString()}</p>
            <p className="text-[10px] opacity-80">Deposits</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-heading font-bold">Rs {stats.todayWithdrawals.toLocaleString()}</p>
            <p className="text-[10px] opacity-80">Withdrawals</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="shadow-neu border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.bgColor)}>
                  <s.icon className={cn("w-4 h-4", s.color)} />
                </div>
              </div>
              <p className="text-lg font-heading font-bold text-foreground">{s.value}</p>
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts Bar */}
      <div className="flex gap-3">
        {stats.pendingDepositsCount > 0 && (
          <Link to="/admin/deposits" className="flex-1">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-600">{stats.pendingDepositsCount} pending deposits</span>
            </div>
          </Link>
        )}
        {stats.pendingWithdrawalsCount > 0 && (
          <Link to="/admin/withdrawals" className="flex-1">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-500">{stats.pendingWithdrawalsCount} pending withdrawals</span>
            </div>
          </Link>
        )}
        {frozenUsers > 0 && (
          <Link to="/admin/users" className="flex-1">
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              <span className="text-xs font-medium text-destructive">{frozenUsers} frozen</span>
            </div>
          </Link>
        )}
      </div>

      {/* User Growth Chart */}
      <Card className="shadow-neu border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> User Growth (7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              />
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
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <RechartsPie>
                  <Pie
                    data={packageStats}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={3}
                  >
                    {packageStats.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </RechartsPie>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {packageStats.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[100px]">{p.name}</span>
                    </div>
                    <span className="font-bold text-foreground">Rs {p.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Flow */}
      <Card className="shadow-neu border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Financial Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {[
              { label: "Total In (Deposits)", value: stats.totalDeposited, color: "bg-emerald-500", pct: 100 },
              { label: "Total Out (Withdrawals)", value: stats.totalWithdrawn, color: "bg-red-500", pct: stats.totalDeposited > 0 ? (stats.totalWithdrawn / stats.totalDeposited) * 100 : 0 },
              { label: "Commission Paid", value: stats.totalCommission, color: "bg-amber-500", pct: stats.totalDeposited > 0 ? (stats.totalCommission / stats.totalDeposited) * 100 : 0 },
              { label: "Net Retained", value: stats.totalBalance, color: "bg-primary", pct: stats.totalDeposited > 0 ? (stats.totalBalance / stats.totalDeposited) * 100 : 0 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-bold text-foreground">Rs {item.value.toLocaleString()}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", item.color)} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="shadow-neu border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
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

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/admin/users"><Button variant="outline" className="w-full h-12 rounded-xl"><Users className="w-4 h-4 mr-2" />Manage Users</Button></Link>
        <Link to="/admin/packages"><Button variant="outline" className="w-full h-12 rounded-xl"><Package className="w-4 h-4 mr-2" />Manage Packages</Button></Link>
        <Link to="/admin/deposits"><Button variant="outline" className="w-full h-12 rounded-xl"><ArrowDownToLine className="w-4 h-4 mr-2" />All Deposits</Button></Link>
        <Link to="/admin/withdrawals"><Button variant="outline" className="w-full h-12 rounded-xl"><ArrowUpFromLine className="w-4 h-4 mr-2" />All Withdrawals</Button></Link>
        <Link to="/admin/redeem-codes"><Button variant="outline" className="w-full h-12 rounded-xl">🎫 Redeem Codes</Button></Link>
        <Link to="/admin/sliders"><Button variant="outline" className="w-full h-12 rounded-xl">🖼️ Slider Banners</Button></Link>
      </div>
    </div>
  );
};

export default AdminDashboard;