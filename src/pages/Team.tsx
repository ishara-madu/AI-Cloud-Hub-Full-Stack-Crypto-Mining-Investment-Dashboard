import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import LoadingScreen from "@/components/LoadingScreen";
import { toast } from "sonner";
import { Users, Copy, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Referral {
  id: string;
  referred_id: string;
  tier: number;
  created_at: string;
}

interface CommissionRates {
  level_1?: number;
  level_2?: number;
  level_3?: number;
}

const Team = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [commissionByUser, setCommissionByUser] = useState<Map<string, number>>(new Map());
  const [commissionRates, setCommissionRates] = useState<CommissionRates>({});
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState(1);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, refRes, comRes, ratesRes] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("user_id", user.id).maybeSingle(),
        supabase.from("referrals").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("commissions").select("amount, from_user_id").eq("user_id", user.id),
        supabase.from("platform_settings").select("value").eq("key", "commission_rates").maybeSingle(),
      ]);
      setReferralCode(profileRes.data?.referral_code || "");
      setReferrals((refRes.data || []) as Referral[]);

      const commissions = comRes.data || [];
      setTotalCommission(commissions.reduce((s: number, c: any) => s + Number(c.amount), 0));

      // Build per-user commission map
      const userComMap = new Map<string, number>();
      commissions.forEach((c: any) => {
        if (c.from_user_id) {
          userComMap.set(c.from_user_id, (userComMap.get(c.from_user_id) || 0) + Number(c.amount));
        }
      });
      setCommissionByUser(userComMap);

      setCommissionRates((ratesRes.data?.value as CommissionRates) || {});
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast.success("Invitation link copied!"); };

  const tierRefs = (tier: number) => referrals.filter((r) => r.tier === tier);

  const getTierRate = (tier: number) => {
    if (tier === 1) return commissionRates.level_1 || 0;
    if (tier === 2) return commissionRates.level_2 || 0;
    return commissionRates.level_3 || 0;
  };

  const getEmptyMessage = (tier: number) => {
    const rate = getTierRate(tier);
    return rate > 0 ? `Invite friends to earn ${rate}% commission!` : "Invite friends to earn commission!";
  };

  if (loading) {
    return <LoadingScreen title="Loading Team Report" subtitle="Structuring referral trees..." />;
  }

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4">
        <h1 className="text-lg font-heading font-bold text-foreground mb-4">My Team</h1>
      </div>

      <div className="px-4 space-y-5 pb-8">
        {/* Overview Card */}
        <div className="gradient-commission rounded-2xl p-5 text-primary-foreground">
          <div className="text-center mb-4">
            <p className="text-sm opacity-80">Total Commission</p>
            <p className="text-3xl font-heading font-bold mt-1">Rs {totalCommission.toFixed(2)}</p>
            <p className="text-sm opacity-80 mt-2">Total Members: {referrals.length}</p>
          </div>
          <Button
            onClick={copyLink}
            className="w-full rounded-xl h-12 bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground font-semibold text-sm backdrop-blur-sm border border-primary-foreground/20"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Invitation Link
          </Button>
        </div>

        {/* Tier Tabs */}
        <div className="flex gap-2">
          {[
            { tier: 1, label: `Level 1 (${getTierRate(1)}%)` },
            { tier: 2, label: `Level 2 (${getTierRate(2)}%)` },
            { tier: 3, label: `Level 3 (${getTierRate(3)}%)` },
          ].map(({ tier, label }) => (
            <button
              key={tier}
              onClick={() => setActiveTier(tier)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all",
                activeTier === tier
                  ? "gradient-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {label} ({tierRefs(tier).length})
            </button>
          ))}
        </div>

        {/* Member List */}
        {tierRefs(activeTier).length === 0 ? (
          <div className="shadow-neu rounded-2xl bg-card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{getEmptyMessage(activeTier)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tierRefs(activeTier).map((ref) => {
              const maskedId = ref.referred_id.slice(0, 2) + "***" + ref.referred_id.slice(-3);
              const earned = commissionByUser.get(ref.referred_id) || 0;
              return (
                <div key={ref.id} className="shadow-neu rounded-xl bg-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground font-mono">{maskedId}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(ref.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-[10px] text-success">Active</span>
                    </div>
                    <p className={cn("text-xs mt-0.5", earned > 0 ? "text-success font-semibold" : "text-muted-foreground")}>
                      Rs {earned.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Team;
