import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";

const banks = [
  "Commercial Bank",
  "Sampath Bank",
  "HNB",
  "BOC",
  "Peoples Bank",
  "NSB",
  "Seylan Bank",
  "DFCC Bank",
  "NTB",
  "Pan Asia Bank",
];

const BankInfo = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [holderName, setHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [isBankActive, setIsBankActive] = useState(true);

  useEffect(() => {
    if (!user) { setLoadingData(false); return; }
    
    const fetchData = async () => {
      try {
        const [bankRes, methodRes] = await Promise.all([
          supabase.from("bank_accounts").select("*").eq("user_id", user.id).eq("is_default", true).order("created_at", { ascending: false }).limit(1),
          supabase.from("withdrawal_methods").select("is_active").eq("id", "bank_transfer").maybeSingle()
        ]);
        
        if (methodRes.data) {
          setIsBankActive(!!methodRes.data.is_active);
        }
        
        const rows = bankRes.data;
        const data = rows && rows.length > 0 ? rows[0] : null;
        if (data) {
          setExistingId(data.id);
          setHolderName(data.iban || "");
          const bankMatch = data.bank_name.match(/^(.+?)\s*\(Branch:\s*(\d+)\)$/);
          if (bankMatch) {
            setBankName(bankMatch[1]);
            setBranchCode(bankMatch[2]);
          } else {
            setBankName(data.bank_name);
          }
          setAccountNumber(data.account_number);
        }
      } catch (err) {
        console.error("Error loading bank details:", err);
      } finally {
        setLoadingData(false);
      }
    };
    
    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!holderName.trim()) { toast.error("Account holder name is required"); return; }
    if (!bankName) { toast.error("Please select a bank"); return; }
    if (!branchCode.trim() || branchCode.length > 3) { toast.error("Branch code must be 1-3 digits"); return; }
    if (!accountNumber.trim()) { toast.error("Account number is required"); return; }
    if (!user) return;

    setSaving(true);
    
    const bankData = {
      user_id: user.id,
      bank_name: `${bankName} (Branch: ${branchCode})`,
      account_number: accountNumber.trim(),
      iban: holderName.trim(), // Store holder name in iban field
      is_default: true,
    };

    let error;
    if (existingId) {
      // Update existing record
      const res = await supabase.from("bank_accounts").update(bankData).eq("id", existingId);
      error = res.error;
    } else {
      // Insert new record
      const res = await supabase.from("bank_accounts").insert(bankData).select("id").single();
      error = res.error;
      if (!error && res.data) setExistingId(res.data.id);
    }

    setSaving(false);
    if (error) { toast.error("Failed to save bank details"); return; }
    toast.success("Bank details saved successfully!");
    navigate("/settings");
  };

  if (loadingData) {
    return <LoadingScreen title="Loading Account Binding" subtitle="Reading bank specifications..." />;
  }

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-heading font-bold text-foreground">Bind Bank Account</h1>
            <p className="text-xs text-muted-foreground">Bank Details</p>
          </div>
        </div>

        {/* Form or Maintenance message */}
        {!isBankActive ? (
          <div className="shadow-neu rounded-2xl bg-card p-6 text-center space-y-4 border border-destructive/20 mt-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive animate-pulse" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground flex items-center justify-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive animate-pulse shrink-0" />
              <span>Feature Offline</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bank transfer withdrawals are currently disabled for system maintenance. Consequently, binding or editing bank account details is unavailable. Please try again later.
            </p>
            <div className="pt-2">
              <Button onClick={() => navigate(-1)} className="rounded-xl w-full font-semibold" variant="outline">
                Go Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="shadow-neu rounded-2xl bg-card p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Account Holder Name</Label>
              <Input
                className="rounded-xl h-12 shadow-neu-inset bg-muted/30"
                placeholder="e.g., K.G. Perera"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Bank Name</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger className="rounded-xl h-12 shadow-neu-inset bg-muted/30">
                  <SelectValue placeholder="Select your bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Branch Code</Label>
              <Input
                className="rounded-xl h-12 shadow-neu-inset bg-muted/30"
                placeholder="e.g., 001"
                type="text"
                inputMode="numeric"
                maxLength={3}
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Account Number</Label>
              <Input
                className="rounded-xl h-12 shadow-neu-inset bg-muted/30"
                placeholder="Enter account number"
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 bg-destructive/10 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-[11px] text-destructive leading-relaxed">
                Please ensure the name matches your ID. Wrong details may cause withdrawal failures.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl h-12 gradient-primary text-primary-foreground font-semibold text-sm shadow-md"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {existingId ? "Update Information" : "Save Information"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankInfo;
