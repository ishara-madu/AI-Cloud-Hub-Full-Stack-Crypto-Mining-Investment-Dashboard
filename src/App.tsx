import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Deposit from "./pages/Deposit";
import Withdraw from "./pages/Withdraw";
import Packages from "./pages/Packages";
import Transactions from "./pages/Transactions";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import DailySignIn from "./pages/DailySignIn";
import About from "./pages/About";
import Redeem from "./pages/Redeem";
import Notifications from "./pages/Notifications";
import BankInfo from "./pages/BankInfo";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDeposits from "./pages/admin/AdminDeposits";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminPackages from "./pages/admin/AdminPackages";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><AppLayout>{children}</AppLayout></ProtectedRoute>
);

const AdminPage = ({ children }: { children: React.ReactNode }) => (
  <AdminLayout>{children}</AdminLayout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner closeButton />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
            <Route path="/deposit" element={<ProtectedPage><Deposit /></ProtectedPage>} />
            <Route path="/withdraw" element={<ProtectedPage><Withdraw /></ProtectedPage>} />
            <Route path="/packages" element={<ProtectedPage><Packages /></ProtectedPage>} />
            <Route path="/transactions" element={<ProtectedPage><Transactions /></ProtectedPage>} />
            <Route path="/team" element={<ProtectedPage><Team /></ProtectedPage>} />
            <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
            <Route path="/daily-signin" element={<ProtectedPage><DailySignIn /></ProtectedPage>} />
            <Route path="/about" element={<ProtectedPage><About /></ProtectedPage>} />
            <Route path="/redeem" element={<ProtectedPage><Redeem /></ProtectedPage>} />
            <Route path="/notifications" element={<ProtectedPage><Notifications /></ProtectedPage>} />
            <Route path="/bank-info" element={<ProtectedPage><BankInfo /></ProtectedPage>} />
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminPage><AdminDashboard /></AdminPage>} />
            <Route path="/admin/users" element={<AdminPage><AdminUsers /></AdminPage>} />
            <Route path="/admin/deposits" element={<AdminPage><AdminDeposits /></AdminPage>} />
            <Route path="/admin/withdrawals" element={<AdminPage><AdminWithdrawals /></AdminPage>} />
            <Route path="/admin/packages" element={<AdminPage><AdminPackages /></AdminPage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
