import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Home, Package, ShoppingCart, Users, User, Bell, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const typeEmoji: Record<string, string> = {
  money: "💰",
  security: "🔒",
  system: "📢",
  promo: "🎁",
  update: "🚀",
};

const bottomNav = [
  { label: "Home", icon: Home, path: "/dashboard" },
  { label: "Packages", icon: Package, path: "/packages" },
  { label: "Mall", icon: ShoppingCart, path: "/transactions" },
  { label: "Team", icon: Users, path: "/team" },
  { label: "My", icon: User, path: "/settings" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
  const [vipLevel, setVipLevel] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [walletRes, unreadRes, recentRes] = await Promise.all([
        supabase.from("wallets").select("total_deposited").eq("user_id", user.id).maybeSingle(),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      ]);
      const deposited = walletRes.data?.total_deposited ? Number(walletRes.data.total_deposited) : 0;
      const thresholds = [0, 1000, 5000, 15000, 50000, 100000];
      setVipLevel(thresholds.filter((t) => deposited >= t).length - 1);
      setUnreadCount(unreadRes.count || 0);
      setRecentNotifs(recentRes.data || []);

      // Auto-cleanup: delete notifications older than 1 month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      await supabase.from("notifications").delete()
        .eq("user_id", user.id)
        .lt("created_at", oneMonthAgo.toISOString());
    };
    fetchData();
  }, [user, location.pathname]);

  const maskedEmail = user?.email
    ? (() => {
        const [local, domain] = user.email.split("@");
        return local.slice(0, 3) + "***@" + domain;
      })()
    : "user@email.com";

  const isProfilePage = location.pathname === "/settings";

  return (
    <div className="min-h-screen bg-white flex justify-center">
    <div className="w-full max-w-[425px] min-h-screen bg-background flex flex-col relative">
      {/* Top header — hidden on Profile page */}
      {!isProfilePage && (
        <header className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
              {(() => {
                const isGoogleUser = user?.app_metadata?.provider === "google" || user?.app_metadata?.providers?.includes("google");
                const googleAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
                if (isGoogleUser && googleAvatar) {
                  return <img src={googleAvatar} alt="Profile" className="w-9 h-9 rounded-full object-cover" />;
                }
                const initial = (user?.user_metadata?.display_name || user?.email || "U").charAt(0).toUpperCase();
                return (
                  <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                    {initial}
                  </div>
                );
              })()}
              <span className="text-sm font-medium text-foreground">{maskedEmail}</span>
              <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px] px-1.5 py-0 font-bold">VIP {vipLevel}</Badge>
            </div>
            <button
              onClick={() => setShowNotifs(true)}
              className="relative w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive rounded-full border-2 border-card flex items-center justify-center">
                  <span className="text-[9px] text-destructive-foreground font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                </span>
              )}
            </button>
          </div>
        </header>
      )}

      {/* Notification Modal */}
      {showNotifs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => setShowNotifs(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm shadow-neu rounded-2xl bg-card p-5 space-y-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-heading font-bold text-foreground">🔔 Notifications</h3>
              <button onClick={() => setShowNotifs(false)} className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              {recentNotifs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No notifications</p>}
              {recentNotifs.map((n) => (
                <button
                  key={n.id}
                  onClick={async () => {
                    setSelectedNotif(n);
                    if (!n.is_read) {
                      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
                      setRecentNotifs(prev => prev.map(notif => notif.id === n.id ? { ...notif, is_read: true } : notif));
                      setUnreadCount(prev => Math.max(0, prev - 1));
                    }
                  }}
                  className={cn(
                    "w-full text-left rounded-xl p-3 space-y-1 transition-colors",
                    !n.is_read
                      ? "bg-primary/5 ring-1 ring-primary/20 border-l-4 border-l-primary shadow-neu"
                      : "shadow-neu-inset bg-muted/20 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="relative">
                      <span className="text-sm mt-0.5">{typeEmoji[n.type] || "📢"}</span>
                      {!n.is_read && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-xs font-heading truncate", !n.is_read ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>{n.title}</p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1">{n.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowNotifs(false); navigate("/notifications"); }}
              className="w-full text-center text-xs font-semibold text-primary py-2 hover:underline"
            >
              See All Notifications →
            </button>
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-6" onClick={() => setSelectedNotif(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm shadow-neu rounded-2xl bg-card p-5 space-y-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                  {typeEmoji[selectedNotif.type] || "📢"}
                </div>
                <div>
                  <p className="text-sm font-heading font-bold text-foreground">{selectedNotif.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(selectedNotif.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedNotif(null)} className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-sm text-foreground leading-relaxed">{selectedNotif.description || "No additional details."}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">{new Date(selectedNotif.created_at).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex justify-center bg-white border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 w-full max-w-[425px] bg-card">
          {bottomNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px]",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", active && "drop-shadow-sm")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </div>
  );
};

export default AppLayout;
