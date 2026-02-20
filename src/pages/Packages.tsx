import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Brain, Database as DbIcon, Cpu, Server, Zap, Star, Loader2, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiPackage {
  id: string;
  name: string;
  description: string | null;
  features: string[];
  price_onetime: number | null;
  price_monthly: number | null;
  cashback_percent: number | null;
  bonus_tag: string | null;
  duration_days: number | null;
  is_active: boolean | null;
}

interface UserPackage {
  id: string;
  package_id: string;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  price_paid: number;
  ai_packages: { name: string; description: string | null } | null;
  actualEarned?: number;
}

const packageIcons = [Brain, DbIcon, Cpu, Server, Zap, Star];

const Packages = () => {
  const { user } = useAuth();
  const [packages, setPackages] = useState<AiPackage[]>([]);
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchParams] = useSearchParams();
  const myPackagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [pkgRes, upRes] = await Promise.all([
        supabase.from("ai_packages").select("*").order("price_monthly", { ascending: true }),
        user ? supabase.from("user_packages").select("*, ai_packages(name, description)").eq("user_id", user.id).order("purchased_at", { ascending: false }) : Promise.resolve({ data: [] }),
      ]);
      const pkgs = (pkgRes.data || []).map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] }));
      setPackages(pkgs as AiPackage[]);

      const rawUserPkgs = (upRes.data || []) as UserPackage[];

      // Fetch actual earned amounts from transactions for each user package
      if (user && rawUserPkgs.length > 0) {
        const { data: earnedTxns } = await supabase
          .from("transactions")
          .select("amount, description, created_at")
          .eq("user_id", user.id)
          .eq("type", "commission")
          .eq("status", "approved")
          .ilike("description", "Daily package income%");

        // Sum all daily package income transactions as total earned
        const totalEarned = (earnedTxns || []).reduce((s: number, t: any) => s + Number(t.amount), 0);

        // Distribute total earned proportionally among packages by their price_paid
        const totalInvested = rawUserPkgs.reduce((s, up) => s + Number(up.price_paid), 0);
        const withEarned = rawUserPkgs.map((up) => ({
          ...up,
          actualEarned: totalInvested > 0
            ? Math.round((Number(up.price_paid) / totalInvested) * totalEarned)
            : 0,
        }));
        setUserPackages(withEarned as UserPackage[]);
      } else {
        setUserPackages(rawUserPkgs);
      }

      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Auto-scroll to My Packages if requested
  useEffect(() => {
    if (!loading && searchParams.get("section") === "my-packages" && myPackagesRef.current) {
      setTimeout(() => {
        myPackagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [loading, searchParams]);

  const handleBuy = async (pkg: AiPackage) => {
    if (!user) return;
    setBuying(pkg.id);
    const { data, error } = await supabase.rpc("purchase_package", { p_package_id: pkg.id });
    if (error) { toast.error("Failed to purchase package"); setBuying(null); return; }
    const result = data as any;
    if (!result?.success) { toast.error(result?.error || "Purchase failed"); setBuying(null); return; }
    const dailyIncome = result.daily_income ?? 0;
    toast.success(`✅ ${pkg.name} purchased! +Rs.${dailyIncome.toLocaleString()} first-day income credited!`);
    // Refresh user packages with actual earned amounts
    const upRes = await supabase.from("user_packages").select("*, ai_packages(name, description)").eq("user_id", user.id).order("purchased_at", { ascending: false });
    const rawUserPkgs = (upRes.data || []) as UserPackage[];
    const { data: earnedTxns } = await supabase.from("transactions").select("amount").eq("user_id", user.id).eq("type", "commission").eq("status", "approved").ilike("description", "Daily package income%");
    const totalEarned = (earnedTxns || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalInvested = rawUserPkgs.reduce((s, up) => s + Number(up.price_paid), 0);
    setUserPackages(rawUserPkgs.map((up) => ({ ...up, actualEarned: totalInvested > 0 ? Math.round((Number(up.price_paid) / totalInvested) * totalEarned) : 0 })));
    setBuying(null);
  };

  // Set of package_ids the user already actively owns
  const ownedPackageIds = new Set(userPackages.filter(up => up.is_active).map(up => up.package_id));

  const filterCategory = (name: string) => {
    if (activeTab === "all") return true;
    const lower = name.toLowerCase();
    if (activeTab === "gpu") return lower.includes("gpu") || lower.includes("cluster");
    if (activeTab === "database") return lower.includes("db") || lower.includes("database") || lower.includes("vector");
    if (activeTab === "nodes") return lower.includes("node") || lower.includes("starter") || lower.includes("query");
    return true;
  };

  if (loading) return <div className="px-4 py-4 space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div></div>;

  const filteredPkgs = packages.filter((p) => filterCategory(p.name));

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4">
        <h1 className="text-lg font-heading font-bold text-foreground mb-4">AI Cloud Market</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {["all", "gpu", "database", "nodes"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                activeTab === tab
                  ? "gradient-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {tab === "all" ? "All" : tab === "gpu" ? "GPU" : tab === "database" ? "Database" : "Nodes"}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 gap-3">
          {filteredPkgs.map((pkg, idx) => {
            const isComingSoon = !pkg.is_active;
            const isOwned = ownedPackageIds.has(pkg.id);
            const price = pkg.price_onetime || pkg.price_monthly || 0;
            const dailyIncome = Math.round(price * 0.05);
            const totalRevenue = dailyIncome * (pkg.duration_days || 30);
            const IconComp = packageIcons[idx % packageIcons.length];
            const isSoldOut = pkg.bonus_tag === "SOLD OUT";

            return (
              <div
                key={pkg.id}
                className={cn(
                  "rounded-2xl overflow-hidden flex flex-col",
                  isComingSoon || isSoldOut ? "bg-muted/60 opacity-60" : "bg-card shadow-neu"
                )}
              >
                <div className={cn(
                  "h-24 flex items-center justify-center relative",
                  isComingSoon || isSoldOut ? "bg-muted" : idx % 3 === 0 ? "gradient-primary" : idx % 3 === 1 ? "gradient-secondary" : "gradient-dark"
                )}>
                  <IconComp className="w-10 h-10 text-primary-foreground/80" />
                  {pkg.bonus_tag && (
                    <Badge className={cn(
                      "absolute top-2 right-2 text-[9px] px-1.5 py-0",
                      pkg.bonus_tag === "HOT" && "bg-destructive text-destructive-foreground",
                      pkg.bonus_tag === "NEW" && "bg-secondary text-secondary-foreground",
                      isSoldOut && "bg-muted-foreground text-muted",
                    )}>
                      {pkg.bonus_tag}
                    </Badge>
                  )}
                </div>

                <div className="p-3 flex flex-col flex-1">
                  <p className="text-xs font-heading font-bold text-foreground leading-tight line-clamp-2">{pkg.name}</p>
                  <p className="text-base font-heading font-bold text-primary mt-1">Rs.{price.toLocaleString()}</p>
                  <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                    <p>Daily: Rs.{dailyIncome}/day</p>
                    <p>Total: Rs.{totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="mt-auto pt-2">
                    {isComingSoon ? (
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-lg block text-center">Coming soon</span>
                    ) : isSoldOut ? (
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-lg block text-center">Sold Out</span>
                    ) : isOwned ? (
                      <span className="text-[10px] text-success bg-success/10 border border-success/30 px-2 py-1 rounded-lg block text-center font-semibold">✓ Active</span>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full rounded-xl gradient-primary text-primary-foreground text-[10px] h-8 font-semibold"
                        onClick={() => handleBuy(pkg)}
                        disabled={buying === pkg.id}
                      >
                        {buying === pkg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Rent Now"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* My Packages */}
        {userPackages.length > 0 && (
          <div className="mt-6" ref={myPackagesRef} id="my-packages">
            <h2 className="text-base font-heading font-bold text-foreground mb-3">📦 My Active Packages</h2>
            <div className="space-y-3">
              {userPackages.map((up) => {
                const dailyIncome = Math.round(up.price_paid * 0.05);
                const totalDays = up.expires_at
                  ? Math.ceil((new Date(up.expires_at).getTime() - new Date(up.purchased_at).getTime()) / 86400000)
                  : 30;
                // Calculate remaining days directly from expiry (same as admin view)
                const daysRemaining = up.expires_at
                  ? Math.max(0, Math.ceil((new Date(up.expires_at).getTime() - Date.now()) / 86400000))
                  : 30;
                const daysElapsed = Math.max(0, totalDays - daysRemaining);
                const progressPct = Math.round((daysElapsed / totalDays) * 100);
                const totalRevenue = dailyIncome * totalDays;
                

                return (
                  <div key={up.id} className="shadow-neu rounded-2xl bg-card overflow-hidden">
                    <div className={cn(
                      "px-4 py-3 flex items-center justify-between",
                      up.is_active ? "gradient-primary" : "bg-muted"
                    )}>
                      <div className="flex items-center gap-2">
                        <Package className={cn("w-5 h-5", up.is_active ? "text-primary-foreground" : "text-muted-foreground")} />
                        <p className={cn("text-sm font-heading font-bold", up.is_active ? "text-primary-foreground" : "text-muted-foreground")}>
                          {(up.ai_packages as any)?.name || "Package"}
                        </p>
                      </div>
                      <Badge className={cn(
                        "text-[10px] px-2",
                        up.is_active ? "bg-white/20 text-primary-foreground border-white/30" : "bg-muted text-muted-foreground"
                      )}>
                        {up.is_active ? "Active" : "Expired"}
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Invested</p>
                          <p className="text-sm font-heading font-bold text-foreground">Rs.{up.price_paid.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Daily Income</p>
                          <p className="text-sm font-heading font-bold text-success">Rs.{dailyIncome}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total Revenue</p>
                          <p className="text-sm font-heading font-bold text-foreground">Rs.{totalRevenue.toLocaleString()}</p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Earned: Rs.{(up.actualEarned ?? 0).toLocaleString()}</span>
                          <span>{daysRemaining}d remaining</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Purchased: {new Date(up.purchased_at).toLocaleDateString()}</span>
                        {up.expires_at && <span>Expires: {new Date(up.expires_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Packages;
