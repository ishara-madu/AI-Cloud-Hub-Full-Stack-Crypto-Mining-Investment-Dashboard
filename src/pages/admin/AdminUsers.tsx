import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Search, User, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

interface UserRow {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  referral_code: string | null;
  created_at: string;
  wallet?: { balance: number; total_deposited: number; total_withdrawn: number; total_commission: number };
  role?: string;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");

  const fetchUsers = async () => {
    const [profilesRes, walletsRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("wallets").select("*"),
      supabase.from("user_roles").select("*"),
    ]);

    const walletMap = new Map((walletsRes.data || []).map((w) => [w.user_id, w]));
    const roleMap = new Map((rolesRes.data || []).map((r) => [r.user_id, r.role]));

    const rows: UserRow[] = (profilesRes.data || []).map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      phone: p.phone,
      referral_code: p.referral_code,
      created_at: p.created_at,
      wallet: walletMap.get(p.user_id) as any,
      role: roleMap.get(p.user_id) || "user",
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

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || (u.display_name?.toLowerCase().includes(q)) || u.user_id.includes(q) || (u.phone?.includes(q));
  });

  if (loading) return <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-xl font-heading font-bold text-foreground">Users ({users.length})</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 rounded-xl" placeholder="Search by name, ID, phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="space-y-3">
        {filtered.map((u) => (
          <Card key={u.user_id} className="shadow-neu">
            <CardContent className="p-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{u.display_name || "No name"}</p>
                    <p className="text-[10px] text-muted-foreground">ID: {u.user_id.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">Rs {(u.wallet?.balance ?? 0).toLocaleString()}</p>
                  <Badge className={u.role === "admin" ? "bg-red-500/20 text-red-500 text-[9px]" : "bg-primary/10 text-primary text-[9px]"}>{u.role}</Badge>
                </div>
              </div>

              {expandedUser === u.user_id && (
                <div className="mt-4 pt-4 border-t border-border space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{u.phone || "N/A"}</span></div>
                    <div><span className="text-muted-foreground">Referral:</span> <span className="font-medium">{u.referral_code || "N/A"}</span></div>
                    <div><span className="text-muted-foreground">Deposited:</span> <span className="font-medium">Rs {(u.wallet?.total_deposited ?? 0).toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Withdrawn:</span> <span className="font-medium">Rs {(u.wallet?.total_withdrawn ?? 0).toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Commission:</span> <span className="font-medium">Rs {(u.wallet?.total_commission ?? 0).toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Joined:</span> <span className="font-medium">{new Date(u.created_at).toLocaleDateString()}</span></div>
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="New balance" className="rounded-xl h-9 text-sm" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} />
                    <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground" onClick={() => handleUpdateBalance(u.user_id)}>
                      <Wallet className="w-3 h-3 mr-1" />Set
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
