import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Plus, Package, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { Link } from "react-router-dom";

const emptyForm = {
  name: "", description: "", price_onetime: "", price_monthly: "",
  cashback_percent: "", bonus_tag: "", duration_days: "30", stock_count: "",
};

const AdminPackages = () => {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchPackages = async () => {
    const { data } = await supabase.from("ai_packages").select("*").order("created_at", { ascending: false });
    setPackages(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPackages(); }, []);

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("ai_packages").update({ is_active: !current }).eq("id", id);
    toast.success(current ? "Package deactivated" : "Package activated");
    fetchPackages();
  };

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("ai_packages").insert({
      name: form.name,
      description: form.description || null,
      price_onetime: form.price_onetime ? parseFloat(form.price_onetime) : null,
      price_monthly: form.price_monthly ? parseFloat(form.price_monthly) : null,
      cashback_percent: form.cashback_percent ? parseFloat(form.cashback_percent) : 0,
      bonus_tag: form.bonus_tag || null,
      duration_days: parseInt(form.duration_days) || 30,
      stock_count: form.stock_count ? parseInt(form.stock_count) : null,
      features: [],
    });
    setSaving(false);
    if (error) { toast.error("Failed to add package"); return; }
    toast.success("Package added!");
    setForm(emptyForm);
    setShowAdd(false);
    fetchPackages();
  };

  const startEdit = (pkg: any) => {
    setEditingId(pkg.id);
    setShowAdd(false);
    setForm({
      name: pkg.name || "",
      description: pkg.description || "",
      price_onetime: pkg.price_onetime?.toString() || "",
      price_monthly: pkg.price_monthly?.toString() || "",
      cashback_percent: pkg.cashback_percent?.toString() || "",
      bonus_tag: pkg.bonus_tag || "",
      duration_days: pkg.duration_days?.toString() || "30",
      stock_count: pkg.stock_count?.toString() || "",
    });
  };

  const handleEdit = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("ai_packages").update({
      name: form.name,
      description: form.description || null,
      price_onetime: form.price_onetime ? parseFloat(form.price_onetime) : null,
      price_monthly: form.price_monthly ? parseFloat(form.price_monthly) : null,
      cashback_percent: form.cashback_percent ? parseFloat(form.cashback_percent) : 0,
      bonus_tag: form.bonus_tag || null,
      duration_days: parseInt(form.duration_days) || 30,
      stock_count: form.stock_count ? parseInt(form.stock_count) : null,
    }).eq("id", editingId!);
    setSaving(false);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Package updated!");
    setEditingId(null);
    setForm(emptyForm);
    fetchPackages();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this package? This cannot be undone.")) return;
    const { error } = await supabase.from("ai_packages").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Package deleted");
    fetchPackages();
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

  const FormFields = () => (
    <div className="space-y-3">
      <div className="space-y-1"><Label className="text-xs">Name *</Label><Input className="rounded-xl h-9" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="space-y-1"><Label className="text-xs">Description</Label><Input className="rounded-xl h-9" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label className="text-xs">One-time Price</Label><Input type="number" className="rounded-xl h-9" value={form.price_onetime} onChange={(e) => setForm({ ...form, price_onetime: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Monthly Price</Label><Input type="number" className="rounded-xl h-9" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="space-y-1"><Label className="text-xs">Cashback %</Label><Input type="number" className="rounded-xl h-9" value={form.cashback_percent} onChange={(e) => setForm({ ...form, cashback_percent: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Tag</Label><Input className="rounded-xl h-9" placeholder="HOT/NEW" value={form.bonus_tag} onChange={(e) => setForm({ ...form, bonus_tag: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Days</Label><Input type="number" className="rounded-xl h-9" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Stock</Label><Input type="number" className="rounded-xl h-9" placeholder="∞" value={form.stock_count} onChange={(e) => setForm({ ...form, stock_count: e.target.value })} /></div>
      </div>
    </div>
  );

  if (loading) return <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="text-xl font-heading font-bold text-foreground">Packages ({packages.length})</h1>
        </div>
        <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground" onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm(emptyForm); }}>
          <Plus className="w-4 h-4 mr-1" />{showAdd ? "Cancel" : "Add"}
        </Button>
      </div>

      {showAdd && (
        <Card className="shadow-neu animate-fade-in">
          <CardContent className="p-4 space-y-3">
            <FormFields />
            <Button className="w-full rounded-xl gradient-primary text-primary-foreground" onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Package
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {packages.map((pkg) => (
          <Card key={pkg.id} className="shadow-neu">
            <CardContent className="p-4">
              {editingId === pkg.id ? (
                <div className="space-y-3">
                  <FormFields />
                  <div className="flex gap-2">
                    <Button className="flex-1 rounded-xl gradient-primary text-primary-foreground text-xs" onClick={handleEdit} disabled={saving}>
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Save</>}
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-xl text-xs" onClick={cancelEdit}><X className="w-3 h-3 mr-1" />Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{pkg.name}</p>
                        {pkg.bonus_tag && <Badge className="text-[9px] bg-primary/10 text-primary">{pkg.bonus_tag}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {pkg.price_onetime ? `Rs ${Number(pkg.price_onetime).toLocaleString()}` : ""}
                        {pkg.price_monthly ? ` Rs ${Number(pkg.price_monthly).toLocaleString()}/mo` : ""}
                        {pkg.cashback_percent ? ` | ${pkg.cashback_percent}% cb` : ""}
                        {pkg.duration_days ? ` | ${pkg.duration_days}d` : ""}
                        {pkg.stock_count != null ? ` | Stock: ${pkg.stock_count}` : " | Stock: ∞"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={pkg.is_active ?? true} onCheckedChange={() => handleToggleActive(pkg.id, pkg.is_active)} />
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => startEdit(pkg)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive" onClick={() => handleDelete(pkg.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminPackages;
