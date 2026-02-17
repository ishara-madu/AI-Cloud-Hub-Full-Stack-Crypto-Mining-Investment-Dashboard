import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, Gift } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DailySignIn = () => {
  const { user } = useAuth();
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [weekSignins, setWeekSignins] = useState<string[]>([]);

  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  useEffect(() => {
    if (!user) return;
    const fetchSignins = async () => {
      // Get this week's sign-ins (Mon to Sun)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("daily_signins")
        .select("signed_in_date")
        .eq("user_id", user.id)
        .gte("signed_in_date", monday.toISOString().split("T")[0])
        .order("signed_in_date", { ascending: true });

      const dates = (data || []).map((d: any) => d.signed_in_date);
      setWeekSignins(dates);

      // Check if already signed in today
      const todayStr = new Date().toISOString().split("T")[0];
      setCheckedIn(dates.includes(todayStr));
      setLoading(false);
    };
    fetchSignins();
  }, [user]);

  const handleCheckIn = async () => {
    if (!user || checkedIn) return;
    setChecking(true);

    const todayStr = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("daily_checkin");
    if (error) {
      toast.error("Failed to sign in");
      setChecking(false);
      return;
    }
    const result = data as any;
    if (!result?.success) {
      toast.error(result?.error || "Check-in failed");
      setChecking(false);
      return;
    }

    setCheckedIn(true);
    setWeekSignins([...weekSignins, todayStr]);
    toast.success("Success! Rs 10 added to balance.");
    setChecking(false);
  };

  // Calculate streak from this week's sign-ins
  const getStreak = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const allDates = checkedIn ? [...new Set([...weekSignins, todayStr])] : weekSignins;
    return allDates.length;
  };

  const isDaySignedIn = (dayIdx: number) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + mondayOffset + dayIdx);
    const dateStr = targetDate.toISOString().split("T")[0];
    return weekSignins.includes(dateStr);
  };

  if (loading) return <div className="px-4 py-6 space-y-4"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-14 rounded-2xl" /></div>;

  return (
    <div className="animate-fade-in px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="w-16 h-16 rounded-full gradient-primary mx-auto flex items-center justify-center shadow-lg">
          <Gift className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-heading font-bold text-foreground mt-3">Daily Rewards</h1>
        <p className="text-xs text-muted-foreground">Sign in every day to earn bonus rewards!</p>
      </div>

      {/* 7-day calendar */}
      <div className="shadow-neu rounded-2xl bg-card p-4">
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, i) => {
            const isToday = i === todayIdx;
            const signed = isDaySignedIn(i);
            const isPast = i < todayIdx;
            return (
              <div
                key={day}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all",
                  isToday && "gradient-primary text-primary-foreground shadow-lg scale-105",
                  signed && !isToday && "bg-success/10",
                  !isToday && !signed && isPast && "bg-muted/50",
                  !isToday && !signed && !isPast && "bg-card"
                )}
              >
                <span className={cn(
                  "text-[10px] font-medium",
                  isToday ? "text-primary-foreground" : "text-muted-foreground"
                )}>
                  {day}
                </span>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                  isToday ? "bg-white/20 text-primary-foreground" : signed ? "bg-success/20 text-success" : isPast ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {signed ? "✓" : i + 1}
                </div>
                <span className={cn(
                  "text-[9px]",
                  isToday ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  +Rs.10
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Check In Button */}
      <Button
        onClick={handleCheckIn}
        disabled={checkedIn || checking}
        className={cn(
          "w-full rounded-2xl h-14 text-base font-heading font-bold shadow-lg transition-all",
          checkedIn
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "gradient-primary text-primary-foreground glow-orange hover:scale-[1.02] active:scale-95"
        )}
      >
        <CalendarCheck className="w-5 h-5 mr-2" />
        {checkedIn ? "Checked In ✓" : "Check In Now (+Rs 10)"}
      </Button>

      {/* Streak info */}
      <div className="shadow-neu rounded-2xl bg-card p-4 text-center space-y-1">
        <p className="text-xs text-muted-foreground">🔥 Current Streak</p>
        <p className="text-2xl font-heading font-bold text-foreground">{getStreak()} Days</p>
        <p className="text-[10px] text-muted-foreground">Sign in 7 consecutive days for a Rs.100 bonus!</p>
      </div>
    </div>
  );
};

export default DailySignIn;
