import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Users, Copy, Link as LinkIcon, Gift } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Referral {
  id: string;
  referred_id: string;
  tier: number;
  created_at: string;
}

interface Commission {
  id: string;
  amount: number;
  tier: number;
  created_at: string;
}

const Team = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, refRes, comRes] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("user_id", user.id).maybeSingle(),
        supabase.from("referrals").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("commissions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setReferralCode(profileRes.data?.referral_code || "");
      setReferrals((refRes.data || []) as Referral[]);
      setCommissions((comRes.data || []) as Commission[]);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast.success("Referral link copied!"); };

  const tierReferrals = (tier: number) => referrals.filter((r) => r.tier === tier);
  const tierCommissions = (tier: number) => commissions.filter((c) => c.tier === tier).reduce((s, c) => s + c.amount, 0);
  const totalCommission = commissions.reduce((s, c) => s + c.amount, 0);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-heading font-bold text-foreground">Team & Referrals</h1>

      {/* Referral link */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading flex items-center gap-2"><LinkIcon className="w-5 h-5 text-primary" /> Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="bg-muted text-sm" />
            <Button onClick={copyLink} variant="outline" size="icon"><Copy className="w-4 h-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Share this link to earn commissions from your team's activity</p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((tier) => (
          <Card key={tier} className="shadow-card border-border/50">
            <CardContent className="p-5 text-center">
              <Badge variant="outline" className="mb-3">Tier {tier}</Badge>
              <p className="text-3xl font-heading font-bold text-foreground">{tierReferrals(tier).length}</p>
              <p className="text-sm text-muted-foreground">Members</p>
              <p className="text-sm font-medium text-success mt-2">${tierCommissions(tier).toFixed(2)} earned</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total */}
      <Card className="shadow-card border-border/50 gradient-secondary text-secondary-foreground">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8" />
            <div>
              <p className="font-heading font-bold text-lg">Total Commission Earned</p>
              <p className="text-sm opacity-80">{referrals.length} total team members</p>
            </div>
          </div>
          <p className="text-3xl font-heading font-bold">${totalCommission.toFixed(2)}</p>
        </CardContent>
      </Card>

      {/* Team list */}
      {referrals.length > 0 && (
        <Card className="shadow-card border-border/50">
          <CardHeader><CardTitle className="text-lg font-heading">Team Members</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Member ID</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Tier</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Joined</th>
                </tr></thead>
                <tbody>
                  {referrals.map((ref) => (
                    <tr key={ref.id} className="border-b border-border/50 last:border-0">
                      <td className="p-4 font-mono text-xs">{ref.referred_id.slice(0, 8)}...</td>
                      <td className="p-4"><Badge variant="outline">Tier {ref.tier}</Badge></td>
                      <td className="p-4 text-muted-foreground">{new Date(ref.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Team;
