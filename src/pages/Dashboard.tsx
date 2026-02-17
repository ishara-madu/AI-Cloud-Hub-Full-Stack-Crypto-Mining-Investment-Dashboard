import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine, ArrowUpFromLine, Package, Users, Copy,
  ChevronRight, FileText, HelpCircle, BarChart3, Headphones, Download, LogOut,
  Brain, Database as DbIcon, Cpu, Server, Zap, Star,
  Megaphone, CalendarCheck, Send, Wallet, Banknote, Info, MessageCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Autoplay from "embla-carousel-autoplay";

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

const fakeNotifications = [
  "+9475******28 rented Pro GPU Pack and got 100 bonus credits",
  "+9493******17 purchased Enterprise AI Suite — Rs 19,000",
  "+9461******45 earned Rs 345 cashback from GPU Cluster Pack",
  "+9477******92 withdrew Rs 5,000 successfully",
];

const fakeLivePayouts = [
  { user: "+9477***123", amount: 2500, time: "just now" },
  { user: "+9471***456", amount: 5000, time: "2 min ago" },
  { user: "+9476***789", amount: 1200, time: "5 min ago" },
  { user: "+9470***321", amount: 8500, time: "8 min ago" },
  { user: "+9478***654", amount: 3200, time: "12 min ago" },
  { user: "+9474***987", amount: 15000, time: "15 min ago" },
  { user: "+9472***111", amount: 750, time: "18 min ago" },
  { user: "+9479***222", amount: 4300, time: "22 min ago" },
];

const packageIcons = [Brain, DbIcon, Cpu, Server, Zap, Star];

const quickActions = [
  { label: "Sign-in", icon: CalendarCheck, path: "/dashboard", dot: true },
  { label: "Group", icon: Send, path: "#telegram" },
  { label: "Deposit", icon: Wallet, path: "/deposit" },
  { label: "Cash Out", icon: Banknote, path: "/withdraw" },
  { label: "Support", icon: Headphones, path: "/settings" },
  { label: "Company", icon: Info, path: "/settings" },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [packages, setPackages] = useState<AiPackage[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [payoutIndex, setPayoutIndex] = useState(0);
  const payoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [walletRes, pkgRes, profileRes, comRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("ai_packages").select("*").order("price_monthly", { ascending: true }),
        supabase.from("profiles").select("referral_code").eq("user_id", user.id).maybeSingle(),
        supabase.from("commissions").select("amount").eq("user_id", user.id),
      ]);
      setWallet(walletRes.data as WalletData | null);
      const pkgs = (pkgRes.data || []).map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] }));
      setPackages(pkgs as AiPackage[]);
      setReferralCode(profileRes.data?.referral_code || "");
      setCommissionTotal((comRes.data || []).reduce((s: number, c: any) => s + Number(c.amount), 0));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Live payout auto-scroll
  useEffect(() => {
    const interval = setInterval(() => {
      setPayoutIndex((prev) => (prev + 1) % fakeLivePayouts.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast.success("Referral link copied!"); };

  // Countdown timer (fake 23h 59m)
  const [countdown, setCountdown] = useState("23h 59m");
  useEffect(() => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const diff = endOfDay.getTime() - now.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    setCountdown(`${h}h ${m}m`);
    const timer = setInterval(() => {
      const n = new Date();
      const d = endOfDay.getTime() - n.getTime();
      if (d <= 0) { setCountdown("0h 0m"); return; }
      setCountdown(`${Math.floor(d / 3600000)}h ${Math.floor((d % 3600000) / 60000)}m`);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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
      {/* ═══════ MARQUEE ═══════ */}
      <div className="bg-primary/10 overflow-hidden h-8 flex items-center gap-2 px-3">
        <Megaphone className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="overflow-hidden flex-1">
          <div className="animate-scroll-left whitespace-nowrap text-xs text-primary font-medium">
            🎉 {fakeNotifications[Math.floor(Date.now() / 10000) % fakeNotifications.length]}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* ═══════ PROMO CAROUSEL ═══════ */}
        <Carousel
          opts={{ loop: true }}
          plugins={[Autoplay({ delay: 4000, stopOnInteraction: false })]}
          className="w-full"
        >
          <CarouselContent>
            {[
              { title: "New User Bonus!", sub: "Get Rs.100 Free on Signup", gradient: "from-yellow-500 via-red-500 to-orange-500" },
              { title: "Llama 3 Models Available", sub: "Rent Now for Best Returns!", gradient: "from-teal-500 via-cyan-500 to-blue-500" },
              { title: "Invite 5 Friends", sub: "Win Rs.5,000 Reward!", gradient: "from-orange-500 via-pink-500 to-purple-500" },
            ].map((slide, i) => (
              <CarouselItem key={i}>
                <div className={cn(
                  "rounded-2xl p-5 aspect-[16/7] flex flex-col justify-end bg-gradient-to-br text-white relative overflow-hidden",
                  slide.gradient
                )}>
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="relative z-10">
                    <p className="text-lg font-heading font-bold leading-tight">{slide.title}</p>
                    <p className="text-sm opacity-90 mt-0.5">{slide.sub}</p>
                  </div>
                  {/* Decorative circles */}
                  <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="flex justify-center gap-1.5 mt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/30" />
            ))}
          </div>
        </Carousel>

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
                Deposit
              </Button>
            </Link>
            <Link to="/withdraw" className="flex-1">
              <Button className="w-full rounded-xl h-12 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-sm shadow-md">
                <ArrowUpFromLine className="w-4 h-4 mr-1.5" />
                Withdraw
              </Button>
            </Link>
          </div>
        </div>

        {/* ═══════ MY INCOME ═══════ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-heading font-bold text-foreground">My Income</h2>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Refreshes in {countdown}
            </span>
          </div>
          <div className="shadow-neu rounded-2xl bg-card p-4 mb-3">
            <p className="text-3xl font-heading font-bold text-foreground">
              Rs {commissionTotal.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "AI DB Rental", value: 0 },
              { label: "Package Sales", value: 0 },
              { label: "Bonus Credits", value: 0 },
            ].map((item) => (
              <div key={item.label} className="shadow-neu rounded-xl bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
                <p className="text-sm font-heading font-bold text-foreground mt-1">Rs {item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ QUICK ACTION GRID ═══════ */}
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.path}
              className="flex flex-col items-center gap-1.5 py-3 bg-card rounded-2xl shadow-neu hover:shadow-card-hover transition-shadow"
            >
              <div className="relative w-11 h-11 rounded-full gradient-primary flex items-center justify-center">
                <action.icon className="w-5 h-5 text-primary-foreground" />
                {action.dot && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-destructive rounded-full border-2 border-card" />
                )}
              </div>
              <span className="text-[11px] font-medium text-foreground">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* ═══════ AI PACKAGES MALL ═══════ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-heading font-bold text-foreground">AI Packages Mall</h2>
            <Link to="/packages" className="text-xs text-primary font-medium flex items-center gap-0.5">
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
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

                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-3",
                    isComingSoon ? "bg-muted" : idx % 2 === 0 ? "gradient-primary" : "gradient-secondary",
                  )}>
                    <IconComp className={cn("w-7 h-7", isComingSoon ? "text-muted-foreground" : "text-primary-foreground")} />
                  </div>

                  <p className="text-sm font-heading font-bold text-foreground leading-tight">{pkg.name}</p>
                  <p className="text-lg font-heading font-bold text-primary mt-1">
                    Rs.{price.toLocaleString()}{pkg.price_monthly ? "/month" : ""}
                  </p>
                  {pkg.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{pkg.description}</p>
                  )}

                  {cashbackAmt > 0 && !isComingSoon && (
                    <Badge className="bg-success/15 text-success border-success/30 text-[10px] mt-2 w-fit">
                      Cashback Rs.{cashbackAmt}
                    </Badge>
                  )}

                  {/* Limited stock on HOT items */}
                  {isHot && (
                    <p className="text-[10px] text-destructive font-semibold mt-2">🔥 Limited Stock: 14 left</p>
                  )}

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

        {/* ═══════ LIVE PAYOUTS ═══════ */}
        <div>
          <h2 className="text-base font-heading font-bold text-foreground mb-3">Live Withdrawals</h2>
          <div className="bg-card rounded-2xl shadow-neu overflow-hidden h-[150px] relative">
            <div
              ref={payoutRef}
              className="transition-transform duration-500 ease-in-out"
              style={{ transform: `translateY(-${payoutIndex * 38}px)` }}
            >
              {[...fakeLivePayouts, ...fakeLivePayouts].map((p, i) => (
                <div key={i} className="flex items-center justify-between px-4 h-[38px] border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span>User {p.user} withdrew</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-success">Rs.{p.amount.toLocaleString()}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-success/30 text-success">
                      Success
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════ INVITE BANNER ═══════ */}
        <div className="gradient-commission rounded-2xl p-5 text-primary-foreground">
          <h2 className="text-base font-heading font-bold mb-1">Invite & Earn</h2>
          <p className="text-sm opacity-80 mb-3">Invite friends and earn up to 12% commission on every package they buy.</p>
          <Button
            onClick={copyLink}
            className="w-full rounded-xl h-12 bg-card/20 hover:bg-card/30 text-primary-foreground font-semibold text-sm backdrop-blur-sm border border-primary-foreground/20"
          >
            <Users className="w-4 h-4 mr-2" />
            Copy Invitation Link
          </Button>
        </div>

        <div className="h-4" />
      </div>

      {/* ═══════ FLOATING WHATSAPP ═══════ */}
      <a
        href="https://wa.me/94700000000"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-success shadow-lg flex items-center justify-center animate-pulse hover:scale-110 transition-transform"
      >
        <MessageCircle className="w-7 h-7 text-success-foreground" />
      </a>
    </div>
  );
};

export default Dashboard;
