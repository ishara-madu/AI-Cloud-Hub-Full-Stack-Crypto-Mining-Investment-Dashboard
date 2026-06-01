import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const AdminNotificationBell = () => {
  const { isAdmin } = useAdmin();
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAlerts = async () => {
      const { count } = await supabase
        .from("admin_alerts")
        .select("id", { count: "exact", head: true })
        .eq("is_resolved", false);
      setUnresolvedCount(count || 0);
    };

    fetchAlerts();

    const channelName = "admin-alerts-realtime";

    // 1. අලුතින් subscribe වෙන්න කලින්, මේ නමින් තියෙන පරණ channels ඔක්කොම client එකෙන් අයින් කරන්න
    supabase.getChannels().forEach((c) => {
      if (c.topic === `realtime:${channelName}`) {
        supabase.removeChannel(c);
      }
    });

    // 2. ඊටපස්සේ සාමාන්‍ය විදියටම fixed නම පාවිච්චි කරලා channel එක හදන්න
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_alerts" },
        () => {
          fetchAlerts();
        },
      )
      .subscribe();

    return () => {
      // 3. Component එක unmount වෙද්දී channel එක අයින් කරන්න
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <Link to="/admin/alerts" className="relative">
      <Bell
        className={cn(
          "w-5 h-5",
          unresolvedCount > 0 ? "text-destructive" : "text-muted-foreground",
        )}
      />
      {unresolvedCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center animate-pulse">
          {unresolvedCount > 9 ? "9+" : unresolvedCount}
        </span>
      )}
    </Link>
  );
};

export default AdminNotificationBell;
