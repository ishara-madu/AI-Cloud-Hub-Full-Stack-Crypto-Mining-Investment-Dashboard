import { useEffect, useState } from "react";
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

interface UserPackage {
  id: string;
  package_id: string;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  price_paid: number;
  ai_packages: { name: string; description: string | null } | null;
}

// --- Random data generators ---
const randomPhone = () => {
  const prefix = ["74", "75", "76", "77", "78", "70", "71", "72"];
  return `+94${prefix[Math.floor(Math.random() * prefix.length)]}***${String(Math.floor(Math.random() * 900) + 100)}`;
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
  return tpl(randomPhone(), randomAmount(500, 25000));
};

const packageIcons = [Brain, DbIcon, Cpu, Server, Zap, Star];

const quickActions = [
  { label: "Sign-in", icon: CalendarCheck, path: "/daily-signin", dot: true },
  { label: "Group", icon: Send, path: "#telegram" },
  { label: "Deposit", icon: Wallet, path: "/deposit" },
  { label: "Cash Out", icon: Banknote, path: "/withdraw" },
  { label: "Support", icon: Headphones, path: "/settings" },
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

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [walletRes, pkgRes, profileRes, comRes, upRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("ai_packages").select("*").order("price_monthly", { ascending: true }),
        supabase.from("profiles").select("referral_code").eq("user_id", user.id).maybeSingle(),
        supabase.from("commissions").select("amount").eq("user_id", user.id),
        supabase.from("user_packages").select("*, ai_packages(name, description)").eq("user_id", user.id).eq("is_active", true).order("purchased_at", { ascending: false }),
      ]);
      setWallet(walletRes.data as WalletData | null);
      const pkgs = (pkgRes.data || []).map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] }));
      setPackages(pkgs as AiPackage[]);
      setReferralCode(profileRes.data?.referral_code || "");
      setCommissionTotal((comRes.data || []).reduce((s: number, c: any) => s + Number(c.amount), 0));
      setUserPackages((upRes.data || []) as UserPackage[]);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Marquee rotation with realistic delays
  useEffect(() => {
    const rotate = () => {
      setMarqueeMsg(generateMarqueeMsg());
    };
    const interval = setInterval(rotate, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  // Live payouts: add one at a time with random delays, never repeat
  useEffect(() => {
    let keyCounter = 0;
    const addPayout = () => {
      const newItem = { user: randomPhone(), amount: randomAmount(500, 20000), key: keyCounter++ };
      setLivePayouts((prev) => [newItem, ...prev.slice(0, 19)]); // keep max 20
    };
    // Seed initial items with staggered timing
    const seedTimeouts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 4; i++) {
      seedTimeouts.push(setTimeout(() => addPayout(), i * (1500 + Math.random() * 2000)));
    }
    // Ongoing additions
    const schedule = () => {
      const delay = 3000 + Math.random() * 5000;
      return setTimeout(() => {
        addPayout();
        timerRef = schedule();
      }, delay);
    };
    let timerRef = setTimeout(() => { timerRef = schedule(); }, 10000);
    return () => { seedTimeouts.forEach(clearTimeout); clearTimeout(timerRef); };
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

        {/* ═══════ MY ACTIVE PACKAGES ═══════ */}
        {userPackages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-heading font-bold text-foreground">📦 My Packages</h2>
              <Link to="/packages" className="text-xs text-primary font-medium flex items-center gap-0.5">
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
            <div className="divide-y divide-border/50">
              {livePayouts.map((p) => (
                <div key={p.key} className="flex items-center justify-between px-4 h-[38px] animate-fade-in">
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

        <div className="h-4" />
      </div>

    </div>
  );
};

export default Dashboard;
