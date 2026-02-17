import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, User, Lock, CreditCard, Download, Headphones,
  Info, LogOut, ChevronRight, Shield
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const Settings = () => {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("display_name, phone").eq("user_id", user.id).maybeSingle();
      if (data) { setDisplayName(data.display_name || ""); setPhone(data.phone || ""); }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user || !displayName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim(), phone: phone.trim() }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to update profile"); else toast.success("Profile updated!");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) toast.error(error.message); else { toast.success("Password changed!"); setNewPassword(""); setConfirmPassword(""); setActiveSection(null); }
  };

  const maskedEmail = user?.email
    ? user.email.split("@")[0].slice(0, 3) + "***@" + user.email.split("@")[1]
    : "user@email.com";

  if (loading) return <div className="px-4 py-4 space-y-4"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4">
        <h1 className="text-lg font-heading font-bold text-foreground mb-4">Profile</h1>
      </div>

      <div className="px-4 space-y-5 pb-8">
        {/* User Card */}
        <div className="shadow-neu rounded-2xl bg-card p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-heading font-bold text-foreground">{displayName || "User"}</p>
            <p className="text-sm text-muted-foreground">{maskedEmail}</p>
            <Badge className="gradient-primary text-primary-foreground text-[10px] mt-1">VIP Level 1</Badge>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bank Info", icon: CreditCard, key: "bank" },
            { label: "Change Password", icon: Lock, key: "password" },
            { label: "Download App", icon: Download, key: "download" },
            { label: "Support (සහය)", icon: Headphones, key: "support" },
            { label: "About Us", icon: Info, key: "about" },
            { label: "Security", icon: Shield, key: "security" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(activeSection === item.key ? null : item.key)}
              className={cn(
                "shadow-neu rounded-2xl bg-card p-4 flex flex-col items-center gap-2 transition-all",
                activeSection === item.key && "ring-2 ring-primary"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Password Section */}
        {activeSection === "password" && (
          <div className="shadow-neu rounded-2xl bg-card p-5 space-y-4 animate-fade-in">
            <h3 className="text-sm font-heading font-bold text-foreground">Change Password</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">New Password</Label>
                <Input type="password" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Confirm Password</Label>
                <Input type="password" className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleChangePassword} className="w-full rounded-xl gradient-primary text-primary-foreground" disabled={changingPw}>
              {changingPw && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Update Password
            </Button>
          </div>
        )}

        {/* About Section */}
        {activeSection === "about" && (
          <div className="shadow-neu rounded-2xl bg-card p-5 space-y-3 animate-fade-in">
            <h3 className="text-sm font-heading font-bold text-foreground">About AICloudHub</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AICloudHub is a premium AI services marketplace providing cutting-edge artificial intelligence solutions.
              Rent GPU clusters, access vector databases, and earn through our referral program.
            </p>
            <p className="text-xs text-muted-foreground">support@aicloudhub.com</p>
          </div>
        )}

        {/* Support Section */}
        {activeSection === "support" && (
          <div className="shadow-neu rounded-2xl bg-card p-5 space-y-3 animate-fade-in">
            <h3 className="text-sm font-heading font-bold text-foreground">Customer Support (සහය)</h3>
            <p className="text-xs text-muted-foreground">Email: support@aicloudhub.com</p>
            <p className="text-xs text-muted-foreground">Available 24/7</p>
          </div>
        )}

        {/* Edit Profile */}
        <div className="shadow-neu rounded-2xl bg-card p-5 space-y-4">
          <h3 className="text-sm font-heading font-bold text-foreground">Edit Profile</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Display Name</Label>
              <Input className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone (optional)</Label>
              <Input className="rounded-xl h-11 shadow-neu-inset bg-muted/30" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 7X XXX XXXX" />
            </div>
          </div>
          <Button onClick={handleSaveProfile} className="w-full rounded-xl gradient-primary text-primary-foreground" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Changes
          </Button>
        </div>

        {/* Logout */}
        <Button
          onClick={signOut}
          variant="outline"
          className="w-full rounded-xl h-12 border-destructive text-destructive hover:bg-destructive/10 font-semibold"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );
};

export default Settings;
