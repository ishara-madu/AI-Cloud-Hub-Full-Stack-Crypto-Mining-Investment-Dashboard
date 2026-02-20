import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Building2, Percent, Save, Trash2, ShieldAlert, Eye, EyeOff, CreditCard, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const RESET_PASSWORD = "2580";

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  description: string;
  details?: Record<string, string>;
}

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bank, setBank] = useState({ bank_name: "", account_name: "", account_number: "", branch: "" });
  const [commission, setCommission] = useState({ level_1: 10, level_2: 5, level_3: 2 });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Server restart state
  const [resetDialog, setResetDialog] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [bankRes, comRes, methodsRes] = await Promise.all([
        supabase.from("platform_settings").select("value").eq("key", "deposit_bank").maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "commission_rates").maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "payment_methods").maybeSingle(),
      ]);
      if (bankRes.data?.value) setBank(bankRes.data.value as any);
      if (comRes.data?.value) setCommission(comRes.data.value as any);
      if (methodsRes.data?.value) setPaymentMethods(methodsRes.data.value as unknown as PaymentMethod[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      supabase.from("platform_settings").update({ value: bank as any, updated_at: new Date().toISOString() }).eq("key", "deposit_bank"),
      supabase.from("platform_settings").update({ value: commission as any, updated_at: new Date().toISOString() }).eq("key", "commission_rates"),
      supabase.from("platform_settings").upsert({ key: "payment_methods", value: paymentMethods as any, updated_at: new Date().toISOString() }, { onConflict: "key" }),
    ]);
    setSaving(false);
    toast.success("Settings saved!");
  };

  const addPaymentMethod = () => {
    const id = `method_${Date.now()}`;
    setPaymentMethods(prev => [...prev, { id, name: "", icon: "smartphone", enabled: true, description: "", details: {} }]);
  };

  const removePaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.filter(m => m.id !== id));
  };

  const updateMethod = (id: string, field: string, value: any) => {
    setPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const updateMethodDetail = (id: string, key: string, value: string) => {
    setPaymentMethods(prev => prev.map(m => {
      if (m.id !== id) return m;
      return { ...m, details: { ...m.details, [key]: value } };
    }));
  };

  const addMethodDetail = (id: string) => {
    const key = prompt("Enter detail field name (e.g. phone_number):");
    if (!key) return;
    updateMethodDetail(id, key, "");
  };

  const removeMethodDetail = (id: string, key: string) => {
    setPaymentMethods(prev => prev.map(m => {
      if (m.id !== id) return m;
      const details = { ...m.details };
      delete details[key];
      return { ...m, details };
    }));
  };

  const handleServerReset = async () => {
    if (resetPassword !== RESET_PASSWORD) { toast.error("Incorrect password"); return; }
    if (resetConfirmText !== "RESET ALL DATA") { toast.error('Type "RESET ALL DATA" to confirm'); return; }
    setResetting(true);
    try {
      const { data, error } = await supabase.rpc("admin_reset_all_data" as any);
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any)?.error);
      toast.success("All user data has been deleted. The platform has been reset.");
      setResetDialog(false); setResetPassword(""); setResetConfirmText("");
    } catch (err: any) { toast.error(err.message || "Reset failed"); }
    setResetting(false);
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-2xl font-heading font-bold text-foreground">Platform Settings</h1>
      </div>

      {/* Deposit Bank Details */}
      <Card className="shadow-neu border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Deposit Bank Details
          </CardTitle>
          <p className="text-xs text-muted-foreground">These details are shown to users when they select Bank Transfer</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Bank Name</Label><Input className="rounded-xl h-9" value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Account Name</Label><Input className="rounded-xl h-9" value={bank.account_name} onChange={(e) => setBank({ ...bank, account_name: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Account Number</Label><Input className="rounded-xl h-9" value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Branch</Label><Input className="rounded-xl h-9" value={bank.branch} onChange={(e) => setBank({ ...bank, branch: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card className="shadow-neu border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Payment Methods
            </CardTitle>
            <Button size="sm" variant="outline" className="rounded-xl text-xs h-8" onClick={addPaymentMethod}>
              <Plus className="w-3 h-3 mr-1" /> Add Method
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Configure which payment methods users can choose when depositing</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentMethods.map((method) => (
            <div key={method.id} className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Switch checked={method.enabled} onCheckedChange={(v) => updateMethod(method.id, "enabled", v)} />
                  <Input className="rounded-lg h-8 text-sm font-semibold max-w-[180px]" placeholder="Method name" value={method.name} onChange={(e) => updateMethod(method.id, "name", e.target.value)} />
                </div>
                {method.id !== "bank_transfer" && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removePaymentMethod(method.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input className="rounded-lg h-8 text-xs" placeholder="Short description" value={method.description} onChange={(e) => updateMethod(method.id, "description", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Icon (building / smartphone)</Label>
                  <Input className="rounded-lg h-8 text-xs" placeholder="building" value={method.icon} onChange={(e) => updateMethod(method.id, "icon", e.target.value)} />
                </div>
              </div>
              {/* Details fields */}
              {method.id !== "bank_transfer" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Details (shown to users)</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" onClick={() => addMethodDetail(method.id)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Field
                    </Button>
                  </div>
                  {method.details && Object.entries(method.details).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground min-w-[100px] capitalize">{key.replace(/_/g, " ")}</span>
                      <Input className="rounded-lg h-7 text-xs flex-1" value={val} onChange={(e) => updateMethodDetail(method.id, key, e.target.value)} />
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeMethodDetail(method.id, key)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Commission Rates */}
      <Card className="shadow-neu border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" /> Commission Rates
          </CardTitle>
          <p className="text-xs text-muted-foreground">Set referral commission percentages for each tier</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Level 1 (%)</Label>
              <Input type="number" min="0" max="100" className="rounded-xl h-9" value={commission.level_1} onChange={(e) => setCommission({ ...commission, level_1: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Level 2 (%)</Label>
              <Input type="number" min="0" max="100" className="rounded-xl h-9" value={commission.level_2} onChange={(e) => setCommission({ ...commission, level_2: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Level 3 (%)</Label>
              <Input type="number" min="0" max="100" className="rounded-xl h-9" value={commission.level_3} onChange={(e) => setCommission({ ...commission, level_3: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full rounded-xl h-12 gradient-primary text-primary-foreground font-semibold" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save All Settings
      </Button>

      {/* Danger Zone */}
      <Card className="shadow-neu border-destructive/40 bg-destructive/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-4 h-4" /> Danger Zone
          </CardTitle>
          <p className="text-xs text-muted-foreground">Irreversible actions that affect the entire platform</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-destructive">Reset All User Data</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Permanently deletes all user profiles, wallets, transactions, packages, device logs, notifications, and referrals.
                  <span className="text-destructive font-semibold"> This cannot be undone.</span>
                </p>
              </div>
              <Button variant="destructive" size="sm" className="rounded-xl shrink-0" onClick={() => setResetDialog(true)}>
                <Trash2 className="w-4 h-4 mr-1" /> Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Dialog */}
      <Dialog open={resetDialog} onOpenChange={(o) => { if (!resetting) { setResetDialog(o); if (!o) { setResetPassword(""); setResetConfirmText(""); } } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="w-5 h-5" />⚠️ Reset All User Data</DialogTitle>
            <DialogDescription>This will permanently delete ALL user and admin data from the platform. This action is irreversible.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-xs text-destructive space-y-1">
              <p className="font-bold">The following will be deleted:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                <li>All user profiles & admin profiles</li>
                <li>All wallets & transaction history</li>
                <li>All packages, commissions & referrals</li>
                <li>All device logs & notifications</li>
                <li>All deposits & withdrawal requests</li>
                <li>All admin alerts</li>
              </ul>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Admin Password</Label>
              <div className="relative">
                <Input type={showResetPw ? "text" : "password"} placeholder="Enter password" className="rounded-xl h-9 pr-10" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowResetPw(v => !v)}>
                  {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Type "RESET ALL DATA" to confirm</Label>
              <Input placeholder='RESET ALL DATA' className="rounded-xl h-9 font-mono" value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="destructive" className="w-full rounded-xl" disabled={resetting || resetPassword !== RESET_PASSWORD || resetConfirmText !== "RESET ALL DATA"} onClick={handleServerReset}>
              {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete All Data Permanently
            </Button>
            <Button variant="ghost" className="w-full rounded-xl" onClick={() => setResetDialog(false)} disabled={resetting}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettings;
