import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Search, Package, X, Check, Clock, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const AdminUserPackages = () => {
  const [userPackages, setUserPackages] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [packages, setPackages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = async () => {
    const [upRes, profilesRes, pkgRes] = await Promise.all([
      supabase.from("user_packages").select("*").order("purchased_at", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name"),
      supabase.from("ai_packages").select("id, name"),
    ]);
    setProfiles(new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.display_name])));
    setPackages(new Map((pkgRes.data || []).map((p: any) => [p.id, p.name])));
    setUserPackages(upRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggleActive = async (id: string, current: boolean, userId: string) => {
    setProcessing(id);
    await supabase.from("user_packages").update({ is_active: !current }).eq("id", id);
    await supabase.from("notifications").insert({
      user_id: userId, type: "system",
      title: current ? "Package Deactivated" : "Package Reactivated",
      description: current ? "One of your packages has been deactivated by admin." : "One of your packages has been reactivated by admin.",
    });
    toast.success(current ? "Package deactivated" : "Package activated");
    setProcessing(null);
    fetchData();
  };

  const handleExtend = async (id: string, userId: string, currentExpiry: string | null) => {
    setProcessing(id);
    const newExpiry = new Date(currentExpiry || new Date());
    newExpiry.setDate(newExpiry.getDate() + 30);
    await supabase.from("user_packages").update({ expires_at: newExpiry.toISOString() }).eq("id", id);
    await supabase.from("notifications").insert({
      user_id: userId, type: "system",
      title: "Package Extended",
      description: "Your package has been extended by 30 days by admin.",
    });
    toast.success("Package extended by 30 days");
    setProcessing(null);
    fetchData();
  };

  const filtered = userPackages.filter(up => {
    const q = search.toLowerCase();
    if (!q) return true;
    const userName = profiles.get(up.user_id)?.toLowerCase() || "";
    const pkgName = packages.get(up.package_id)?.toLowerCase() || "";
    return userName.includes(q) || pkgName.includes(q) || up.user_id.includes(q);
  });

  if (loading) return <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-2xl font-heading font-bold text-foreground">User Packages ({userPackages.length})</h1>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 rounded-xl" placeholder="Search by user, package..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(up => (
          <Card key={up.id} className={`shadow-neu ${!up.is_active ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{packages.get(up.package_id) || "Unknown"}</p>
                    <p className="text-[10px] text-muted-foreground">{profiles.get(up.user_id) || "User"} • Rs {Number(up.price_paid).toLocaleString()}</p>
                  </div>
                </div>
                <Badge className={up.is_active ? "bg-emerald-500/20 text-emerald-600 text-[9px]" : "bg-red-500/20 text-red-500 text-[9px]"}>
                  {up.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mb-3 flex items-center gap-3">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(up.purchased_at).toLocaleDateString()}</span>
                {up.expires_at && <span>Expires: {new Date(up.expires_at).toLocaleDateString()}</span>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={up.is_active ? "destructive" : "default"} className="flex-1 rounded-xl text-xs" disabled={processing === up.id}
                  onClick={() => handleToggleActive(up.id, up.is_active, up.user_id)}>
                  {processing === up.id ? <Loader2 className="w-3 h-3 animate-spin" /> : up.is_active ? <><X className="w-3 h-3 mr-1" />Deactivate</> : <><Check className="w-3 h-3 mr-1" />Activate</>}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs" disabled={processing === up.id}
                  onClick={() => handleExtend(up.id, up.user_id, up.expires_at)}>
                  +30 Days
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminUserPackages;
