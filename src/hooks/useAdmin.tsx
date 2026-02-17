import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastCheckedUserId = useRef<string | null>(null);

  // Synchronously mark as loading if user changed
  if (user?.id !== lastCheckedUserId.current) {
    if (user) {
      if (!loading) setLoading(true);
      if (isAdmin) setIsAdmin(false);
    } else {
      if (loading) setLoading(false);
      if (isAdmin) setIsAdmin(false);
    }
  }

  useEffect(() => {
    if (!user) {
      lastCheckedUserId.current = null;
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    
    lastCheckedUserId.current = user.id;
    
    const check = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      setLoading(false);
    };
    check();
  }, [user]);

  return { isAdmin, loading };
};
