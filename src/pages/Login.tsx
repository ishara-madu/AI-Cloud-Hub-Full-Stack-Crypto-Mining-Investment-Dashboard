import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Cloud } from "lucide-react";
import { logDeviceAdvanced } from "@/lib/fingerprint";


const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        logDeviceAdvanced(session.user.id, "login", supabase);
        navigate("/dashboard", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { toast.error("Please fill in all fields"); return; }
    if (!agreed) { toast.error("Please accept the Privacy Policy and Terms & Conditions to continue"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { toast.error(error.message); } else {
      if (data.user) await logDeviceAdvanced(data.user.id, "login", supabase);
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center glow-orange">
              <Cloud className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">AICloudHub</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Email</Label>
            <Input type="email" placeholder="you@example.com" className="rounded-xl h-12 shadow-neu-inset bg-muted/30" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
            </div>
            <Input type="password" placeholder="••••••••" className="rounded-xl h-12 shadow-neu-inset bg-muted/30" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="flex items-start gap-2 pt-1">
            <Checkbox id="agree-login" checked={agreed} onCheckedChange={(checked) => setAgreed(checked === true)} className="mt-0.5" />
            <label htmlFor="agree-login" className="text-xs text-muted-foreground leading-tight">
              I have read and agree to the{" "}
              <Link to="/privacy-policy" className="text-primary hover:underline font-medium">Privacy Policy</Link>
              {" "}and{" "}
              <Link to="/terms" className="text-primary hover:underline font-medium">Terms & Conditions</Link>
              , including device tracking, ban policies, credit score system, and earnings rules.
            </label>
          </div>
          <Button type="submit" className="w-full rounded-xl h-12 gradient-primary text-primary-foreground font-semibold text-base mt-2" disabled={loading || !agreed}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Login
          </Button>
          <p className="text-sm text-center text-muted-foreground mt-4">
            Create new account? <Link to="/register" className="text-primary hover:underline font-medium">Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
