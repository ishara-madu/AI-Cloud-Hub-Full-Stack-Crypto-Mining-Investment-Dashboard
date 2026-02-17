import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Package, Cpu, Database, Cloud, Zap, ShoppingCart, CheckCircle2, Loader2 } from "lucide-react";
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
}

interface UserPackage {
  id: string;
  package_id: string;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  price_paid: number;
  ai_packages: { name: string; description: string | null } | null;
}

const featureIcons: Record<string, typeof Cpu> = {
  gpu: Cpu, storage: Database, cloud: Cloud, default: Zap,
};

const Packages = () => {
  const { user } = useAuth();
  const [packages, setPackages] = useState<AiPackage[]>([]);
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [pkgRes, upRes] = await Promise.all([
        supabase.from("ai_packages").select("*").eq("is_active", true).order("price_monthly", { ascending: true }),
        user ? supabase.from("user_packages").select("*, ai_packages(name, description)").eq("user_id", user.id).order("purchased_at", { ascending: false }) : Promise.resolve({ data: [] }),
      ]);
      const pkgs = (pkgRes.data || []).map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
      }));
      setPackages(pkgs as AiPackage[]);
      setUserPackages((upRes.data || []) as UserPackage[]);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleBuy = async (pkg: AiPackage) => {
    if (!user) return;
    const price = pkg.price_onetime || pkg.price_monthly || 0;
    setBuying(pkg.id);

    // Check balance
    const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
    const bal = wallet?.balance ? Number(wallet.balance) : 0;
    if (bal < price) {
      toast.error("Insufficient balance. Please deposit funds first.");
      setBuying(null);
      return;
    }

    // Create user package
    const expiresAt = pkg.duration_days ? new Date(Date.now() + pkg.duration_days * 86400000).toISOString() : null;
    const { error } = await supabase.from("user_packages").insert({
      user_id: user.id, package_id: pkg.id, price_paid: price, expires_at: expiresAt,
    });

    if (!error) {
      // Deduct balance
      await supabase.from("wallets").update({
        balance: bal - price,
      }).eq("user_id", user.id);

      // Log transaction
      await supabase.from("transactions").insert({
        user_id: user.id, type: "purchase" as const, amount: price, status: "approved" as const,
        description: `Purchased ${pkg.name}`,
      });

      toast.success(`Successfully purchased ${pkg.name}!`);
      // Refresh
      const upRes = await supabase.from("user_packages").select("*, ai_packages(name, description)").eq("user_id", user.id).order("purchased_at", { ascending: false });
      setUserPackages((upRes.data || []) as UserPackage[]);
    } else {
      toast.error("Failed to purchase package");
    }
    setBuying(null);
  };

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-heading font-bold text-foreground">AI Packages Mall</h1>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse Packages</TabsTrigger>
          <TabsTrigger value="my">My Packages ({userPackages.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6">
          {packages.length === 0 ? (
            <Card className="shadow-card text-center"><CardContent className="py-12"><Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No packages available yet</p></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <Card key={pkg.id} className="shadow-card hover:shadow-card-hover transition-all border-border/50 flex flex-col relative overflow-hidden">
                  {pkg.bonus_tag && (
                    <div className="absolute top-3 right-3">
                      <Badge className="gradient-secondary text-secondary-foreground">{pkg.bonus_tag}</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                      <Package className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="font-heading">{pkg.name}</CardTitle>
                    {pkg.description && <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>}
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2 mb-4">
                      {pkg.features.map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          <span className="text-foreground">{f}</span>
                        </div>
                      ))}
                    </div>
                    {pkg.cashback_percent && pkg.cashback_percent > 0 && (
                      <Badge variant="outline" className="text-success border-success/30">{pkg.cashback_percent}% Cashback</Badge>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-3 border-t border-border/50 pt-4">
                    <div className="w-full flex items-baseline gap-2">
                      {pkg.price_onetime && <span className="text-2xl font-heading font-bold text-foreground">${pkg.price_onetime}</span>}
                      {pkg.price_monthly && <span className="text-sm text-muted-foreground">${pkg.price_monthly}/mo</span>}
                    </div>
                    <Button
                      className="w-full gradient-primary text-primary-foreground"
                      onClick={() => handleBuy(pkg)}
                      disabled={buying === pkg.id}
                    >
                      {buying === pkg.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><ShoppingCart className="w-4 h-4 mr-2" />Buy Package</>}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my" className="mt-6">
          {userPackages.length === 0 ? (
            <Card className="shadow-card text-center"><CardContent className="py-12"><Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No purchased packages yet</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {userPackages.map((up) => (
                <Card key={up.id} className="shadow-card border-border/50">
                  <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="font-medium text-foreground">{(up.ai_packages as any)?.name || "Package"}</p>
                      <p className="text-sm text-muted-foreground">Purchased {new Date(up.purchased_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">${up.price_paid.toFixed(2)}</span>
                      <Badge className={up.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {up.is_active ? "Active" : "Expired"}
                      </Badge>
                      {up.expires_at && (
                        <span className="text-xs text-muted-foreground">Expires {new Date(up.expires_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Packages;
