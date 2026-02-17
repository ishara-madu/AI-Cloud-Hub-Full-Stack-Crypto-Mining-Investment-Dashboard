import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";

const banks = [
  "Commercial Bank",
  "Sampath Bank",
  "HNB",
  "BOC",
  "Peoples Bank",
];

const BankInfo = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [holderName, setHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!holderName.trim()) { toast.error("Account holder name is required"); return; }
    if (!bankName) { toast.error("Please select a bank"); return; }
    if (!branchCode.trim() || branchCode.length > 3) { toast.error("Branch code must be 1-3 digits"); return; }
    if (!accountNumber.trim()) { toast.error("Account number is required"); return; }
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from("bank_accounts").upsert(
      {
        user_id: user.id,
        bank_name: `${bankName} (Branch: ${branchCode})`,
        account_number: accountNumber.trim(),
        is_default: true,
      },
      { onConflict: "user_id" }
    );
    setSaving(false);

    if (error) {
      // If upsert fails due to no unique constraint on user_id, try insert
      const { error: insertError } = await supabase.from("bank_accounts").insert({
        user_id: user.id,
        bank_name: `${bankName} (Branch: ${branchCode})`,
        account_number: accountNumber.trim(),
        is_default: true,
      });
      if (insertError) { toast.error("Failed to save bank details"); return; }
    }

    toast.success("Bank details saved successfully!");
    navigate("/settings");
  };

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-heading font-bold text-foreground">Bind Bank Card</h1>
            <p className="text-xs text-muted-foreground">බැංකු විස්තර</p>
          </div>
        </div>

        {/* Form */}
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
            Save Information
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BankInfo;
