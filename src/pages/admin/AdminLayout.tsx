import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";
import AdminShell from "./AdminShell";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (authLoading || adminLoading) {
    return <LoadingScreen fullScreen title="Verifying Authorization" subtitle="Checking administrative privileges..." />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <AdminShell>{children}</AdminShell>;
};

export default AdminLayout;
