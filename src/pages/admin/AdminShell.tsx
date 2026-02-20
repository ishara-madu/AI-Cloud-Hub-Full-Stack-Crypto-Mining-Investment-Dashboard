import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, ArrowDownToLine, ArrowUpFromLine,
  Package, Gift, Image as ImageIcon, Settings, ShieldAlert,
  Package2, Menu, X, ChevronRight, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import AdminNotificationBell from "@/components/AdminNotificationBell";
import { toast } from "sonner";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Deposits", to: "/admin/deposits", icon: ArrowDownToLine },
  { label: "Withdrawals", to: "/admin/withdrawals", icon: ArrowUpFromLine },
  { label: "Packages", to: "/admin/packages", icon: Package },
  { label: "User Packages", to: "/admin/user-packages", icon: Package2 },
  { label: "Redeem Codes", to: "/admin/redeem-codes", icon: Gift },
  { label: "Sliders", to: "/admin/sliders", icon: ImageIcon },
  { label: "Alerts", to: "/admin/alerts", icon: ShieldAlert },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

const SidebarContent = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-heading font-bold text-foreground text-sm">Admin Panel</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto text-primary" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border/50">
        <Link to="/dashboard" onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
          <LogOut className="w-4 h-4" />
          <span>Back to App</span>
        </Link>
      </div>
    </div>
  );
};

const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const lastScanPath = useRef<string>("");
  const scanRunning = useRef(false);

  const runAutoFraudScan = useCallback(async () => {
    if (scanRunning.current) return;
    scanRunning.current = true;
    try {
      const [{ data: logs }, { data: profilesData }] = await Promise.all([
        supabase.from("device_logs").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("profiles").select("user_id, display_name, is_frozen"),
      ]);
      if (!logs || logs.length === 0) { scanRunning.current = false; return; }

      const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
      const newAlerts: any[] = [];

      // Check IPs
      const ipMap = new Map<string, Set<string>>();
      logs.forEach(l => {
        if (!l.ip_address || l.ip_address === "unknown") return;
        if (!ipMap.has(l.ip_address)) ipMap.set(l.ip_address, new Set());
        ipMap.get(l.ip_address)!.add(l.user_id);
      });
      ipMap.forEach((users, ip) => {
        if (users.size > 1) {
          const userIds = Array.from(users);
          const names = userIds.map(id => (profileMap.get(id) as any)?.display_name || id.slice(0, 8)).join(", ");
          newAlerts.push({
            alert_type: "same_ip", severity: "warning",
            title: `Same IP detected: ${ip}`,
            description: `${users.size} accounts using same IP: ${names}`,
            related_user_ids: userIds,
          });
        }
      });

      // Check fingerprints
      const fpMap = new Map<string, Set<string>>();
      logs.forEach(l => {
        if (!l.fingerprint) return;
        if (!fpMap.has(l.fingerprint)) fpMap.set(l.fingerprint, new Set());
        fpMap.get(l.fingerprint)!.add(l.user_id);
      });
      fpMap.forEach((users, fp) => {
        if (users.size > 1) {
          const userIds = Array.from(users);
          const names = userIds.map(id => (profileMap.get(id) as any)?.display_name || id.slice(0, 8)).join(", ");
          newAlerts.push({
            alert_type: "same_device", severity: "critical",
            title: `Same device/browser detected`,
            description: `${users.size} accounts on same device (fingerprint: ${fp.slice(0, 8)}): ${names}`,
            related_user_ids: userIds,
          });
        }
      });

      // Insert only new alerts
      if (newAlerts.length > 0) {
        let inserted = 0;
        for (const alert of newAlerts) {
          const { data: existing } = await supabase.from("admin_alerts").select("id")
            .eq("alert_type", alert.alert_type).eq("title", alert.title).maybeSingle();
          if (!existing) {
            await supabase.from("admin_alerts").insert(alert);
            inserted++;
          }
        }
        if (inserted > 0) {
          toast.warning(`🔍 Auto-scan: ${inserted} new fraud alert(s) detected`, { duration: 5000 });
        }
      }
    } catch (err) {
      console.error("Auto fraud scan error:", err);
    }
    scanRunning.current = false;
  }, []);

  // Run fraud scan on every admin page navigation
  useEffect(() => {
    if (location.pathname !== lastScanPath.current) {
      lastScanPath.current = location.pathname;
      runAutoFraudScan();
    }
  }, [location.pathname, runAutoFraudScan]);
  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border/60 bg-card/50 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border/60 shadow-xl transition-transform duration-300 lg:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Bar */}
        <header className="lg:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 bg-card/80 backdrop-blur-sm border-b border-border/60">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                <LayoutDashboard className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-sm text-foreground">Admin Panel</span>
            </div>
          </div>
          <AdminNotificationBell />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto pb-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminShell;
