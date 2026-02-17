import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft, ShieldAlert, AlertTriangle, UserX, Globe, Monitor,
  Check, Loader2, Calendar, Ban,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const severityColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-500 border-red-500/30",
  warning: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  info: "bg-blue-500/20 text-blue-600 border-blue-500/30",
};

const typeIcons: Record<string, any> = {
  same_ip: Globe,
  same_device: Monitor,
  same_browser: Monitor,
  impossible_withdrawal: AlertTriangle,
  multi_account: UserX,
};

const AdminAlerts = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [banDays, setBanDays] = useState("");
  const [showBanFor, setShowBanFor] = useState<string | null>(null);

  const fetchAlerts = async () => {
    const [alertsRes, profilesRes] = await Promise.all([
      supabase.from("admin_alerts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("user_id, display_name"),
    ]);
    setProfiles(new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.display_name])));
    setAlerts(alertsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  // Scan for fraud patterns
  const runFraudScan = async () => {
    setLoading(true);
    const { data: logs } = await supabase.from("device_logs").select("*").order("created_at", { ascending: false }).limit(1000);
    if (!logs || logs.length === 0) { setLoading(false); toast.info("No device logs to analyze"); return; }

    const newAlerts: any[] = [];

    // Group by IP
    const ipMap = new Map<string, Set<string>>();
    logs.forEach(l => {
      if (!l.ip_address || l.ip_address === "unknown") return;
      if (!ipMap.has(l.ip_address)) ipMap.set(l.ip_address, new Set());
      ipMap.get(l.ip_address)!.add(l.user_id);
    });
    ipMap.forEach((users, ip) => {
      if (users.size > 1) {
        const userIds = Array.from(users);
        const names = userIds.map(id => profiles.get(id) || id.slice(0, 8)).join(", ");
        newAlerts.push({
          alert_type: "same_ip", severity: "warning",
          title: `Same IP detected: ${ip}`,
          description: `${users.size} accounts using same IP: ${names}`,
          related_user_ids: userIds,
        });
      }
    });

    // Group by fingerprint
    const fpMap = new Map<string, Set<string>>();
    logs.forEach(l => {
      if (!l.fingerprint) return;
      if (!fpMap.has(l.fingerprint)) fpMap.set(l.fingerprint, new Set());
      fpMap.get(l.fingerprint)!.add(l.user_id);
    });
    fpMap.forEach((users, fp) => {
      if (users.size > 1) {
        const userIds = Array.from(users);
        const names = userIds.map(id => profiles.get(id) || id.slice(0, 8)).join(", ");
        newAlerts.push({
          alert_type: "same_device", severity: "critical",
          title: `Same device/browser detected`,
          description: `${users.size} accounts on same device (fingerprint: ${fp.slice(0, 8)}): ${names}`,
          related_user_ids: userIds,
        });
      }
    });

    // Check impossible withdrawals
    const { data: pendingWd } = await supabase.from("withdrawal_requests").select("user_id, amount").eq("status", "pending");
    const { data: wallets } = await supabase.from("wallets").select("user_id, balance, total_deposited");
    if (pendingWd && wallets) {
      const walletMap = new Map(wallets.map(w => [w.user_id, w]));
      pendingWd.forEach(wd => {
        const wallet = walletMap.get(wd.user_id);
        if (wallet && Number(wd.amount) > Number(wallet.balance) * 1.5) {
          newAlerts.push({
            alert_type: "impossible_withdrawal", severity: "critical",
            title: `Suspicious withdrawal: Rs ${Number(wd.amount).toLocaleString()}`,
            description: `User ${profiles.get(wd.user_id) || wd.user_id.slice(0, 8)} requesting Rs ${Number(wd.amount).toLocaleString()} (balance: Rs ${Number(wallet.balance).toLocaleString()})`,
            related_user_ids: [wd.user_id],
          });
        }
      });
    }

    // Insert alerts (avoid duplicates by checking recent)
    if (newAlerts.length > 0) {
      for (const alert of newAlerts) {
        const { data: existing } = await supabase.from("admin_alerts").select("id")
          .eq("alert_type", alert.alert_type).eq("title", alert.title).eq("is_resolved", false).maybeSingle();
        if (!existing) {
          await supabase.from("admin_alerts").insert(alert);
        }
      }
      toast.success(`Found ${newAlerts.length} potential issues`);
    } else {
      toast.info("No suspicious activity detected");
    }

    fetchAlerts();
  };

  const handleResolve = async (id: string) => {
    setProcessing(id);
    await supabase.from("admin_alerts").update({ is_resolved: true }).eq("id", id);
    toast.success("Alert resolved");
    setProcessing(null);
    fetchAlerts();
  };

  const handleBanUsers = async (userIds: string[], permanent: boolean) => {
    for (const userId of userIds) {
      await supabase.from("profiles").update({ is_frozen: true }).eq("user_id", userId);
      await supabase.from("notifications").insert({
        user_id: userId, type: "security",
        title: permanent ? "Account Permanently Banned 🚫" : `Account Temporarily Banned 🔒`,
        description: permanent
          ? "Your account has been permanently banned due to policy violations."
          : `Your account has been temporarily banned for ${banDays} days due to suspicious activity.`,
      });
    }
    toast.success(`${userIds.length} user(s) banned`);
    setBanDays("");
    setShowBanFor(null);
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-40" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;

  const unresolvedAlerts = alerts.filter(a => !a.is_resolved);
  const resolvedAlerts = alerts.filter(a => a.is_resolved);

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="text-2xl font-heading font-bold text-foreground">Fraud Alerts</h1>
        </div>
        <Button className="rounded-xl gradient-primary text-primary-foreground" onClick={runFraudScan}>
          <ShieldAlert className="w-4 h-4 mr-2" /> Run Fraud Scan
        </Button>
      </div>

      {unresolvedAlerts.length === 0 && (
        <div className="text-center py-12">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No active alerts. Run a fraud scan to check for suspicious activity.</p>
        </div>
      )}

      {/* Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {unresolvedAlerts.map(alert => {
          const Icon = typeIcons[alert.alert_type] || ShieldAlert;
          return (
            <Card key={alert.id} className="shadow-neu border-0 ring-1 ring-destructive/20">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                    </div>
                  </div>
                  <Badge className={cn("text-[9px] shrink-0", severityColors[alert.severity])}>{alert.severity}</Badge>
                </div>

                {/* Related users */}
                {alert.related_user_ids?.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Users: </span>
                    {alert.related_user_ids.map((id: string) => profiles.get(id) || id.slice(0, 8)).join(", ")}
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground">{new Date(alert.created_at).toLocaleString()}</div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => handleResolve(alert.id)} disabled={processing === alert.id}>
                    {processing === alert.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Resolve</>}
                  </Button>
                  {alert.related_user_ids?.length > 0 && (
                    <>
                      <Button size="sm" variant="destructive" className="rounded-xl text-xs" onClick={() => setShowBanFor(showBanFor === alert.id ? null : alert.id)}>
                        <Ban className="w-3 h-3 mr-1" /> Ban Users
                      </Button>
                    </>
                  )}
                </div>

                {/* Ban options */}
                {showBanFor === alert.id && (
                  <div className="bg-destructive/5 rounded-xl p-3 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <div className="space-y-1 flex-1">
                        <Label className="text-xs">Temporary Ban (days)</Label>
                        <div className="flex gap-2">
                          <Input type="number" min="1" className="rounded-xl h-8 text-xs" placeholder="Days" value={banDays} onChange={(e) => setBanDays(e.target.value)} />
                          <Button size="sm" className="rounded-xl text-xs" onClick={() => handleBanUsers(alert.related_user_ids, false)} disabled={!banDays}>
                            <Calendar className="w-3 h-3 mr-1" />Temp Ban
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="destructive" className="w-full rounded-xl text-xs" onClick={() => handleBanUsers(alert.related_user_ids, true)}>
                      <Ban className="w-3 h-3 mr-1" /> Permanent Ban All
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resolved */}
      {resolvedAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-heading font-bold text-muted-foreground">Resolved ({resolvedAlerts.length})</h2>
          {resolvedAlerts.slice(0, 10).map(alert => (
            <div key={alert.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl text-xs">
              <div>
                <p className="font-medium text-muted-foreground">{alert.title}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(alert.created_at).toLocaleDateString()}</p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-600 text-[9px]">Resolved</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAlerts;
