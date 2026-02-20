import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft, ShieldAlert, AlertTriangle, UserX, Globe, Monitor,
  Check, Loader2, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const RESOLVE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

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

const getCooldownKey = (id: string) => `alert_resolved_${id}`;

const isInCooldown = (id: string): boolean => {
  const ts = localStorage.getItem(getCooldownKey(id));
  if (!ts) return false;
  return Date.now() - Number(ts) < RESOLVE_COOLDOWN_MS;
};

const setCooldown = (id: string) => {
  localStorage.setItem(getCooldownKey(id), String(Date.now()));
};

const AdminAlerts = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, { name: string; isFrozen: boolean }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    const [alertsRes, profilesRes] = await Promise.all([
      supabase.from("admin_alerts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("user_id, display_name, is_frozen"),
    ]);

    const profileMap = new Map(
      (profilesRes.data || []).map((p: any) => [p.user_id, { name: p.display_name, isFrozen: p.is_frozen }])
    );
    setProfiles(profileMap);
    setAlerts(alertsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  // Run fraud scan
  const runFraudScan = async () => {
    setLoading(true);
    const { data: logs } = await supabase.from("device_logs").select("*").order("created_at", { ascending: false }).limit(1000);
    if (!logs || logs.length === 0) { setLoading(false); toast.info("No device logs to analyze"); return; }

    const newAlerts: any[] = [];

    const ipMap = new Map<string, Set<string>>();
    logs.forEach(l => {
      if (!l.ip_address || l.ip_address === "unknown") return;
      if (!ipMap.has(l.ip_address)) ipMap.set(l.ip_address, new Set());
      ipMap.get(l.ip_address)!.add(l.user_id);
    });
    ipMap.forEach((users, ip) => {
      if (users.size > 1) {
        const userIds = Array.from(users);
        const names = userIds.map(id => profiles.get(id)?.name || id.slice(0, 8)).join(", ");
        newAlerts.push({
          alert_type: "same_ip", severity: "warning",
          title: `Same IP detected: ${ip}`,
          description: `${users.size} accounts using same IP: ${names}`,
          related_user_ids: userIds,
        });
      }
    });

    const fpMap = new Map<string, Set<string>>();
    logs.forEach(l => {
      if (!l.fingerprint) return;
      if (!fpMap.has(l.fingerprint)) fpMap.set(l.fingerprint, new Set());
      fpMap.get(l.fingerprint)!.add(l.user_id);
    });
    fpMap.forEach((users, fp) => {
      if (users.size > 1) {
        const userIds = Array.from(users);
        const names = userIds.map(id => profiles.get(id)?.name || id.slice(0, 8)).join(", ");
        newAlerts.push({
          alert_type: "same_device", severity: "critical",
          title: `Same device/browser detected`,
          description: `${users.size} accounts on same device (fingerprint: ${fp.slice(0, 8)}): ${names}`,
          related_user_ids: userIds,
        });
      }
    });

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
            description: `User ${profiles.get(wd.user_id)?.name || wd.user_id.slice(0, 8)} requesting Rs ${Number(wd.amount).toLocaleString()} (balance: Rs ${Number(wallet.balance).toLocaleString()})`,
            related_user_ids: [wd.user_id],
          });
        }
      });
    }

    if (newAlerts.length > 0) {
      for (const alert of newAlerts) {
        const { data: existing } = await supabase.from("admin_alerts").select("id")
          .eq("alert_type", alert.alert_type).eq("title", alert.title).maybeSingle();
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
    setExpandedId(null);
    fetchAlerts();
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );

  // Filter: not resolved + related users not all banned + not in 5-min cooldown
  const unresolvedAlerts = alerts.filter(a => {
    if (a.is_resolved) return false;
    if (isInCooldown(a.id)) return false;
    // Hide if ALL related users are banned
    if (a.related_user_ids?.length > 0) {
      const allBanned = a.related_user_ids.every((id: string) => profiles.get(id)?.isFrozen === true);
      if (allBanned) return false;
    }
    return true;
  });

  const resolvedAlerts = alerts.filter(a => a.is_resolved);

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Fraud Alerts</h1>
            <p className="text-xs text-muted-foreground">{unresolvedAlerts.length} active alert{unresolvedAlerts.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Button className="rounded-xl gradient-primary text-primary-foreground" onClick={runFraudScan}>
          <ShieldAlert className="w-4 h-4 mr-2" /> Run Fraud Scan
        </Button>
      </div>

      {unresolvedAlerts.length === 0 && (
        <div className="text-center py-16">
          <ShieldAlert className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium text-foreground mb-1">No active alerts</p>
          <p className="text-xs text-muted-foreground">Run a fraud scan to check for suspicious activity</p>
        </div>
      )}

      {/* Active Alerts */}
      <div className="space-y-3">
        {unresolvedAlerts.map(alert => {
          const Icon = typeIcons[alert.alert_type] || ShieldAlert;
          const isExpanded = expandedId === alert.id;
          const relatedUsers = (alert.related_user_ids || []).filter(
            (id: string) => !profiles.get(id)?.isFrozen
          );

          return (
            <div
              key={alert.id}
              className="rounded-2xl border border-destructive/20 bg-card shadow-neu overflow-hidden"
            >
              {/* Clickable header row */}
              <button
                className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : alert.id)}
              >
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground">{alert.title}</p>
                    <Badge className={cn("text-[9px] shrink-0 border", severityColors[alert.severity])}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{alert.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </p>
                </div>
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                }
              </button>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className="border-t border-border/60 bg-muted/20 p-4 space-y-4 animate-fade-in">
                  {/* Full description */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
                    <p className="text-sm text-foreground leading-relaxed">{alert.description}</p>
                  </div>

                  {/* Per-user cards */}
                  {relatedUsers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Involved Users ({relatedUsers.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {relatedUsers.map((userId: string) => {
                          const profile = profiles.get(userId);
                          return (
                            <div
                              key={userId}
                              className="flex items-center justify-between gap-2 bg-card rounded-xl px-3 py-2 border border-border"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {profile?.name || "Unknown User"}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono truncate">{userId.slice(0, 12)}…</p>
                              </div>
                              <Link to={`/admin/users/${userId}?ban_reason=${encodeURIComponent(`Fraud Alert: ${alert.title} — ${alert.description || ''}`)}`}>
                                <Button size="sm" variant="outline" className="rounded-lg text-xs shrink-0 h-7 px-2 gap-1">
                                  <ExternalLink className="w-3 h-3" />
                                  View
                                </Button>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-[10px] text-muted-foreground">
                    Created: {new Date(alert.created_at).toLocaleString()}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs"
                      onClick={() => handleResolve(alert.id)}
                      disabled={processing === alert.id}
                    >
                      {processing === alert.id
                        ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        : <Check className="w-3 h-3 mr-1" />
                      }
                      Mark Resolved
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resolved */}
      {resolvedAlerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-heading font-bold text-muted-foreground">
            Resolved ({resolvedAlerts.length})
          </h2>
          {resolvedAlerts.slice(0, 10).map(alert => (
            <div key={alert.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl text-xs border border-border/40">
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
