import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Gift } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DailySignIn = () => {
  const [checkedIn, setCheckedIn] = useState(false);
  const today = new Date().getDay(); // 0=Sun, 1=Mon...
  const todayIdx = today === 0 ? 6 : today - 1; // convert to Mon=0

  const handleCheckIn = () => {
    setCheckedIn(true);
    toast.success("Success! Rs 10 added to balance.");
  };

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
            const isPast = i < todayIdx;
            return (
              <div
                key={day}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all",
                  isToday && "gradient-primary text-primary-foreground shadow-lg scale-105",
                  isPast && "bg-muted/50",
                  !isToday && !isPast && "bg-card"
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
                  isToday ? "bg-white/20 text-primary-foreground" : isPast ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                )}>
                  {isPast ? "✓" : i + 1}
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
        disabled={checkedIn}
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
        <p className="text-2xl font-heading font-bold text-foreground">{todayIdx + (checkedIn ? 1 : 0)} Days</p>
        <p className="text-[10px] text-muted-foreground">Sign in 7 consecutive days for a Rs.100 bonus!</p>
      </div>
    </div>
  );
};

export default DailySignIn;
