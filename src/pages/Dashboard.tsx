import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine, ArrowUpFromLine, Package, Users, Copy,
  ChevronRight, FileText, HelpCircle, BarChart3, Headphones, Download, LogOut,
  Brain, Database as DbIcon, Cpu, Server, Zap, Star,
  Megaphone, CalendarCheck, Send, Wallet, Banknote, Info,
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

interface UserPackage {
  id: string;
  package_id: string;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  price_paid: number;
  ai_packages: { name: string; description: string | null } | null;
}

interface SliderBanner {
  id: string;
  title: string;
  subtitle: string | null;
  gradient: string;
  sort_order: number;
  image_url: string | null;
}

// --- Random data generators ---
const randomEmail = () => {
  const names = ["sam", "nimal", "kamal", "saman", "ruwan", "dilshan", "chamara", "thilina", "nuwan", "kasun", "supun", "dasun", "dinesh", "amila", "lahiru", "hasitha", "pradeep", "suresh", "roshan", "janaka"];
  const name = names[Math.floor(Math.random() * names.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${name}${num}@gmail.com`;
};
const randomAmount = (min: number, max: number) =>
  Math.round((Math.floor(Math.random() * (max - min + 1)) + min) / 50) * 50;

const marqueeTemplates = [
  (p: string, a: number) => `${p} withdrew Rs.${a.toLocaleString()} successfully ✅`,
  (p: string, a: number) => `${p} deposited Rs.${a.toLocaleString()} via bank transfer`,
  (p: string, a: number) => `${p} received Rs.${a.toLocaleString()} bonus credits 🎁`,
  (p: string, a: number) => `${p} rented AI Pack and earned Rs.${a.toLocaleString()} cashback`,
  (p: string, a: number) => `${p} purchased GPU Package — Rs.${a.toLocaleString()}`,
];

const generateMarqueeMsg = () => {
  const tpl = marqueeTemplates[Math.floor(Math.random() * marqueeTemplates.length)];
  return tpl(randomEmail(), randomAmount(500, 25000));
};

const packageIcons = [Brain, DbIcon, Cpu, Server, Zap, Star];

const quickActions: { label: string; icon: any; path: string; dot?: boolean; external?: string }[] = [
  { label: "Sign-in", icon: CalendarCheck, path: "/daily-signin", dot: false },
  { label: "Group", icon: Send, path: "#telegram", external: "https://t.me/aicloudhub" },
  { label: "Deposit", icon: Wallet, path: "/deposit" },
  { label: "Cash Out", icon: Banknote, path: "/withdraw" },
  { label: "Support", icon: Headphones, path: "#support", external: "https://wa.me/94771234567" },
  { label: "About Us", icon: Info, path: "/about" },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [packages, setPackages] = useState<AiPackage[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [marqueeMsg, setMarqueeMsg] = useState(() => generateMarqueeMsg());
  const [livePayouts, setLivePayouts] = useState<{ user: string; amount: number; key: number }[]>([]);
  const [banners, setBanners] = useState<SliderBanner[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [dailyCheckedIn, setDailyCheckedIn] = useState(false);
  const [todayPackageIncome, setTodayPackageIncome] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setActiveSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    onSelect();
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
    // First, try to auto-credit today's package income
      const { data: incomeResult } = await supabase.rpc("claim_package_daily_income" as any);
      const incomeAmount = (incomeResult as any)?.amount ?? 0;
      const alreadyClaimed = (incomeResult as any)?.already_claimed ?? false;

      // Use UTC midnight to match the database's CURRENT_DATE (which is UTC-based)
      const todayStartUtc = new Date();
      todayStartUtc.setUTCHours(0, 0, 0, 0);

      const [walletRes, pkgRes, profileRes, upRes, bannersRes, todayIncomeRes, todayAllCommRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("ai_packages").select("*").order("price_monthly", { ascending: true }),
        supabase.from("profiles").select("referral_code").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_packages").select("*, ai_packages(name, description)").eq("user_id", user.id).eq("is_active", true).order("purchased_at", { ascending: false }),
        supabase.from("slider_banners").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        // Today's credited package income (UTC-aligned)
        supabase.from("transactions").select("amount").eq("user_id", user.id).eq("type", "commission").eq("status", "approved").ilike("description", "Daily package income%").gte("created_at", todayStartUtc.toISOString()),
        // Today's ALL commission (package income + referral) for "Today Earned" display
        supabase.from("transactions").select("amount").eq("user_id", user.id).eq("type", "commission").eq("status", "approved").gte("created_at", todayStartUtc.toISOString()),
      ]);

      setWallet(walletRes.data as WalletData | null);
      const pkgs = (pkgRes.data || []).map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] }));
      setPackages(pkgs as AiPackage[]);
      setReferralCode(profileRes.data?.referral_code || "");
      const activePkgs = (upRes.data || []) as UserPackage[];
      setUserPackages(activePkgs);
      setBanners((bannersRes.data || []) as SliderBanner[]);

      // Today's package income from DB (UTC-aligned)
      const todayIncome = (todayIncomeRes.data || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
      // Today's total commissions (package + referral)
      const todayAllComm = (todayAllCommRes.data || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
      setTodayPackageIncome(todayIncome);
      // commissionTotal = today's full earned (package income + referral commissions)
      setCommissionTotal(todayAllComm);

      if (incomeAmount > 0 && !alreadyClaimed) {
        toast.success(`+Rs ${incomeAmount.toLocaleString()} package income credited! 💰`);
      }

      // Check daily sign-in status
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: signinData } = await supabase
        .from("daily_signins")
        .select("id")
        .eq("user_id", user.id)
        .eq("signed_in_date", todayStr)
        .maybeSingle();
      setDailyCheckedIn(!!signinData);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Marquee rotation with realistic low-traffic delays (15-45 seconds)
  useEffect(() => {
    const rotate = () => {
      setMarqueeMsg(generateMarqueeMsg());
    };
    const schedule = () => {
      const delay = 15000 + Math.random() * 30000; // 15-45 seconds
      return setTimeout(() => {
        rotate();
        timerRef = schedule();
      }, delay);
    };
    let timerRef = schedule();
    return () => clearTimeout(timerRef);
  }, []);

  // Live payouts: slow realistic pace for low-traffic site
  useEffect(() => {
    let keyCounter = 0;
    const addPayout = () => {
      const newItem = { user: randomEmail(), amount: randomAmount(500, 20000), key: keyCounter++ };
      setLivePayouts((prev) => [newItem, ...prev.slice(0, 19)]);
    };
    // Seed 3 initial items slowly
    const seedTimeouts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 3; i++) {
      seedTimeouts.push(setTimeout(() => addPayout(), i * 3000));
    }
    // Then add new ones every 20-60 seconds
    const schedule = (): ReturnType<typeof setTimeout> => {
      const delay = 20000 + Math.random() * 40000;
      return setTimeout(() => {
        addPayout();
        timerRef = schedule();
      }, delay);
    };
    let timerRef = setTimeout(() => { timerRef = schedule(); }, 12000);
    return () => { seedTimeouts.forEach(clearTimeout); clearTimeout(timerRef); };
  }, []);

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast.success("Referral link copied!"); };

  // Countdown timer
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

  const slidesToShow = banners.length > 0 ? banners : [
    { id: "1", title: "New User Bonus!", subtitle: "Get Rs.100 Free on Signup", gradient: "from-yellow-500 via-red-500 to-orange-500", sort_order: 1, image_url: null },
    { id: "2", title: "Llama 3 Models Available", subtitle: "Rent Now for Best Returns!", gradient: "from-teal-500 via-cyan-500 to-blue-500", sort_order: 2, image_url: null },
    { id: "3", title: "Invite 5 Friends", subtitle: "Win Rs.5,000 Reward!", gradient: "from-orange-500 via-pink-500 to-purple-500", sort_order: 3, image_url: null },
  ];

  // todayPackageIncome is set from the DB after auto-credit

  return (
    <div className="animate-fade-in">
      {/* ═══════ MARQUEE ═══════ */}
      <div className="bg-primary/10 overflow-hidden h-8 flex items-center gap-2 px-3">
        <Megaphone className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="overflow-hidden flex-1">
          <div key={marqueeMsg} className="animate-scroll-left whitespace-nowrap text-xs text-primary font-medium">
            🎉 {marqueeMsg}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* ═══════ PROMO CAROUSEL ═══════ */}
        <Carousel
          opts={{ loop: true }}
          plugins={[Autoplay({ delay: 4000, stopOnInteraction: false })]}
          className="w-full"
          setApi={setCarouselApi}
        >
          <CarouselContent>
            {slidesToShow.map((slide) => (
              <CarouselItem key={slide.id}>
                <div className={cn(
                  "rounded-2xl p-5 aspect-[16/7] flex flex-col justify-end text-white relative overflow-hidden",
                  slide.image_url ? "" : `bg-gradient-to-br ${slide.gradient}`
                )}>
                  {slide.image_url && (
                    <img src={slide.image_url} alt={slide.title} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="relative z-10">
                    <p className="text-lg font-heading font-bold leading-tight">{slide.title}</p>
                    <p className="text-sm opacity-90 mt-0.5">{slide.subtitle}</p>
                  </div>
                  {!slide.image_url && <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />}
                  {!slide.image_url && <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10" />}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="flex justify-center gap-1.5 mt-2">
            {slidesToShow.map((_, i) => (
              <button
                key={i}
                className={cn(
                  "rounded-full transition-all",
                  activeSlide === i ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-primary/30"
                )}
                onClick={() => carouselApi?.scrollTo(i)}
              />
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
            <h2 className="text-base font-heading font-bold text-foreground">Today's Overview</h2>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Refreshes in {countdown}
            </span>
          </div>
          {/* Balance + today's income summary */}
          <div className="shadow-neu rounded-2xl bg-card p-4 mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Account Balance</p>
              <p className="text-2xl font-heading font-bold text-foreground">
                Rs {(wallet?.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </p>
            </div>
            {todayPackageIncome > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground mb-0.5">Credited Today</p>
                <p className="text-base font-heading font-bold text-success">+Rs {todayPackageIncome.toLocaleString()}</p>
              </div>
            )}
          </div>
          {/* Three distinct stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="shadow-neu rounded-xl bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground leading-tight">Today Earned</p>
              <p className="text-sm font-heading font-bold mt-1 text-success">Rs {commissionTotal.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Pkg + Referrals</p>
            </div>
            <div className="shadow-neu rounded-xl bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground leading-tight">Today Pkg</p>
              <p className="text-sm font-heading font-bold mt-1 text-primary">Rs {todayPackageIncome.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Package only</p>
            </div>
            <div className="shadow-neu rounded-xl bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground leading-tight">Total Earned</p>
              <p className="text-sm font-heading font-bold mt-1 text-foreground">Rs {(wallet?.total_commission ?? 0).toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">All time</p>
            </div>
          </div>
        </div>

        {/* ═══════ MY ACTIVE PACKAGES ═══════ */}
        {userPackages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-heading font-bold text-foreground">📦 My Packages</h2>
              <Link to="/packages?section=my-packages" className="text-xs text-primary font-medium flex items-center gap-0.5">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
              {userPackages.slice(0, 5).map((up) => {
                const dailyIncome = Math.round(up.price_paid * 0.05);
                const totalDays = up.expires_at
                  ? Math.ceil((new Date(up.expires_at).getTime() - new Date(up.purchased_at).getTime()) / 86400000)
                  : 30;
                const daysElapsed = Math.min(
                  Math.ceil((Date.now() - new Date(up.purchased_at).getTime()) / 86400000),
                  totalDays
                );
                const daysRemaining = Math.max(totalDays - daysElapsed, 0);
                const progressPct = Math.round((daysElapsed / totalDays) * 100);

                return (
                  <div key={up.id} className="flex-shrink-0 w-[180px] shadow-neu rounded-2xl bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-heading font-bold text-foreground line-clamp-1">
                        {(up.ai_packages as any)?.name || "Package"}
                      </p>
                      <span className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
                    </div>
                    <p className="text-lg font-heading font-bold text-primary">Rs.{up.price_paid.toLocaleString()}</p>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Daily: <span className="text-success font-bold">Rs.{dailyIncome}</span></span>
                      <span>{daysRemaining}d left</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full gradient-primary rounded-full" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════ QUICK ACTION GRID ═══════ */}
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const showDot = action.label === "Sign-in" && !dailyCheckedIn;
            const content = (
              <div className="flex flex-col items-center gap-1.5 py-3 bg-card rounded-2xl shadow-neu hover:shadow-card-hover transition-shadow">
                <div className="relative w-11 h-11 rounded-full gradient-primary flex items-center justify-center">
                  <action.icon className="w-5 h-5 text-primary-foreground" />
                  {showDot && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-destructive rounded-full border-2 border-card" />
                  )}
                </div>
                <span className="text-[11px] font-medium text-foreground">{action.label}</span>
              </div>
            );
            if (action.external) {
              return (
                <a key={action.label} href={action.external} target="_blank" rel="noopener noreferrer">
                  {content}
                </a>
              );
            }
            return (
              <Link key={action.label} to={action.path}>
                {content}
              </Link>
            );
          })}
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
            <div className="absolute inset-0 overflow-y-auto scrollbar-hide">
              <div className="divide-y divide-border/50">
                {livePayouts.map((p) => (
                  <div key={p.key} className="flex items-center justify-between px-4 h-[38px] animate-fade-in">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      <span>{p.user} withdrew</span>
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
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
};

export default Dashboard;
