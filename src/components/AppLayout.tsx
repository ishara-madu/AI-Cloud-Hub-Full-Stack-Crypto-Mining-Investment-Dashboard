import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Home, Package, ShoppingCart, Users, User, Settings as SettingsIcon,
} from "lucide-react";

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

  const maskedPhone = user?.phone
    ? user.phone.slice(0, 1) + "******" + user.phone.slice(-3)
    : "7******402";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">{maskedPhone}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">EN / සිංහල</span>
            <Link to="/settings">
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </header>

      {/* Page content — padded for bottom nav */}
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
