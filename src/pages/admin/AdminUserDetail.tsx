import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, User, Wallet, ShieldAlert, ShieldCheck, Copy, CreditCard,
  Crown, AlertTriangle, Bell, Package, TrendingUp, Activity,
  Smartphone, Clock, Ban, CheckCircle, XCircle, Calendar,
  DollarSign, ArrowUpRight, ArrowDownRight, BarChart3, Info, RefreshCw,
  Users, Hash, Phone, Link2, Timer
} from "lucide-react";
import { toast } from "sonner";

interface UserDetail {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
  is_frozen: boolean;
  credit_score: number;
  ban_count: number;
  avatar_url: string | null;
  privacy_accepted: boolean;
  ban_expires_at: string | null;
}

interface WalletData {
  balance: number;
  total_deposited: number;
  total_withdrawn: number;
  total_commission: number;
  updated_at: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  is_read: boolean;
  created_at: string;
}

interface UserPackage {
  id: string;
  package_id: string;
  price_paid: number;
  is_active: boolean | null;
  expires_at: string | null;
  purchased_at: string;
  package_name?: string;
}

interface DeviceLog {
  id: string;
  event_type: string;
  ip_address: string | null;
  fingerprint: string | null;
  user_agent: string | null;
  screen_info: string | null;
  timezone: string | null;
  created_at: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  iban: string | null;
  is_default: boolean | null;
  created_at: string;
}

interface Commission {
  id: string;
  amount: number;
  tier: number;
  from_user_id: string | null;
  source_type: string | null;
  created_at: string;
}

interface Referral {
  id: string;
  referred_id: string;
  tier: number;
  created_at: string;
  referred_name?: string;
}

// Helper: format remaining time from now until expiryIso
const formatTimeRemaining = (expiryIso: string): string => {
  const ms = new Date(expiryIso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h remaining`;
  }
  return `${h}h ${m}m ${s}s remaining`;
};

const AdminUserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserDetail | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [role, setRole] = useState<string>("user");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  const [deviceLogs, setDeviceLogs] = useState<DeviceLog[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState<string>("");
  const [banReason, setBanReason] = useState("");
  const [banning, setBanning] = useState(false);
  const [ticker, setTicker] = useState(0);

  // Tick every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    if (!userId) return;
    setLoading(true);

    const [
      profileRes, walletRes, roleRes, txRes, notifRes,
      pkgRes, deviceRes, bankRes, commRes, refRes
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("wallets").select("*").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("user_packages").select("*, ai_packages(name)").eq("user_id", userId).order("purchased_at", { ascending: false }),
      supabase.from("device_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("bank_accounts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("commissions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("referrals").select("*").eq("referrer_id", userId).order("created_at", { ascending: false }),
    ]);

    setProfile(profileRes.data);
    setWallet(walletRes.data);
    setRole(roleRes.data?.role || "user");
    setTransactions(txRes.data || []);
    setNotifications(notifRes.data || []);
    setUserPackages((pkgRes.data || []).map((p: any) => ({ ...p, package_name: p.ai_packages?.name })));
    setDeviceLogs(deviceRes.data || []);
    setBankAccounts(bankRes.data || []);
    setCommissions(commRes.data || []);

    const refs = refRes.data || [];
    if (refs.length > 0) {
      const refIds = refs.map((r: any) => r.referred_id);
      const { data: refProfiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", refIds);
      const nameMap = new Map((refProfiles || []).map((p: any) => [p.user_id, p.display_name]));
      setReferrals(refs.map((r: any) => ({ ...r, referred_name: nameMap.get(r.referred_id) || "Unknown" })));
    } else {
      setReferrals([]);
    }

    if (profileRes.data?.referred_by) {
      const { data: refData } = await supabase.from("profiles").select("display_name").eq("user_id", profileRes.data.referred_by).single();
      setReferrerName(refData?.display_name || null);
    }

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [userId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 50) return "text-yellow-500";
    return "text-destructive";
  };

  const getCreditScoreIssues = (score: number, banCount: number): string[] => {
    const issues: string[] = [];
    if (banCount > 0) issues.push(`Banned ${banCount} time(s) — each ban reduces credit by ${banCount * 20}%`);
    if (score < 100 && banCount === 0) issues.push("Credit score may be recovering (+1/day via daily sign-in)");
    if (score < 50) issues.push("Withdrawal handling fee significantly increased (base 5% + penalty)");
    if (score < 80) issues.push("Daily rewards and commissions are reduced proportionally");
    if (score === 0) issues.push("All earnings and commissions are at 0% — maximum penalty reached");
    return issues;
  };

  const handleBan = async () => {
    if (!userId || !profile) return;
    setBanning(true);
    const hours = banDuration ? parseInt(banDuration) : null;
    const { data, error } = await supabase.rpc("ban_user", {
      p_user_id: userId,
      p_duration_hours: hours,
      p_reason: banReason || null,
    } as any);
    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || error?.message || "Ban failed");
    } else {
      const d = data as any;
      toast.success(
        `${profile.display_name || "User"} banned. Credit: ${d.new_credit_score}%${d.is_temporary ? ` (temp ${hours}h)` : " (permanent)"}`
      );
    }
    setBanning(false);
    fetchAll();
  };

  const handleUnban = async () => {
    if (!userId) return;
    await supabase.from("profiles").update({ is_frozen: false, ban_expires_at: null }).eq("user_id", userId);
    await supabase.from("notifications").insert({
      user_id: userId, type: "security",
      title: "Account Unfrozen ✅",
      description: "Your account has been unfrozen by an administrator. You can now use all features normally.",
    });
    toast.success("Account unfrozen");
    fetchAll();
  };

  const isBanActive = profile?.is_frozen;
  const isTempBan = profile?.is_frozen && !!profile?.ban_expires_at;
  const isPermanentBan = profile?.is_frozen && !profile?.ban_expires_at;
  const creditIssues = profile ? getCreditScoreIssues(profile.credit_score, profile.ban_count) : [];

  const todayEarnings = transactions
    .filter(t => {
      const d = new Date(t.created_at);
      const today = new Date();
      return d.toDateString() === today.toDateString() && (t.type === "commission" || t.type === "refund") && t.status === "approved";
    })
    .reduce((s, t) => s + t.amount, 0);

  const txTypeIcon = (type: string) => {
    switch (type) {
      case "deposit": return <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />;
      case "withdrawal": return <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />;
      case "commission": return <TrendingUp className="w-3.5 h-3.5 text-primary" />;
      case "purchase": return <Package className="w-3.5 h-3.5 text-yellow-500" />;
      case "refund": return <RefreshCw className="w-3.5 h-3.5 text-blue-500" />;
      default: return <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const txStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: "bg-emerald-500/15 text-emerald-600",
      pending: "bg-yellow-500/15 text-yellow-600",
      rejected: "bg-destructive/15 text-destructive",
    };
    return <Badge className={`text-[10px] ${map[status] || ""}`}>{status}</Badge>;
  };

  if (loading) return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40" />
      <Skeleton className="h-64" />
    </div>
  );

  if (!profile) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">User not found.</p>
      <Link to="/admin/users"><Button variant="ghost" className="mt-4">← Back to Users</Button></Link>
    </div>
  );

  const feePercent = 5 + ((100 - profile.credit_score) * 0.1);

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/admin/users">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-heading font-bold text-foreground">{profile.display_name || "No Name"}</h1>
              {role === "admin" && <Badge className="bg-red-500/20 text-red-500 text-[10px]"><Crown className="w-3 h-3 mr-1" />Admin</Badge>}
              {isBanActive ? (
                isTempBan
                  ? <Badge className="bg-yellow-500/20 text-yellow-600 text-[10px]"><Timer className="w-3 h-3 mr-1" />Temp Ban</Badge>
                  : <Badge className="bg-destructive/20 text-destructive text-[10px]"><Ban className="w-3 h-3 mr-1" />Permanent Ban</Badge>
              ) : (
                <Badge className="bg-emerald-500/20 text-emerald-600 text-[10px]"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">{profile.user_id}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} className="rounded-xl">
          <RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh
        </Button>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-neu">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Balance</p>
            <p className="text-lg font-bold text-foreground">Rs {(wallet?.balance ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-neu">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Credit Score</p>
            <p className={`text-lg font-bold ${getCreditScoreColor(profile.credit_score)}`}>{profile.credit_score}%</p>
          </CardContent>
        </Card>
        <Card className="shadow-neu">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Bans</p>
            <p className={`text-lg font-bold ${profile.ban_count > 0 ? "text-destructive" : "text-emerald-500"}`}>{profile.ban_count}</p>
          </CardContent>
        </Card>
        <Card className="shadow-neu">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Today's Earned</p>
            <p className="text-lg font-bold text-primary">Rs {todayEarnings.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Issues Banner */}
      {(isBanActive || profile.credit_score < 100 || creditIssues.length > 0) && (
        <Card className="border-destructive/40 bg-destructive/5 shadow-neu">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm font-bold text-destructive">Active Issues & Penalties</p>
            </div>
            {isBanActive && isTempBan && profile.ban_expires_at && (
              <div className="flex items-center gap-2 text-xs bg-yellow-500/10 rounded-lg px-3 py-2 border border-yellow-500/30">
                <Timer className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                <div>
                  <span className="text-yellow-600 font-bold">TEMPORARY BAN — </span>
                  <span className="text-yellow-600 font-mono font-bold">{formatTimeRemaining(profile.ban_expires_at)}</span>
                  <span className="text-muted-foreground ml-2">(expires {new Date(profile.ban_expires_at).toLocaleString()})</span>
                </div>
              </div>
            )}
            {isBanActive && isPermanentBan && (
              <div className="flex items-center gap-2 text-xs bg-destructive/10 rounded-lg px-3 py-2">
                <Ban className="w-3.5 h-3.5 text-destructive shrink-0" />
                <span className="text-destructive font-medium">PERMANENT BAN — Account fully frozen. All withdrawals and features disabled.</span>
              </div>
            )}
            {creditIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                <span className="text-foreground">{issue}</span>
              </div>
            ))}
            {profile.credit_score < 100 && (
              <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2">
                <BarChart3 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Current withdrawal fee: <strong>{feePercent.toFixed(1)}%</strong> (base 5% + {((100 - profile.credit_score) * 0.1).toFixed(1)}% penalty)</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ban/Unban Controls */}
      <Card className="shadow-neu">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />Ban Controls
            <Badge className="ml-auto text-[10px]">Total bans: {profile.ban_count}</Badge>
          </p>
          {isBanActive ? (
            <div className="space-y-2">
              {isTempBan && profile.ban_expires_at && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 text-xs text-center">
                  <p className="text-yellow-600 font-bold">⏱ Temporary ban expires in:</p>
                  <p className="text-yellow-500 font-mono text-base font-bold mt-1">{formatTimeRemaining(profile.ban_expires_at)}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{new Date(profile.ban_expires_at).toLocaleString()}</p>
                </div>
              )}
              {isPermanentBan && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-xs text-center">
                  <p className="text-destructive font-bold">🔒 Permanent Ban — Account fully frozen</p>
                </div>
              )}
              <Button onClick={handleUnban} className="w-full rounded-xl" variant="default">
                <ShieldCheck className="w-4 h-4 mr-2" />Unfreeze Account
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Duration (hours) — leave empty for permanent</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 24 (permanent if empty)"
                    className="rounded-xl h-9 text-sm"
                    value={banDuration}
                    onChange={e => setBanDuration(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {["1", "6", "24", "72", "168"].map(h => (
                  <button
                    key={h}
                    onClick={() => setBanDuration(h)}
                    className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${banDuration === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                  >
                    {h}h
                  </button>
                ))}
                <button
                  onClick={() => setBanDuration("")}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${!banDuration ? "bg-destructive text-destructive-foreground border-destructive" : "border-border text-muted-foreground hover:border-destructive"}`}
                >
                  Permanent
                </button>
              </div>

              {/* Ban Reason */}
              <div className="space-y-1.5">
                <Label className="text-xs">Ban Reason (optional)</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Enter reason for banning..."
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Suspicious activity detected",
                    "Multiple account violation",
                    "Fraudulent transaction",
                    "Terms of service violation",
                    "Spam or abuse",
                  ].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setBanReason(reason)}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${banReason === reason ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"}`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleBan} variant="destructive" className="w-full rounded-xl" disabled={banning}>
                <Ban className="w-4 h-4 mr-2" />
                {banDuration ? `Temp Ban (${banDuration}h)` : "Permanent Ban"} — Ban #{profile.ban_count + 1}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg text-xs">Overview</TabsTrigger>
          <TabsTrigger value="wallet" className="rounded-lg text-xs">Wallet</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-lg text-xs">Transactions ({transactions.length})</TabsTrigger>
          <TabsTrigger value="packages" className="rounded-lg text-xs">Packages ({userPackages.length})</TabsTrigger>
          <TabsTrigger value="commissions" className="rounded-lg text-xs">Commissions ({commissions.length})</TabsTrigger>
          <TabsTrigger value="referrals" className="rounded-lg text-xs">Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg text-xs">Notifications ({notifications.length})</TabsTrigger>
          <TabsTrigger value="bank" className="rounded-lg text-xs">Bank ({bankAccounts.length})</TabsTrigger>
          <TabsTrigger value="devices" className="rounded-lg text-xs">Devices ({deviceLogs.length})</TabsTrigger>
        </TabsList>

        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profile Info */}
            <Card className="shadow-neu">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-primary" />Profile Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Display Name", value: profile.display_name || "N/A", icon: <User className="w-3 h-3" /> },
                  { label: "Phone", value: profile.phone || "N/A", icon: <Phone className="w-3 h-3" /> },
                  { label: "Referral Code", value: profile.referral_code || "N/A", icon: <Hash className="w-3 h-3" />, copy: profile.referral_code },
                  { label: "User ID", value: profile.user_id.slice(0, 16) + "...", icon: <Hash className="w-3 h-3" />, copy: profile.user_id },
                  { label: "Role", value: role, icon: <Crown className="w-3 h-3" /> },
                  { label: "Joined", value: new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), icon: <Calendar className="w-3 h-3" /> },
                  { label: "Privacy Accepted", value: profile.privacy_accepted ? "Yes" : "No", icon: <CheckCircle className="w-3 h-3" /> },
                  { label: "Referred By", value: referrerName || (profile.referred_by ? profile.referred_by.slice(0, 8) + "..." : "None"), icon: <Link2 className="w-3 h-3" /> },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {item.icon}<span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{item.value}</span>
                      {item.copy && (
                        <button onClick={() => copyToClipboard(item.copy!)} className="text-primary hover:text-primary/70">
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Ban & Credit History */}
            <Card className="shadow-neu">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-destructive" />Ban & Credit History</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Account Status</span>
                    {isBanActive ? (
                      isTempBan
                        ? <Badge className="bg-yellow-500/20 text-yellow-600 text-[10px]">⏱ Temp Ban</Badge>
                        : <Badge className="bg-destructive/20 text-destructive text-[10px]">🔒 Permanent Ban</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-600 text-[10px]">✅ Active</Badge>
                    )}
                  </div>
                  {isTempBan && profile.ban_expires_at && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Time Remaining</span>
                      <span className="font-mono font-bold text-yellow-600">{formatTimeRemaining(profile.ban_expires_at)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Bans</span>
                    <span className={`font-bold ${profile.ban_count > 0 ? "text-destructive" : "text-emerald-500"}`}>{profile.ban_count}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Credit Score</span>
                    <span className={`font-bold ${getCreditScoreColor(profile.credit_score)}`}>{profile.credit_score}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full transition-all ${profile.credit_score >= 80 ? "bg-emerald-500" : profile.credit_score >= 50 ? "bg-yellow-500" : "bg-destructive"}`}
                      style={{ width: `${profile.credit_score}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Credit recovers +1%/day via daily sign-in (max 100%)</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground mb-2">Ban Impact Calculator</p>
                  {profile.ban_count > 0 ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="bg-destructive/10 rounded-lg px-3 py-2 flex justify-between">
                        <span className="text-muted-foreground">Credit lost to bans</span>
                        <span className="text-destructive font-bold">~{Math.min(profile.ban_count * 20, 100)}% total</span>
                      </div>
                      <div className="bg-muted/30 rounded-lg px-3 py-2 flex justify-between">
                        <span className="text-muted-foreground">Days to full recovery</span>
                        <span className="font-bold">{100 - profile.credit_score} days</span>
                      </div>
                      <div className="bg-muted/30 rounded-lg px-3 py-2 flex justify-between">
                        <span className="text-muted-foreground">Next ban penalty</span>
                        <span className="text-destructive font-bold">-{(profile.ban_count + 1) * 20}% credit</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 rounded-lg px-3 py-2 text-xs text-emerald-600 text-center">
                      ✅ No ban history — clean record
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground mb-2">Economic Impact</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="bg-muted/30 rounded-lg px-3 py-2 flex justify-between">
                      <span className="text-muted-foreground">Commission multiplier</span>
                      <span className="font-bold">{profile.credit_score}% of rate</span>
                    </div>
                    <div className="bg-muted/30 rounded-lg px-3 py-2 flex justify-between">
                      <span className="text-muted-foreground">Daily reward multiplier</span>
                      <span className="font-bold">{profile.credit_score}% of Rs 10</span>
                    </div>
                    <div className="bg-muted/30 rounded-lg px-3 py-2 flex justify-between">
                      <span className="text-muted-foreground">Withdrawal fee</span>
                      <span className={`font-bold ${feePercent > 5 ? "text-destructive" : "text-foreground"}`}>{feePercent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Packages Summary */}
          <Card className="shadow-neu">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4 text-primary" />Active Packages</CardTitle></CardHeader>
            <CardContent>
              {userPackages.filter(p => p.is_active).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No active packages</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {userPackages.filter(p => p.is_active).map(pkg => (
                    <div key={pkg.id} className="bg-muted/30 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-foreground">{pkg.package_name || "Package"}</p>
                        <p className="text-muted-foreground">Paid: Rs {pkg.price_paid.toLocaleString()}</p>
                        {pkg.expires_at && <p className="text-muted-foreground">Expires: {new Date(pkg.expires_at).toLocaleDateString()}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-500 font-bold">+Rs {(pkg.price_paid * 0.05).toFixed(0)}/day</p>
                        <Badge className="bg-emerald-500/15 text-emerald-600 text-[9px]">Active</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════ WALLET TAB ═══════════════ */}
        <TabsContent value="wallet" className="space-y-4">
          <Card className="shadow-neu">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" />Wallet Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Current Balance", value: wallet?.balance ?? 0, color: "text-foreground", big: true },
                  { label: "Total Deposited", value: wallet?.total_deposited ?? 0, color: "text-emerald-500" },
                  { label: "Total Withdrawn", value: wallet?.total_withdrawn ?? 0, color: "text-destructive" },
                  { label: "Total Commission", value: wallet?.total_commission ?? 0, color: "text-primary" },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/30 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                    <p className={`font-bold ${item.big ? "text-xl" : "text-base"} ${item.color}`}>
                      Rs {item.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              {wallet && (
                <p className="text-[10px] text-muted-foreground text-right mt-3">Last updated: {new Date(wallet.updated_at).toLocaleString()}</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-neu">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Withdrawal Eligibility</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                {
                  label: "Minimum deposit (Rs 500)",
                  pass: (wallet?.total_deposited ?? 0) >= 500,
                  detail: `Has deposited Rs ${(wallet?.total_deposited ?? 0).toLocaleString()}`
                },
                {
                  label: "Has active package",
                  pass: userPackages.some(p => p.is_active),
                  detail: `${userPackages.filter(p => p.is_active).length} active package(s)`
                },
                {
                  label: "Account not frozen",
                  pass: !isBanActive,
                  detail: isBanActive ? (isTempBan ? "Temporarily banned" : "Permanently banned") : "Account is active"
                },
                {
                  label: "Minimum withdrawal (Rs 1,000)",
                  pass: (wallet?.balance ?? 0) >= 1000,
                  detail: `Balance Rs ${(wallet?.balance ?? 0).toLocaleString()}`
                },
              ].map((check) => (
                <div key={check.label} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    {check.pass ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                    <span className="font-medium">{check.label}</span>
                  </div>
                  <span className="text-muted-foreground">{check.detail}</span>
                </div>
              ))}
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs flex justify-between">
                <span className="text-muted-foreground">Current fee if withdrawn now</span>
                <span className="font-bold">{feePercent.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════ TRANSACTIONS TAB ═══════════════ */}
        <TabsContent value="transactions" className="space-y-3">
          {transactions.length === 0 ? (
            <Card className="shadow-neu"><CardContent className="p-8 text-center text-muted-foreground text-sm">No transactions yet</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <Card key={tx.id} className="shadow-neu">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {txTypeIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{tx.description || tx.type}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${tx.type === "withdrawal" || tx.type === "purchase" ? "text-destructive" : "text-emerald-500"}`}>
                        {tx.type === "withdrawal" || tx.type === "purchase" ? "-" : "+"}Rs {tx.amount.toLocaleString()}
                      </p>
                      {txStatusBadge(tx.status)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════ PACKAGES TAB ═══════════════ */}
        <TabsContent value="packages" className="space-y-3">
          {userPackages.length === 0 ? (
            <Card className="shadow-neu"><CardContent className="p-8 text-center text-muted-foreground text-sm">No packages purchased</CardContent></Card>
          ) : (
            userPackages.map(pkg => (
              <Card key={pkg.id} className={`shadow-neu ${pkg.is_active ? "ring-1 ring-primary/30" : "opacity-70"}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">{pkg.package_name || "Package"}</p>
                    <Badge className={pkg.is_active ? "bg-emerald-500/15 text-emerald-600 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>
                      {pkg.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/30 rounded-lg px-2 py-1.5">
                      <span className="text-muted-foreground">Paid: </span>
                      <span className="font-semibold">Rs {pkg.price_paid.toLocaleString()}</span>
                    </div>
                    <div className="bg-muted/30 rounded-lg px-2 py-1.5">
                      <span className="text-muted-foreground">Daily income: </span>
                      <span className="font-semibold text-emerald-500">Rs {(pkg.price_paid * 0.05).toFixed(0)}</span>
                    </div>
                    <div className="bg-muted/30 rounded-lg px-2 py-1.5">
                      <span className="text-muted-foreground">Purchased: </span>
                      <span className="font-semibold">{new Date(pkg.purchased_at).toLocaleDateString()}</span>
                    </div>
                    <div className="bg-muted/30 rounded-lg px-2 py-1.5">
                      <span className="text-muted-foreground">Expires: </span>
                      <span className="font-semibold">{pkg.expires_at ? new Date(pkg.expires_at).toLocaleDateString() : "Never"}</span>
                    </div>
                  </div>
                  {pkg.is_active && pkg.expires_at && (
                    <div className="bg-yellow-500/10 rounded-lg px-2 py-1.5 text-xs flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-yellow-500" />
                      <span className="text-yellow-600">
                        {Math.max(0, Math.ceil((new Date(pkg.expires_at).getTime() - Date.now()) / 86400000))} days remaining
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ═══════════════ COMMISSIONS TAB ═══════════════ */}
        <TabsContent value="commissions" className="space-y-3">
          {commissions.length === 0 ? (
            <Card className="shadow-neu"><CardContent className="p-8 text-center text-muted-foreground text-sm">No commissions earned</CardContent></Card>
          ) : (
            <>
              <Card className="shadow-neu">
                <CardContent className="p-4 grid grid-cols-3 gap-2 text-center">
                  {[1, 2, 3].map(tier => {
                    const total = commissions.filter(c => c.tier === tier).reduce((s, c) => s + c.amount, 0);
                    return (
                      <div key={tier} className="bg-muted/30 rounded-xl py-2">
                        <p className="text-[10px] text-muted-foreground">Tier {tier}</p>
                        <p className="text-sm font-bold text-primary">Rs {total.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{commissions.filter(c => c.tier === tier).length} entries</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              <div className="space-y-2">
                {commissions.map(c => (
                  <Card key={c.id} className="shadow-neu">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">T{c.tier}</div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold">{c.source_type || "Commission"}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-500">+Rs {c.amount.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ═══════════════ REFERRALS TAB ═══════════════ */}
        <TabsContent value="referrals" className="space-y-3">
          <Card className="shadow-neu">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Referral Network</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs bg-muted/30 rounded-lg px-3 py-2 flex justify-between">
                <span className="text-muted-foreground">Referred by</span>
                <span className="font-semibold">{referrerName || (profile.referred_by ? "User " + profile.referred_by.slice(0,8) : "Direct signup")}</span>
              </div>
              <div className="text-xs bg-muted/30 rounded-lg px-3 py-2 flex justify-between">
                <span className="text-muted-foreground">Total referrals made</span>
                <span className="font-bold text-primary">{referrals.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[1,2,3].map(tier => (
                  <div key={tier} className="bg-muted/30 rounded-xl py-2">
                    <p className="text-[10px] text-muted-foreground">Tier {tier}</p>
                    <p className="text-sm font-bold">{referrals.filter(r => r.tier === tier).length}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {referrals.length === 0 ? (
            <Card className="shadow-neu"><CardContent className="p-8 text-center text-muted-foreground text-sm">No referrals made</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {referrals.map(r => (
                <Card key={r.id} className="shadow-neu">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">T{r.tier}</div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold">{r.referred_name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{r.referred_id.slice(0,12)}...</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                      <Link to={`/admin/users/${r.referred_id}`}>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary px-2">View →</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════ NOTIFICATIONS TAB ═══════════════ */}
        <TabsContent value="notifications" className="space-y-2">
          {notifications.length === 0 ? (
            <Card className="shadow-neu"><CardContent className="p-8 text-center text-muted-foreground text-sm">No notifications</CardContent></Card>
          ) : (
            notifications.map(n => (
              <Card key={n.id} className={`shadow-neu ${!n.is_read ? "ring-1 ring-primary/30" : "opacity-75"}`}>
                <CardContent className="p-3 flex items-start gap-3">
                  <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${!n.is_read ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{n.title}</p>
                    {n.description && <p className="text-[10px] text-muted-foreground mt-0.5">{n.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <Badge className={`text-[9px] ${n.type === "security" ? "bg-destructive/15 text-destructive" : n.type === "money" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {n.type}
                    </Badge>
                    {!n.is_read && <Badge className="text-[9px] bg-primary/15 text-primary">Unread</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ═══════════════ BANK TAB ═══════════════ */}
        <TabsContent value="bank" className="space-y-3">
          {bankAccounts.length === 0 ? (
            <Card className="shadow-neu"><CardContent className="p-8 text-center text-muted-foreground text-sm">No bank accounts saved</CardContent></Card>
          ) : (
            bankAccounts.map(bank => (
              <Card key={bank.id} className={`shadow-neu ${bank.is_default ? "ring-1 ring-primary/40" : ""}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      <p className="text-sm font-bold text-foreground">{bank.bank_name}</p>
                    </div>
                    {bank.is_default && <Badge className="bg-primary/15 text-primary text-[10px]">Default</Badge>}
                  </div>
                  {[
                    { label: "Account Number", value: bank.account_number },
                    ...(bank.iban ? [{ label: "IBAN", value: bank.iban }] : []),
                    { label: "Added", value: new Date(bank.created_at).toLocaleDateString() },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{item.value}</span>
                        <button onClick={() => copyToClipboard(item.value)} className="text-primary hover:text-primary/70">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ═══════════════ DEVICES TAB ═══════════════ */}
        <TabsContent value="devices" className="space-y-3">
          {deviceLogs.length === 0 ? (
            <Card className="shadow-neu"><CardContent className="p-8 text-center text-muted-foreground text-sm">No device logs found</CardContent></Card>
          ) : (
            <>
              {(() => {
                const ips = [...new Set(deviceLogs.map(d => d.ip_address).filter(Boolean))];
                const fps = [...new Set(deviceLogs.map(d => d.fingerprint).filter(Boolean))];
                return (ips.length > 1 || fps.length > 1) && (
                  <Card className="border-yellow-500/40 bg-yellow-500/5 shadow-neu">
                    <CardContent className="p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold text-yellow-600">Multiple {ips.length > 1 ? "IPs" : ""}{ips.length > 1 && fps.length > 1 ? " & " : ""}{fps.length > 1 ? "Device Fingerprints" : ""} Detected</p>
                        <p className="text-muted-foreground mt-0.5">{ips.length} unique IP(s) · {fps.length} unique fingerprint(s) — possible multi-account activity</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
              <div className="space-y-2">
                {deviceLogs.map(log => (
                  <Card key={log.id} className="shadow-neu">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-3.5 h-3.5 text-primary" />
                          <Badge className="text-[10px] bg-primary/10 text-primary">{log.event_type}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        {[
                          { label: "IP", value: log.ip_address },
                          { label: "Timezone", value: log.timezone },
                          { label: "Screen", value: log.screen_info },
                          { label: "Fingerprint", value: log.fingerprint ? log.fingerprint.slice(0,16) + "..." : null },
                        ].filter(i => i.value).map(item => (
                          <div key={item.label} className="bg-muted/30 rounded-lg px-2 py-1">
                            <span className="text-muted-foreground">{item.label}: </span>
                            <span className="font-mono font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                      {log.user_agent && (
                        <p className="text-[10px] text-muted-foreground truncate bg-muted/20 rounded px-2 py-1">{log.user_agent}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminUserDetail;
