import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, User, Lock, Building2, Info, Headphones, Trash2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  iban: string | null;
  is_default: boolean;
}

const Settings = () => {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [newBank, setNewBank] = useState({ bank_name: "", account_number: "", iban: "" });
  const [addingBank, setAddingBank] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, bankRes] = await Promise.all([
        supabase.from("profiles").select("display_name, phone").eq("user_id", user.id).maybeSingle(),
        supabase.from("bank_accounts").select("*").eq("user_id", user.id).order("created_at"),
      ]);
      if (profileRes.data) {
        setDisplayName(profileRes.data.display_name || "");
        setPhone(profileRes.data.phone || "");
      }
      setBankAccounts((bankRes.data || []) as BankAccount[]);
      setLoading(false);
    };
    fetchData();
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
    if (error) toast.error(error.message); else { toast.success("Password changed!"); setNewPassword(""); setConfirmPassword(""); }
  };

  const handleAddBank = async () => {
    if (!user || !newBank.bank_name.trim() || !newBank.account_number.trim()) { toast.error("Bank name and account number required"); return; }
    setAddingBank(true);
    const { error, data } = await supabase.from("bank_accounts").insert({
      user_id: user.id, bank_name: newBank.bank_name.trim(), account_number: newBank.account_number.trim(), iban: newBank.iban.trim() || null,
    }).select().single();
    setAddingBank(false);
    if (error) toast.error("Failed to add bank account"); else {
      setBankAccounts([...bankAccounts, data as BankAccount]);
      setNewBank({ bank_name: "", account_number: "", iban: "" });
      toast.success("Bank account added!");
    }
  };

  const handleDeleteBank = async (id: string) => {
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
    if (error) toast.error("Failed to delete"); else {
      setBankAccounts(bankAccounts.filter((b) => b.id !== id));
      toast.success("Bank account removed");
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="w-4 h-4 mr-1" />Profile</TabsTrigger>
          <TabsTrigger value="security"><Lock className="w-4 h-4 mr-1" />Security</TabsTrigger>
          <TabsTrigger value="bank"><Building2 className="w-4 h-4 mr-1" />Bank Details</TabsTrigger>
          <TabsTrigger value="about"><Info className="w-4 h-4 mr-1" />About</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="font-heading">Edit Profile</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 890" />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveProfile} className="gradient-primary text-primary-foreground" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="font-heading">Change Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleChangePassword} className="gradient-primary text-primary-foreground" disabled={changingPw}>
                {changingPw && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Update Password
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="mt-6 space-y-4">
          {bankAccounts.map((ba) => (
            <Card key={ba.id} className="shadow-card border-border/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{ba.bank_name}</p>
                  <p className="text-sm text-muted-foreground">****{ba.account_number.slice(-4)}{ba.iban ? ` • ${ba.iban}` : ""}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteBank(ba.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
          <Card className="shadow-card border-border/50">
            <CardHeader><CardTitle className="text-lg font-heading">Add Bank Account</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={newBank.bank_name} onChange={(e) => setNewBank({ ...newBank, bank_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input value={newBank.account_number} onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>IBAN (optional)</Label>
                <Input value={newBank.iban} onChange={(e) => setNewBank({ ...newBank, iban: e.target.value })} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleAddBank} className="gradient-primary text-primary-foreground" disabled={addingBank}>
                {addingBank ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Add Bank Account
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="mt-6 space-y-4">
          <Card className="shadow-card border-border/50">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-heading font-bold text-lg">About NexusAI</h3>
                <p className="text-muted-foreground mt-1">NexusAI is a premium AI services marketplace providing cutting-edge artificial intelligence solutions for businesses and individuals.</p>
              </div>
              <Separator />
              <div>
                <h3 className="font-heading font-bold text-lg flex items-center gap-2"><Headphones className="w-5 h-5 text-primary" /> Contact Support</h3>
                <p className="text-muted-foreground mt-1">Email: support@nexusai.com</p>
                <p className="text-muted-foreground">Available 24/7</p>
              </div>
              <Separator />
              <Button variant="destructive" onClick={signOut} className="w-full">Logout</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
