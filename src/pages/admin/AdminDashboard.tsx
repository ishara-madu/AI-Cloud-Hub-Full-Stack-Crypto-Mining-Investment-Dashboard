import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  Users, Wallet, ArrowDownToLine, ArrowUpFromLine, Package,
  ChevronRight, Clock,
} from "lucide-react";

const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [profilesRes, walletsRes, depsRes, wdsRes, pkgsRes, allProfilesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("wallets").select("balance, total_deposited, total_withdrawn, total_commission"),
        supabase.from("deposit_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("withdrawal_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("user_packages").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("profiles").select("user_id, display_name"),
      ]);

      const pMap = new Map((allProfilesRes.data || []).map((p: any) => [p.user_id, p.display_name]));
      setProfileMap(pMap);

      const wallets = walletsRes.data || [];
      const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0);
      const totalDeposited = wallets.reduce((s, w) => s + Number(w.total_deposited), 0);
      const totalWithdrawn = wallets.reduce((s, w) => s + Number(w.total_withdrawn), 0);
      const totalCommission = wallets.reduce((s, w) => s + Number(w.total_commission), 0);

      setStats({
        totalUsers: profilesRes.count || 0,
        totalBalance,
        totalDeposited,
        totalWithdrawn,
        totalCommission,
        activePackages: pkgsRes.count || 0,
        pendingDepositsCount: (depsRes.data || []).length,
        pendingWithdrawalsCount: (wdsRes.data || []).length,
      });
      setPendingDeposits(depsRes.data || []);
      setPendingWithdrawals(wdsRes.data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="p-4 space-y-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Total Balance", value: `Rs ${stats.totalBalance.toLocaleString()}`, icon: Wallet, color: "text-emerald-500" },
    { label: "Total Deposited", value: `Rs ${stats.totalDeposited.toLocaleString()}`, icon: ArrowDownToLine, color: "text-blue-500" },
    { label: "Total Withdrawn", value: `Rs ${stats.totalWithdrawn.toLocaleString()}`, icon: ArrowUpFromLine, color: "text-red-500" },
    { label: "Total Commission", value: `Rs ${stats.totalCommission.toLocaleString()}`, icon: Wallet, color: "text-amber-500" },
    { label: "Active Packages", value: stats.activePackages, icon: Package, color: "text-teal-500" },
  ];

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      <h1 className="text-xl font-heading font-bold text-foreground">Admin Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="shadow-neu">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-lg font-heading font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Deposits */}
      <Card className="shadow-neu">
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
      <Card className="shadow-neu">
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
      </div>
    </div>
  );
};

export default AdminDashboard;
