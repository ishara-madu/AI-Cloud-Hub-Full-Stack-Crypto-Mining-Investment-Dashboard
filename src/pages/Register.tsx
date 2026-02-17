import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Cloud } from "lucide-react";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [referralCode, setReferralCode] = useState(searchParams.get("ref") || "");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !displayName.trim()) { toast.error("Please fill in all fields"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (!referralCode.trim()) { toast.error("Invitation code is required"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim(), referral_code: referralCode.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Account created! Check your email to verify.");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center glow-orange">
              <Cloud className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">AICloudHub</h1>
          <p className="text-sm text-muted-foreground mt-1">Join the AI revolution</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Full Name</Label>
            <Input placeholder="Your name" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Email</Label>
            <Input type="email" placeholder="you@example.com" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Phone (optional)</Label>
            <Input type="tel" placeholder="+94 7X XXX XXXX" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Password</Label>
            <Input type="password" placeholder="••••••••" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Invitation Code <span className="text-destructive">*</span></Label>
            <Input placeholder="Enter invitation code" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} required />
          </div>

          <Button type="submit" className="w-full rounded-xl h-12 gradient-primary text-primary-foreground font-semibold text-base mt-2" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Account
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl h-12 font-medium text-base"
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (error) toast.error((error as Error).message);
            }}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
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
