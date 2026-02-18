import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, X, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const typeEmoji: Record<string, string> = {
  money: "💰",
  security: "🔒",
  system: "📢",
  promo: "🎁",
  update: "🚀",
};

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
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

  const handleSelectNotif = async (n: any) => {
    setSelected(n);
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, is_read: true } : notif));
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
    setClearing(false);
    toast.success("All notifications cleared");
  };

  if (loading) return <div className="px-4 py-4 space-y-3"><Skeleton className="h-14" />{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;

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
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => handleSelectNotif(n)}
            className={`w-full text-left shadow-neu rounded-2xl bg-card p-4 space-y-1 transition-all hover:shadow-card-hover ${!n.is_read ? 'ring-1 ring-primary/30 border-l-4 border-l-primary' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                {typeEmoji[n.type] || "📢"}
                {!n.is_read && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-card" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-heading truncate ${!n.is_read ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>{n.title}</p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{n.description || "Tap to view details"}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Full View Modal — centered to visible viewport using transform */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          onClick={() => setSelected(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 48px)',
              maxWidth: '384px',
              zIndex: 101,
            }}
            className="shadow-neu rounded-2xl bg-card p-5 space-y-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                  {typeEmoji[selected.type] || "📢"}
                </div>
                <div>
                  <p className="text-sm font-heading font-bold text-foreground">{selected.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.description || "No additional details available."}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {new Date(selected.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
