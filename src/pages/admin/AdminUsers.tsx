import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Search, User, Wallet, ShieldAlert, ShieldCheck, Send, Loader2, Copy, CreditCard, Crown } from "lucide-react";
import { Link } from "react-router-dom";

interface UserRow {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  referral_code: string | null;
  created_at: string;
  is_frozen: boolean;
  credit_score: number;
  wallet?: { balance: number; total_deposited: number; total_withdrawn: number; total_commission: number };
  role?: string;
  bank?: { bank_name: string; account_number: string; iban: string | null } | null;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifDesc, setNotifDesc] = useState("");
  const [sending, setSending] = useState(false);

  const fetchUsers = async () => {
    const [profilesRes, walletsRes, rolesRes, banksRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("wallets").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("bank_accounts").select("user_id, bank_name, account_number, iban").eq("is_default", true),
    ]);

    const walletMap = new Map((walletsRes.data || []).map((w) => [w.user_id, w]));
    const roleMap = new Map((rolesRes.data || []).map((r) => [r.user_id, r.role]));
    const bankMap = new Map((banksRes.data || []).map((b: any) => [b.user_id, b]));

    const rows: UserRow[] = (profilesRes.data || []).map((p: any) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      phone: p.phone,
      referral_code: p.referral_code,
      created_at: p.created_at,
      is_frozen: p.is_frozen || false,
      credit_score: p.credit_score ?? 100,
      wallet: walletMap.get(p.user_id) as any,
      role: roleMap.get(p.user_id) || "user",
      bank: bankMap.get(p.user_id) || null,
    }));
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleUpdateBalance = async (userId: string) => {
    const newBal = parseFloat(editBalance);
    if (isNaN(newBal) || newBal < 0) { toast.error("Invalid balance"); return; }
    const { error } = await supabase.from("wallets").update({ balance: newBal }).eq("user_id", userId);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Balance updated");
    setEditBalance("");
    fetchUsers();
  };

  const handleToggleFreeze = async (userId: string, currentFrozen: boolean) => {
    const newStatus = !currentFrozen;
    await supabase.from("profiles").update({ is_frozen: newStatus }).eq("user_id", userId);
    await supabase.from("notifications").insert({
      user_id: userId, type: "security",
      title: newStatus ? "Account Frozen 🔒" : "Account Unfrozen ✅",
      description: newStatus
        ? "Your account has been frozen by admin. Withdrawals are disabled. Contact support."
        : "Your account has been unfrozen. You can now use all features normally.",
    });
    toast.success(newStatus ? "Account frozen" : "Account unfrozen");
    fetchUsers();
  };

  const handleDecreaseCreditScore = async (userId: string, currentScore: number) => {
    const newScore = Math.max(0, currentScore - 10);
    await supabase.from("profiles").update({ credit_score: newScore }).eq("user_id", userId);
    await supabase.from("notifications").insert({
      user_id: userId, type: "security",
      title: "Credit Score Decreased",
      description: `Your credit score has been decreased to ${newScore}%. Please maintain good account behavior.`,
    });
    toast.success(`Credit score decreased to ${newScore}%`);
    fetchUsers();
  };

  const handleSendNotification = async (userId: string) => {
    if (!notifTitle.trim()) { toast.error("Title required"); return; }
    setSending(true);
    await supabase.from("notifications").insert({
      user_id: userId, type: "system",
      title: notifTitle.trim(),
      description: notifDesc.trim() || null,
    });
    toast.success("Notification sent!");
    setNotifTitle("");
    setNotifDesc("");
    setSending(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || (u.display_name?.toLowerCase().includes(q)) || u.user_id.includes(q) || (u.phone?.includes(q));
  });

  if (loading) return <div className="p-6 space-y-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-2xl font-heading font-bold text-foreground">Users ({users.length})</h1>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 rounded-xl" placeholder="Search by name, ID, phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((u) => (
          <Card key={u.user_id} className={`shadow-neu ${u.is_frozen ? 'ring-2 ring-destructive/50' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{u.display_name || "No name"}</p>
                      {u.is_frozen && <Badge className="text-[9px] bg-destructive/20 text-destructive">Frozen</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">ID: {u.user_id.slice(0, 8)}... | Credit: {u.credit_score}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">Rs {(u.wallet?.balance ?? 0).toLocaleString()}</p>
                  <Badge className={u.role === "admin" ? "bg-red-500/20 text-red-500 text-[9px]" : "bg-primary/10 text-primary text-[9px]"}>{u.role}</Badge>
                </div>
              </div>

              {expandedUser === u.user_id && (
                <div className="mt-4 pt-4 border-t border-border space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{u.phone || "N/A"}</span></div>
                    <div><span className="text-muted-foreground">Referral:</span> <span className="font-medium">{u.referral_code || "N/A"}</span></div>
                    <div><span className="text-muted-foreground">Deposited:</span> <span className="font-medium">Rs {(u.wallet?.total_deposited ?? 0).toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Withdrawn:</span> <span className="font-medium">Rs {(u.wallet?.total_withdrawn ?? 0).toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Commission:</span> <span className="font-medium">Rs {(u.wallet?.total_commission ?? 0).toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Joined:</span> <span className="font-medium">{new Date(u.created_at).toLocaleDateString()}</span></div>
                  </div>

                  {/* Bank Details */}
                  {u.bank && (
                    <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-primary" /> Saved Bank Details</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                          <div><span className="text-muted-foreground">Bank: </span><span className="font-semibold text-foreground">{u.bank.bank_name}</span></div>
                          <button onClick={() => copyToClipboard(u.bank!.bank_name)} className="text-primary hover:text-primary/80"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                          <div><span className="text-muted-foreground">A/C: </span><span className="font-mono font-bold text-foreground tracking-wide">{u.bank.account_number}</span></div>
                          <button onClick={() => copyToClipboard(u.bank!.account_number)} className="text-primary hover:text-primary/80"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                        {u.bank.iban && (
                          <div className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                            <div><span className="text-muted-foreground">IBAN: </span><span className="font-mono font-bold text-foreground">{u.bank.iban}</span></div>
                            <button onClick={() => copyToClipboard(u.bank!.iban!)} className="text-primary hover:text-primary/80"><Copy className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Balance edit */}
                  <div className="flex gap-2">
                    <Input type="number" placeholder="New balance" className="rounded-xl h-9 text-sm" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} />
                    <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground" onClick={() => handleUpdateBalance(u.user_id)}>
                      <Wallet className="w-3 h-3 mr-1" />Set
                    </Button>
                  </div>

                  {/* Admin actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant={u.is_frozen ? "default" : "destructive"} className="flex-1 rounded-xl text-xs" onClick={() => handleToggleFreeze(u.user_id, u.is_frozen)}>
                      {u.is_frozen ? <><ShieldCheck className="w-3 h-3 mr-1" />Unfreeze</> : <><ShieldAlert className="w-3 h-3 mr-1" />Freeze</>}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs border-destructive text-destructive" onClick={() => handleDecreaseCreditScore(u.user_id, u.credit_score)}>
                      Credit -10
                    </Button>
                    <Button size="sm" variant={u.role === "admin" ? "outline" : "secondary"} className="flex-1 rounded-xl text-xs"
                      onClick={async () => {
                        if (u.role === "admin") {
                          await supabase.from("user_roles").update({ role: "user" }).eq("user_id", u.user_id);
                          toast.success("Demoted to user");
                        } else {
                          await supabase.from("user_roles").update({ role: "admin" }).eq("user_id", u.user_id);
                          toast.success("Promoted to admin");
                        }
                        fetchUsers();
                      }}>
                      <Crown className="w-3 h-3 mr-1" />{u.role === "admin" ? "Remove Admin" : "Make Admin"}
                    </Button>
                  </div>

                  {/* Send notification */}
                  <div className="space-y-2 bg-muted/30 rounded-xl p-3">
                    <p className="text-xs font-bold text-foreground">Send Notification</p>
                    <Input placeholder="Title" className="rounded-xl h-8 text-xs" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} />
                    <Textarea placeholder="Description (optional)" className="rounded-xl text-xs min-h-[60px]" value={notifDesc} onChange={(e) => setNotifDesc(e.target.value)} />
                    <Button size="sm" className="w-full rounded-xl gradient-primary text-primary-foreground text-xs" onClick={() => handleSendNotification(u.user_id)} disabled={sending}>
                      {sending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}Send
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminUsers;
