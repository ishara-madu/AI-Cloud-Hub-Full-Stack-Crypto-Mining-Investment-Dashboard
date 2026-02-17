import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Cloud, ShieldAlert } from "lucide-react";
import { logDeviceAdvanced, checkDuplicateDevice } from "@/lib/fingerprint";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [searchParams] = useSearchParams();
  const [referralCode, setReferralCode] = useState(searchParams.get("ref") || "");
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        logDeviceAdvanced(session.user.id, "signup", supabase);
        navigate("/dashboard", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !displayName.trim()) { toast.error("Please fill in all fields"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (!referralCode.trim()) { toast.error("Invitation code is required"); return; }
    if (!privacyAccepted) { toast.error("Please accept the Privacy Policy to continue"); return; }
    setLoading(true);

    // Check for duplicate device fingerprints
    const dupCheck = await checkDuplicateDevice(supabase);
    if (dupCheck.isDuplicate) {
      toast.error("Registration blocked: This device is already associated with an existing account. Multiple accounts are not allowed.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: {
        data: { display_name: displayName.trim(), referral_code: referralCode.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); } else {
      if (data.user) await logDeviceAdvanced(data.user.id, "signup", supabase);
      toast.success("Account created! Check your email to verify.");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center glow-orange"><Cloud className="w-6 h-6 text-primary-foreground" /></div>
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">AICloudHub</h1>
          <p className="text-sm text-muted-foreground mt-1">Join the AI revolution</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-3">
          <div className="space-y-1"><Label className="text-sm font-medium">Full Name</Label><Input placeholder="Your name" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></div>
          <div className="space-y-1"><Label className="text-sm font-medium">Email</Label><Input type="email" placeholder="you@example.com" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1"><Label className="text-sm font-medium">Phone (optional)</Label><Input type="tel" placeholder="+94 7X XXX XXXX" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-sm font-medium">Password</Label><Input type="password" placeholder="••••••••" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <div className="space-y-1"><Label className="text-sm font-medium">Invitation Code <span className="text-destructive">*</span></Label><Input placeholder="Enter invitation code" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} required /></div>
          <div className="flex items-start gap-2 pt-1">
            <Checkbox id="privacy-register" checked={privacyAccepted} onCheckedChange={(checked) => setPrivacyAccepted(checked === true)} className="mt-0.5" />
            <label htmlFor="privacy-register" className="text-xs text-muted-foreground leading-tight">
              I have read and agree to the{" "}
              <Link to="/privacy-policy" className="text-primary hover:underline font-medium">Privacy Policy</Link>
              , including device tracking, account freezing, and data collection practices.
            </label>
          </div>
          <Button type="submit" className="w-full rounded-xl h-12 gradient-primary text-primary-foreground font-semibold text-base mt-2" disabled={loading || !privacyAccepted}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Account
          </Button>
          <p className="text-sm text-center text-muted-foreground mt-3">
            Already have an account? <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
