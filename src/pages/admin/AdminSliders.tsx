import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Plus, Loader2, Trash2, Upload, X, Pencil, Check } from "lucide-react";
import { Link } from "react-router-dom";

const gradientOptions = [
  "from-yellow-500 via-red-500 to-orange-500",
  "from-teal-500 via-cyan-500 to-blue-500",
  "from-orange-500 via-pink-500 to-purple-500",
  "from-emerald-500 via-green-500 to-teal-500",
  "from-indigo-500 via-purple-500 to-pink-500",
  "from-rose-500 via-red-500 to-amber-500",
];

const emptyForm = { title: "", subtitle: "", gradient: gradientOptions[0], sort_order: "0", link_url: "" };

const AdminSliders = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchBanners = async () => {
    const { data } = await supabase.from("slider_banners").select("*").order("sort_order", { ascending: true });
    setBanners(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBanners(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `banners/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("uploads").upload(path, imageFile);
    if (upErr) { toast.error("Failed to upload image"); return null; }
    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleAdd = async () => {
    setSaving(true);
    const imageUrl = await uploadImage();
    if (imageFile && !imageUrl) { setSaving(false); return; }

    const { error } = await supabase.from("slider_banners").insert({
      title: form.title.trim() || "",
      subtitle: form.subtitle.trim() || null,
      gradient: form.gradient,
      sort_order: parseInt(form.sort_order) || 0,
      image_url: imageUrl,
      link_url: form.link_url.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Failed to add banner"); return; }
    toast.success("Banner added!");
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setShowAdd(false);
    fetchBanners();
  };

  const startEdit = (b: any) => {
    setEditingId(b.id);
    setShowAdd(false);
    setForm({ title: b.title || "", subtitle: b.subtitle || "", gradient: b.gradient || gradientOptions[0], sort_order: b.sort_order?.toString() || "0", link_url: b.link_url || "" });
    setImageFile(null);
    setImagePreview(b.image_url || null);
  };

  const handleEdit = async () => {
    setSaving(true);
    let imageUrl: string | undefined = undefined;
    if (imageFile) {
      const uploaded = await uploadImage();
      if (!uploaded) { setSaving(false); return; }
      imageUrl = uploaded;
    }

    const updateData: any = {
      title: form.title.trim() || "",
      subtitle: form.subtitle.trim() || null,
      gradient: form.gradient,
      sort_order: parseInt(form.sort_order) || 0,
      link_url: form.link_url.trim() || null,
    };
    if (imageUrl !== undefined) updateData.image_url = imageUrl;

    const { error } = await supabase.from("slider_banners").update(updateData).eq("id", editingId!);
    setSaving(false);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Banner updated!");
    cancelEdit();
    fetchBanners();
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); setImageFile(null); setImagePreview(null); };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from("slider_banners").update({ is_active: !current }).eq("id", id);
    toast.success(current ? "Banner hidden" : "Banner visible");
    fetchBanners();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    await supabase.from("slider_banners").delete().eq("id", id);
    toast.success("Banner deleted");
    fetchBanners();
  };

  const FormFields = () => (
    <div className="space-y-3">
      <div className="space-y-1"><Label className="text-xs">Title (optional)</Label><Input className="rounded-xl h-9" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. New User Bonus!" /></div>
      <div className="space-y-1"><Label className="text-xs">Subtitle</Label><Input className="rounded-xl h-9" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="e.g. Get Rs.100 Free" /></div>
      <div className="space-y-1">
        <Label className="text-xs">Banner Image (optional)</Label>
        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img src={imagePreview} alt="Preview" className="w-full h-24 object-cover" />
            <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <label className="border-2 border-dashed border-border rounded-xl p-3 text-center cursor-pointer hover:border-primary/40 transition-colors block">
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><Upload className="w-4 h-4" /> Upload Image</div>
          </label>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Gradient (fallback if no image)</Label>
        <div className="grid grid-cols-3 gap-2">
          {gradientOptions.map((g) => (
            <button key={g} onClick={() => setForm({ ...form, gradient: g })}
              className={`h-8 rounded-lg bg-gradient-to-r ${g} ${form.gradient === g ? 'ring-2 ring-foreground' : ''}`} />
          ))}
        </div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Link URL (optional)</Label><Input className="rounded-xl h-9" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://example.com" /></div>
      <div className="space-y-1"><Label className="text-xs">Sort Order</Label><Input type="number" className="rounded-xl h-9" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
    </div>
  );

  if (loading) return <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="text-xl font-heading font-bold text-foreground">Slider Banners ({banners.length})</h1>
        </div>
        <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground" onClick={() => { setShowAdd(!showAdd); cancelEdit(); }}>
          <Plus className="w-4 h-4 mr-1" />{showAdd ? "Cancel" : "Add"}
        </Button>
      </div>

      {showAdd && (
        <Card className="shadow-neu animate-fade-in">
          <CardContent className="p-4 space-y-3">
            <FormFields />
            <Button className="w-full rounded-xl gradient-primary text-primary-foreground" onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Banner
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {banners.map((b) => (
          <Card key={b.id} className="shadow-neu overflow-hidden">
            {editingId === b.id ? (
              <CardContent className="p-4 space-y-3">
                <FormFields />
                <div className="flex gap-2">
                  <Button className="flex-1 rounded-xl gradient-primary text-primary-foreground text-xs" onClick={handleEdit} disabled={saving}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Save</>}
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl text-xs" onClick={cancelEdit}><X className="w-3 h-3 mr-1" />Cancel</Button>
                </div>
              </CardContent>
            ) : (
              <>
                {b.image_url ? (
                  <div className="h-20 relative">
                    <img src={b.image_url} alt={b.title || "Banner"} className="w-full h-full object-cover" />
                    {(b.title || b.subtitle) && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-3">
                        <div className="text-white text-center">
                          {b.title && <p className="text-sm font-bold">{b.title}</p>}
                          {b.subtitle && <p className="text-[10px] opacity-80">{b.subtitle}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`h-16 bg-gradient-to-r ${b.gradient} flex items-center justify-center p-3`}>
                    {(b.title || b.subtitle) && (
                      <div className="text-white text-center">
                        {b.title && <p className="text-sm font-bold">{b.title}</p>}
                        {b.subtitle && <p className="text-[10px] opacity-80">{b.subtitle}</p>}
                      </div>
                    )}
                  </div>
                )}
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Order: {b.sort_order} {b.image_url && "• 🖼"} {b.link_url && "• 🔗"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={b.is_active} onCheckedChange={() => handleToggle(b.id, b.is_active)} />
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => startEdit(b)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive" onClick={() => handleDelete(b.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminSliders;
