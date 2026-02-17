import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Cloud } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { toast.error(error.message); } else { navigate("/dashboard"); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
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
            <Input
              type="email"
              placeholder="you@example.com"
              className="rounded-xl h-12 shadow-neu-inset bg-muted/30"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              className="rounded-xl h-12 shadow-neu-inset bg-muted/30"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full rounded-xl h-12 gradient-primary text-primary-foreground font-semibold text-base mt-2" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Login
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
