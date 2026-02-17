import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine, ArrowUpFromLine, Gift, Package, Users, Copy,
  ChevronRight, FileText, HelpCircle, BarChart3, Headphones, Download, LogOut,
  Brain, Database as DbIcon, Cpu, Server, Zap, Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WalletData {
  balance: number;
  total_deposited: number;
  total_withdrawn: number;
  total_commission: number;
}

interface AiPackage {
  id: string;
  name: string;
  description: string | null;
  features: string[];
  price_onetime: number | null;
  price_monthly: number | null;
  cashback_percent: number | null;
  bonus_tag: string | null;
  is_active: boolean | null;
}

interface ReferralStats {
  tier1: number;
  tier2: number;
  tier3: number;
  total: number;
}

const fakeNotifications = [
  "75******28 rented Pro GPU Pack and got 100 bonus credits",
  "93******17 purchased Enterprise AI Suite — Rs 19,000",
  "61******45 earned Rs 345 cashback from GPU Cluster Pack",
];

const packageIcons = [Brain, DbIcon, Cpu, Server, Zap, Star];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [packages, setPackages] = useState<AiPackage[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [referralStats, setReferralStats] = useState<ReferralStats>({ tier1: 0, tier2: 0, tier3: 0, total: 0 });
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState(1);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [walletRes, pkgRes, profileRes, refRes, comRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("ai_packages").select("*").order("price_monthly", { ascending: true }),
        supabase.from("profiles").select("referral_code").eq("user_id", user.id).maybeSingle(),
        supabase.from("referrals").select("tier").eq("referrer_id", user.id),
        supabase.from("commissions").select("amount").eq("user_id", user.id),
      ]);
      setWallet(walletRes.data as WalletData | null);
      const pkgs = (pkgRes.data || []).map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] }));
      setPackages(pkgs as AiPackage[]);
      setReferralCode(profileRes.data?.referral_code || "");
      const refs = (refRes.data || []) as { tier: number }[];
      setReferralStats({
        tier1: refs.filter(r => r.tier === 1).length,
        tier2: refs.filter(r => r.tier === 2).length,
        tier3: refs.filter(r => r.tier === 3).length,
        total: refs.length,
      });
      setCommissionTotal((comRes.data || []).reduce((s: number, c: any) => s + Number(c.amount), 0));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast.success("Referral link copied!"); };

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Scrolling notification banner */}
      <div className="bg-primary/10 overflow-hidden h-8 flex items-center">
        <div className="animate-scroll-left whitespace-nowrap text-xs text-primary font-medium">
          🎉 {fakeNotifications[Math.floor(Date.now() / 10000) % fakeNotifications.length]}
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* ═══════ ACCOUNT BALANCE ═══════ */}
        <div className="gradient-balance rounded-2xl p-5 text-primary-foreground shadow-neu">
          <p className="text-sm font-medium opacity-90">Account balance</p>
          <p className="text-4xl font-heading font-bold mt-1">
            Rs {(wallet?.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <div className="flex gap-3 mt-4">
            <Link to="/deposit" className="flex-1">
              <Button className="w-full rounded-xl h-12 bg-success hover:bg-success/90 text-success-foreground font-semibold text-sm shadow-md">
                <ArrowDownToLine className="w-4 h-4 mr-1.5" />
                Deposit (තැන්පත් කරන්න)
              </Button>
            </Link>
            <Link to="/withdraw" className="flex-1">
              <Button className="w-full rounded-xl h-12 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-sm shadow-md">
                <ArrowUpFromLine className="w-4 h-4 mr-1.5" />
                Withdraw (මුදල් ගන්න)
              </Button>
            </Link>
          </div>
        </div>

        {/* ═══════ MY INCOME ═══════ */}
        <div>
          <h2 className="text-base font-heading font-bold text-foreground mb-3">My income</h2>
          <div className="shadow-neu rounded-2xl bg-card p-4 mb-3">
            <p className="text-3xl font-heading font-bold text-foreground">
              Rs {commissionTotal.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "AI DB Rental Commission", value: 0 },
              { label: "Package Sales Commission", value: 0 },
              { label: "Bonus Credits", value: 0 },
            ].map((item) => (
              <div key={item.label} className="shadow-neu rounded-xl bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
                <p className="text-sm font-heading font-bold text-foreground mt-1">Rs {item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ AI PACKAGES MALL ═══════ */}
        <div>
          <h2 className="text-base font-heading font-bold text-foreground mb-3">AI Packages Mall</h2>
          <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
            {packages.map((pkg, idx) => {
              const isComingSoon = !pkg.is_active;
              const price = pkg.price_onetime || pkg.price_monthly || 0;
              const cashbackAmt = pkg.cashback_percent ? Math.round(price * pkg.cashback_percent / 100) : 0;
              const IconComp = packageIcons[idx % packageIcons.length];
              const isHot = pkg.bonus_tag === "HOT";
              const isNew = pkg.bonus_tag === "NEW";

              return (
                <div
                  key={pkg.id}
                  className={cn(
                    "flex-shrink-0 w-[200px] rounded-2xl p-4 flex flex-col relative overflow-hidden transition-all",
                    isComingSoon
                      ? "bg-muted/70 opacity-60"
                      : "bg-card shadow-neu hover:shadow-card-hover",
                    isHot && "ring-2 ring-primary glow-orange w-[220px]"
                  )}
                >
                  {/* Badge */}
                  {pkg.bonus_tag && !isComingSoon && (
                    <Badge className={cn(
                      "absolute top-2 right-2 text-[10px] px-2 py-0.5",
                      isHot && "bg-destructive text-destructive-foreground",
                      isNew && "bg-secondary text-secondary-foreground",
                      !isHot && !isNew && "gradient-secondary text-secondary-foreground"
                    )}>
                      {pkg.bonus_tag}
                    </Badge>
                  )}

                  {/* Icon */}
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-3",
                    isComingSoon ? "bg-muted" : idx % 2 === 0 ? "gradient-primary" : "gradient-secondary",
                  )}>
                    <IconComp className={cn("w-7 h-7", isComingSoon ? "text-muted-foreground" : "text-primary-foreground")} />
                  </div>

                  {/* Info */}
                  <p className="text-sm font-heading font-bold text-foreground leading-tight">{pkg.name}</p>
                  <p className="text-lg font-heading font-bold text-primary mt-1">
                    Rs.{price.toLocaleString()}{pkg.price_monthly ? "/month" : ""}
                  </p>
                  {pkg.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{pkg.description}</p>
                  )}

                  {/* Cashback badge */}
                  {cashbackAmt > 0 && !isComingSoon && (
                    <Badge className="bg-success/15 text-success border-success/30 text-[10px] mt-2 w-fit">
                      Cashback Rs.{cashbackAmt}
                    </Badge>
                  )}

                  {/* Button */}
                  <div className="mt-auto pt-3">
                    {isComingSoon ? (
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg block text-center">Coming soon</span>
                    ) : (
                      <Link to="/packages">
                        <Button size="sm" className="w-full rounded-xl gradient-primary text-primary-foreground text-xs h-9 font-semibold">
                          Buy Now
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════ COMMISSION / TEAM ═══════ */}
        <div className="gradient-commission rounded-2xl p-5 text-primary-foreground">
          <h2 className="text-base font-heading font-bold mb-1">Commission (කොමිස්)</h2>
          <div className="text-center py-4">
            <p className="text-5xl font-heading font-bold">{referralStats.total}</p>
            <p className="text-sm opacity-80 mt-1">Total Team Members</p>
            <p className="text-xs opacity-70 mt-1">New today: 0 · Total consumption: Rs.0</p>
          </div>

          {/* Invite button */}
          <Button
            onClick={copyLink}
            className="w-full rounded-xl h-12 bg-card/20 hover:bg-card/30 text-primary-foreground font-semibold text-sm backdrop-blur-sm border border-primary-foreground/20"
          >
            <Users className="w-4 h-4 mr-2" />
            Invite friends (මිතුරන්ට ආරාධනා කරන්න)
          </Button>

          {/* Tier tabs */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((tier) => (
              <button
                key={tier}
                onClick={() => setActiveTier(tier)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-semibold transition-colors",
                  activeTier === tier
                    ? "bg-card/25 text-primary-foreground"
                    : "text-primary-foreground/60 hover:text-primary-foreground/80"
                )}
              >
                Tier-{tier} ({tier === 1 ? referralStats.tier1 : tier === 2 ? referralStats.tier2 : referralStats.tier3})
              </button>
            ))}
          </div>

          <div className="mt-3 text-xs opacity-80 space-y-1">
            <p>People joined: {activeTier === 1 ? referralStats.tier1 : activeTier === 2 ? referralStats.tier2 : referralStats.tier3}</p>
            <p>Recharged: 0</p>
            <p>New members today: 0</p>
          </div>
        </div>

        {/* ═══════ EXTRA LINKS ═══════ */}
        <div className="space-y-1">
          {[
            { label: "Recent open records", icon: FileText, path: "/transactions" },
            { label: "FAQ (ගැටළු)", icon: HelpCircle, path: "/settings" },
            { label: "Weekly report", icon: BarChart3, path: "/transactions" },
            { label: "Contact support", icon: Headphones, path: "/settings" },
            { label: "Download APP", icon: Download, path: "#" },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.path}
              className="flex items-center justify-between py-3 px-4 bg-card rounded-xl shadow-card hover:shadow-card-hover transition-shadow"
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-foreground">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}

          <button
            onClick={signOut}
            className="flex items-center gap-3 py-3 px-4 bg-card rounded-xl shadow-card w-full text-left hover:shadow-card-hover transition-shadow mt-2"
          >
            <LogOut className="w-5 h-5 text-destructive" />
            <span className="text-sm text-destructive font-medium">Logout</span>
          </button>
        </div>

        {/* Spacer for bottom nav */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default Dashboard;
