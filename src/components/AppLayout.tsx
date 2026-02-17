import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Home, Package, ShoppingCart, Users, User, Bell, X,
} from "lucide-react";
import { notifications, typeEmoji } from "@/data/notifications";

const bottomNav = [
  { label: "Home", icon: Home, path: "/dashboard" },
  { label: "Packages", icon: Package, path: "/packages" },
  { label: "Mall", icon: ShoppingCart, path: "/transactions" },
  { label: "Team", icon: Users, path: "/team" },
  { label: "My", icon: User, path: "/settings" },
];

const popupNotifications = notifications.slice(0, 3);

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [vipLevel, setVipLevel] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("wallets").select("total_deposited").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      const deposited = data?.total_deposited ? Number(data.total_deposited) : 0;
      const thresholds = [0, 1000, 5000, 15000, 50000, 100000];
      setVipLevel(thresholds.filter((t) => deposited >= t).length - 1);
    });
  }, [user]);

  const maskedEmail = user?.email
    ? user.email.split("@")[0].slice(0, 3) + "***@" + user.email.split("@")[1]
    : "user@email.com";

  const isProfilePage = location.pathname === "/settings";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header — hidden on Profile page */}
      {!isProfilePage && (
        <header className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">{maskedEmail}</span>
              <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px] px-1.5 py-0 font-bold">VIP {vipLevel}</Badge>
            </div>
            <button
              onClick={() => setShowNotifs(true)}
              className="relative w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-card" />
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
              {popupNotifications.map((n) => (
                <div key={n.id} className="shadow-neu-inset rounded-xl bg-muted/20 p-3 space-y-1">
                  <div className="flex items-start gap-2.5">
                    <span className="text-sm mt-0.5">{typeEmoji[n.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-heading font-bold text-foreground truncate">{n.title}</p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{n.desc}</p>
                    </div>
                  </div>
                </div>
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

      {/* Page content */}
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16">
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
  );
};

export default AppLayout;
