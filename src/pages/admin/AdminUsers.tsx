import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Search, User, Wallet, ShieldAlert, ShieldCheck, Send, Loader2, Copy, CreditCard, Crown, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";

interface UserRow {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  referral_code: string | null;
  created_at: string;
  is_frozen: boolean;
  credit_score: number;
  ban_count: number;
  wallet?: { balance: number; total_deposited: number; total_withdrawn: number; total_commission: number };
  role?: string;
  bank?: { bank_name: string; account_number: string; iban: string | null } | null;
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifDesc, setNotifDesc] = useState("");
  const [sending, setSending] = useState(false);
  const [banDialog, setBanDialog] = useState<{ users: UserRow[]; mode: "bulk" | "single"; currentIndex: number; durationHours: string } | null>(null);
  const [banning, setBanning] = useState(false);

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
      ban_count: p.ban_count ?? 0,
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

  const executeBan = async (userId: string, displayName: string | null, durationHours?: string) => {
    setBanning(true);
    const hours = durationHours ? parseInt(durationHours) : null;
    const { data, error } = await supabase.rpc("ban_user", { p_user_id: userId, p_duration_hours: hours } as any);
    if (error || (data && !(data as any).success)) {
      toast.error((data as any)?.error || error?.message || "Ban failed");
    } else {
      const d = data as any;
      toast.success(`${displayName || "User"} banned (Credit: ${d.new_credit_score}%)${d.is_temporary ? ` — temp ${hours}h` : " — permanent"}`);
    }
    setBanning(false);
    fetchUsers();
  };

  const handleToggleFreeze = async (userId: string, currentFrozen: boolean) => {
    if (!currentFrozen) {
      // Show ban dialog with history
      const user = users.find(u => u.user_id === userId);
      if (user) {
        setBanDialog({ users: [user], mode: "single", currentIndex: 0, durationHours: "" });
      }
      return;
    }
    // Unfreeze
    await supabase.from("profiles").update({ is_frozen: false }).eq("user_id", userId);
    await supabase.from("notifications").insert({
      user_id: userId, type: "security",
      title: "Account Unfrozen",
      description: "Your account has been unfrozen. You can now use all features normally.",
    });
    toast.success("Account unfrozen");
    fetchUsers();
  };

  const handleBulkBan = (userIds: string[]) => {
    const targets = users.filter(u => userIds.includes(u.user_id) && !u.is_frozen);
    if (targets.length === 0) { toast.error("No unbanned users selected"); return; }
    setBanDialog({ users: targets, mode: "bulk", currentIndex: 0, durationHours: "" });
  };

  const handleDecreaseBalance = async (userId: string, currentBalance: number) => {
    const newBal = Math.max(0, currentBalance - 10);
    const { error } = await supabase.from("wallets").update({ balance: newBal }).eq("user_id", userId);
    if (error) { toast.error("Failed to update balance"); return; }
    toast.success(`Balance: Rs ${currentBalance} → Rs ${newBal} (-10)`);
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

  // Find users sharing same IP for bulk ban suggestion
  const getSameIpUsers = (userId: string) => {
    // This is shown contextually in the ban dialog
    return [];
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{u.display_name || "No name"}</p>
                      {u.is_frozen && <Badge className="text-[9px] bg-destructive/20 text-destructive">Frozen</Badge>}
                      {u.ban_count > 0 && <Badge className="text-[9px] bg-yellow-500/20 text-yellow-600">Banned {u.ban_count}x</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">ID: {u.user_id.slice(0, 8)}... | Credit: {u.credit_score}%</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-sm font-bold text-foreground">Rs {(u.wallet?.balance ?? 0).toLocaleString()}</p>
                  <Badge className={u.role === "admin" ? "bg-red-500/20 text-red-500 text-[9px]" : "bg-primary/10 text-primary text-[9px]"}>{u.role}</Badge>
                  <Link to={`/admin/users/${u.user_id}`} onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary px-2 rounded-lg">Full Details →</Button>
                  </Link>
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
                    <div><span className="text-muted-foreground">Times Banned:</span> <span className="font-medium text-destructive">{u.ban_count}</span></div>
                  </div>

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

                  <div className="flex gap-2">
                    <Input type="number" placeholder="New balance" className="rounded-xl h-9 text-sm" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} />
                    <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground" onClick={() => handleUpdateBalance(u.user_id)}>
                      <Wallet className="w-3 h-3 mr-1" />Set
                    </Button>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant={u.is_frozen ? "default" : "destructive"} className="flex-1 rounded-xl text-xs" onClick={() => handleToggleFreeze(u.user_id, u.is_frozen)}>
                      {u.is_frozen ? <><ShieldCheck className="w-3 h-3 mr-1" />Unfreeze</> : <><ShieldAlert className="w-3 h-3 mr-1" />Ban/Freeze</>}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs border-destructive text-destructive" onClick={() => handleDecreaseBalance(u.user_id, u.wallet?.balance ?? 0)}>
                      Balance -10
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

      {/* Ban confirmation dialog with history */}
      <Dialog open={!!banDialog} onOpenChange={() => setBanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {banDialog?.mode === "bulk" ? `Ban Users (${banDialog.users.length})` : "Ban User"}
            </DialogTitle>
            <DialogDescription>
              {banDialog && banDialog.mode === "bulk"
                ? "You can ban all users at once or one by one."
                : "Review ban history before proceeding."}
            </DialogDescription>
          </DialogHeader>

          {banDialog && (
            <div className="space-y-3">
              {(() => {
                const u = banDialog.users[banDialog.currentIndex];
                if (!u) return null;
                return (
                  <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">{u.display_name || "No name"}</p>
                      {banDialog.mode === "bulk" && (
                        <Badge variant="outline" className="text-[10px]">{banDialog.currentIndex + 1} / {banDialog.users.length}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">ID: {u.user_id.slice(0, 12)}...</p>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${u.ban_count > 0 ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500/20 text-emerald-600'}`}>
                        {u.ban_count > 0 ? `Previously banned ${u.ban_count} time${u.ban_count > 1 ? 's' : ''}` : 'Never banned before'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Balance: Rs {(u.wallet?.balance ?? 0).toLocaleString()}</p>
                  </div>
                );
              })()}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Ban Duration (leave empty for permanent)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Hours (e.g. 24) — empty = permanent"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-9"
                  value={banDialog.durationHours}
                  onChange={e => setBanDialog({ ...banDialog, durationHours: e.target.value })}
                />
                <div className="flex gap-1.5 flex-wrap">
                  {["1", "6", "24", "72", "168"].map(h => (
                    <button key={h} onClick={() => setBanDialog({ ...banDialog, durationHours: h })}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${banDialog.durationHours === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                    >{h}h</button>
                  ))}
                  <button onClick={() => setBanDialog({ ...banDialog, durationHours: "" })}
                    className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${!banDialog.durationHours ? "bg-destructive text-destructive-foreground border-destructive" : "border-border text-muted-foreground"}`}
                  >Permanent</button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {banDialog?.mode === "bulk" && (
              <>
                <Button variant="destructive" className="w-full rounded-xl" disabled={banning}
                  onClick={async () => {
                    const u = banDialog.users[banDialog.currentIndex];
                    await executeBan(u.user_id, u.display_name, banDialog.durationHours);
                    if (banDialog.currentIndex + 1 < banDialog.users.length) {
                      setBanDialog({ ...banDialog, currentIndex: banDialog.currentIndex + 1 });
                    } else { setBanDialog(null); }
                  }}
                >
                  {banning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {banDialog.durationHours ? `Temp Ban ${banDialog.durationHours}h & Next` : "Permanent Ban & Next"}
                </Button>
                <Button variant="outline" className="w-full rounded-xl text-xs"
                  onClick={() => {
                    if (banDialog.currentIndex + 1 < banDialog.users.length) {
                      setBanDialog({ ...banDialog, currentIndex: banDialog.currentIndex + 1 });
                    } else { setBanDialog(null); }
                  }}
                >Skip This User</Button>
                <Button variant="destructive" className="w-full rounded-xl" disabled={banning}
                  onClick={async () => {
                    setBanning(true);
                    for (let i = banDialog.currentIndex; i < banDialog.users.length; i++) {
                      await executeBan(banDialog.users[i].user_id, banDialog.users[i].display_name, banDialog.durationHours);
                    }
                    setBanning(false); setBanDialog(null);
                  }}
                >
                  {banning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Ban All Remaining ({banDialog.users.length - banDialog.currentIndex})
                </Button>
              </>
            )}
            {banDialog?.mode === "single" && (
              <Button variant="destructive" className="w-full rounded-xl" disabled={banning}
                onClick={async () => {
                  const u = banDialog.users[0];
                  await executeBan(u.user_id, u.display_name, banDialog.durationHours);
                  setBanDialog(null);
                }}
              >
                {banning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {banDialog.durationHours ? `Confirm Temp Ban (${banDialog.durationHours}h)` : "Confirm Permanent Ban"}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setBanDialog(null)} className="w-full rounded-xl">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminUsers;
