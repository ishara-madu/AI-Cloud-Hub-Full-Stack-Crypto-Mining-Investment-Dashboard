import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, Building2, Copy, Camera, Upload, X, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  description: string;
  details?: Record<string, string>;
}

const iconMap: Record<string, any> = {
  building: Building2,
  smartphone: Smartphone,
};

const Deposit = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bankDetails, setBankDetails] = useState({ bank_name: "Commercial Bank PLC", account_name: "AI Cloud Technologies", account_number: "82001567XX", branch: "Colombo 07" });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("bank_transfer");
  const [methodsLoaded, setMethodsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("platform_settings").select("value").eq("key", "deposit_bank").maybeSingle(),
      supabase.from("platform_settings").select("value").eq("key", "payment_methods").maybeSingle(),
    ]).then(([bankRes, methodsRes]) => {
      if (bankRes.data?.value) setBankDetails(bankRes.data.value as any);
      if (methodsRes.data?.value) {
        const methods = (methodsRes.data.value as any[]).filter((m: PaymentMethod) => m.enabled);
        setPaymentMethods(methods);
        if (methods.length > 0) setSelectedMethod(methods[0].id);
      }
      setMethodsLoaded(true);
    });
  }, []);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large. Max 5MB."); return; }
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt < 500) { toast.error("Minimum deposit is Rs 500"); return; }
    if (!user) return;
    setLoading(true);

    let slipUrl: string | null = null;
    if (slipFile) {
      setUploading(true);
      const ext = slipFile.name.split(".").pop();
      const path = `slips/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("uploads").upload(path, slipFile);
      if (uploadErr) { toast.error("Failed to upload payment slip"); setLoading(false); setUploading(false); return; }
      const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
      slipUrl = urlData.publicUrl;
      setUploading(false);
    }

    const { data: depData, error: depErr } = await supabase.from("deposit_requests").insert({
      user_id: user.id, amount: amt, payment_method: selectedMethod as any,
      notes: reference.trim() || null, slip_url: slipUrl,
    }).select("id").single();

    if (!depErr && depData) {
      const methodName = paymentMethods.find(m => m.id === selectedMethod)?.name || selectedMethod;
      await supabase.from("transactions").insert({
        user_id: user.id, type: "deposit" as const, amount: amt, status: "pending" as const,
        description: `Deposit via ${methodName}${reference ? ` - ${reference}` : ""}`,
        reference_id: depData.id,
      });
      await supabase.from("notifications").insert({
        user_id: user.id, type: "money",
        title: "Deposit Request Submitted",
        description: `Your deposit of Rs ${amt.toLocaleString()} via ${methodName} is pending approval.`,
      });
    }

    setLoading(false);
    if (depErr) { toast.error("Failed to submit deposit request"); } else { setSubmitted(true); }
  };

  const activeMethod = paymentMethods.find(m => m.id === selectedMethod);

  if (submitted) {
    return (
      <div className="px-4 py-8 animate-fade-in">
        <div className="shadow-neu rounded-2xl bg-card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground">Deposit Request Submitted</h2>
          <p className="text-sm text-muted-foreground">Your deposit of <strong>Rs {parseFloat(amount).toFixed(2)}</strong> is pending approval.</p>
          <Button onClick={() => { setSubmitted(false); setAmount(""); setReference(""); setSlipFile(null); setSlipPreview(null); }} variant="outline" className="rounded-xl">
            Make Another Deposit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4 flex items-center gap-3">
        <Link to="/dashboard"><Button variant="ghost" size="icon" className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-lg font-heading font-bold text-foreground">Deposit</h1>
      </div>

      <div className="px-4 space-y-5 pb-8">
        {methodsLoaded && paymentMethods.length === 0 ? (
          <div className="shadow-neu rounded-2xl bg-card p-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <Building2 className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-lg font-heading font-bold text-foreground">Deposits Currently Unavailable</h2>
            <p className="text-sm text-muted-foreground">All payment methods are currently disabled. Please try again later or contact support.</p>
            <Link to="/dashboard"><Button variant="outline" className="rounded-xl">Back to Dashboard</Button></Link>
          </div>
        ) : (<>
        {/* Payment Method Selection */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Select Method</p>
          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const IconComp = iconMap[method.icon] || Building2;
              const isSelected = selectedMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedMethod(method.id)}
                  className={cn(
                    "w-full shadow-neu rounded-2xl bg-card p-4 flex items-center gap-4 transition-all text-left",
                    isSelected ? "ring-2 ring-primary" : "ring-1 ring-border hover:ring-primary/40"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    isSelected ? "gradient-primary" : "bg-muted"
                  )}>
                    <IconComp className={cn("w-6 h-6", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1">
                    <p className="font-heading font-bold text-foreground">{method.name}</p>
                    <p className="text-xs text-muted-foreground">{method.description}</p>
                  </div>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Details */}
        {methodsLoaded && selectedMethod === "bank_transfer" && (
          <div className="shadow-neu rounded-2xl bg-card p-5 space-y-3">
            <h3 className="text-sm font-heading font-bold text-foreground">Receiving Bank Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="font-medium text-foreground">{bankDetails.bank_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">A/C Name</span><span className="font-medium text-foreground">{bankDetails.account_name}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">A/C No</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground font-mono">{bankDetails.account_number}</span>
                  <button onClick={() => copyText(bankDetails.account_number, "Account number")} className="text-primary hover:text-primary/80"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span className="font-medium text-foreground">{bankDetails.branch}</span></div>
            </div>
          </div>
        )}

        {methodsLoaded && selectedMethod !== "bank_transfer" && activeMethod?.details && (
          <div className="shadow-neu rounded-2xl bg-card p-5 space-y-3">
            <h3 className="text-sm font-heading font-bold text-foreground">{activeMethod.name} Details</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(activeMethod.details).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground font-mono">{value}</span>
                    <button onClick={() => copyText(value, key)} className="text-primary hover:text-primary/80"><Copy className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Enter Amount (Rs)</Label>
            <Input type="number" min="1" step="0.01" placeholder="0.00" className="rounded-xl h-12 text-lg shadow-neu-inset bg-muted/30" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Transaction Reference / Remark</Label>
            <Input placeholder="e.g. TXN12345" className="rounded-xl h-12 shadow-neu-inset bg-muted/30" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Upload Payment Slip</Label>
            {slipPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-border">
                <img src={slipPreview} alt="Payment slip" className="w-full max-h-48 object-contain bg-muted/20" />
                <button type="button" onClick={() => { setSlipFile(null); setSlipPreview(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-border rounded-2xl p-6 text-center bg-muted/20 cursor-pointer hover:border-primary/40 transition-colors block">
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><Camera className="w-6 h-6 text-primary" /></div>
                  <p className="text-sm text-muted-foreground">Tap to upload payment slip</p>
                  <Upload className="w-4 h-4 text-muted-foreground" />
                </div>
              </label>
            )}
          </div>
          <Button type="submit" className="w-full rounded-xl h-12 gradient-primary text-primary-foreground font-semibold text-base" disabled={loading || uploading}>
            {(loading || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {uploading ? "Uploading Slip..." : "Confirm Deposit"}
          </Button>
          <p className="text-xs text-destructive text-center font-medium">⚠️ Minimum deposit Rs 500. Transfer exact amount. Requests are processed within 30 minutes.</p>
        </form>
        </>)}
      </div>
    </div>
  );
};

export default Deposit;
