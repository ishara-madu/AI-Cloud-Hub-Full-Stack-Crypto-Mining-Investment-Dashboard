import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Double-check session directly to avoid race conditions
  useEffect(() => {
    if (!loading && !user) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setHasSession(!!session?.user);
        setChecked(true);
      });
    } else {
      setChecked(true);
    }
  }, [loading, user]);

  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !hasSession) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
