import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Building2, Percent, Save } from "lucide-react";
import { Link } from "react-router-dom";

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bank, setBank] = useState({ bank_name: "", account_name: "", account_number: "", branch: "" });
  const [commission, setCommission] = useState({ level_1: 10, level_2: 5, level_3: 2 });

  useEffect(() => {
    const fetch = async () => {
      const [bankRes, comRes] = await Promise.all([
        supabase.from("platform_settings").select("value").eq("key", "deposit_bank").maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "commission_rates").maybeSingle(),
      ]);
      if (bankRes.data?.value) setBank(bankRes.data.value as any);
      if (comRes.data?.value) setCommission(comRes.data.value as any);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      supabase.from("platform_settings").update({ value: bank as any, updated_at: new Date().toISOString() }).eq("key", "deposit_bank"),
      supabase.from("platform_settings").update({ value: commission as any, updated_at: new Date().toISOString() }).eq("key", "commission_rates"),
    ]);
    setSaving(false);
    toast.success("Settings saved!");
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
          <p className="text-xs text-muted-foreground">These details are shown to users when they make deposits</p>
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
    </div>
  );
};

export default AdminSettings;
