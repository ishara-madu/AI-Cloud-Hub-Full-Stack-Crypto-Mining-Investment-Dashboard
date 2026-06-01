import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Trash2, ChevronDown, ChevronUp, Coins, Shield, Megaphone, Gift, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const typeIcons: Record<string, any> = {
  money: Coins,
  security: Shield,
  system: Megaphone,
  promo: Gift,
  update: Rocket,
};

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications(data || []);
      setLoading(false);
    };
    fetchNotifs();
  }, [user]);

  const handleToggle = async (n: any) => {
    const isOpening = expandedId !== n.id;
    setExpandedId(isOpening ? n.id : null);
    if (isOpening && !n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setNotifications(prev =>
        prev.map(notif => notif.id === n.id ? { ...notif, is_read: true } : notif)
      );
    }
  };

  const handleClearAll = async () => {
    if (!user || notifications.length === 0) return;
    setClearing(true);
    const ids = notifications.map(n => n.id);
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20);
      await supabase.from("notifications").delete().in("id", batch);
    }
    setNotifications([]);
    setExpandedId(null);
    setClearing(false);
    toast.success("All notifications cleared");
  };

  if (loading) return (
    <div className="px-4 py-4 space-y-3">
      <Skeleton className="h-14" />
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <h1 className="text-base font-heading font-bold text-foreground">Message Center</h1>
          </div>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={handleClearAll} disabled={clearing}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />Clear All
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {notifications.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
        )}
        {notifications.map((n) => {
          const isExpanded = expandedId === n.id;
          return (
            <div
              key={n.id}
              className={`w-full shadow-neu rounded-2xl bg-card transition-all ${!n.is_read ? 'ring-1 ring-primary/30 border-l-4 border-l-primary' : ''}`}
            >
              <button
                onClick={() => handleToggle(n)}
                className="w-full text-left p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="relative w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                    {(() => {
                      const Icon = typeIcons[n.type] || Megaphone;
                      return <Icon className="w-5 h-5 text-primary" />;
                    })()}
                    {!n.is_read && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-heading truncate ${!n.is_read ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
                        {n.title}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                      </div>
                    </div>
                    {!isExpanded && (
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                        {n.description || "Tap to view details"}
                      </p>
                    )}
                  </div>
                </div>
              </button>

              {/* Inline expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-border mt-0">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap pt-3">
                    {n.description || "No additional details available."}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Notifications;
