import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import VpnGuard from "@/components/VpnGuard";
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
import CommissionDetails from "./pages/CommissionDetails";
import BankInfo from "./pages/BankInfo";
import EarnedHistory from "./pages/EarnedHistory";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDeposits from "./pages/admin/AdminDeposits";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminPackages from "./pages/admin/AdminPackages";
import AdminRedeemCodes from "./pages/admin/AdminRedeemCodes";
import AdminSliders from "./pages/admin/AdminSliders";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminUserPackages from "./pages/admin/AdminUserPackages";
import AdminAlerts from "./pages/admin/AdminAlerts";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";

const queryClient = new QueryClient();

const PageTitleUpdater = () => {
  const location = useLocation();

  useEffect(() => {
    const titleMap: Record<string, string> = {
      "/dashboard": "Dashboard | AI Cloud Hub",
      "/login": "Login | AI Cloud Hub",
      "/register": "Register | AI Cloud Hub",
      "/privacy-policy": "Privacy Policy | AI Cloud Hub",
      "/terms": "Terms & Conditions | AI Cloud Hub",
      "/forgot-password": "Forgot Password | AI Cloud Hub",
      "/reset-password": "Reset Password | AI Cloud Hub",
      "/deposit": "Deposit Funds | AI Cloud Hub",
      "/withdraw": "Withdraw Funds | AI Cloud Hub",
      "/packages": "Investment Packages | AI Cloud Hub",
      "/transactions": "Transaction Logs | AI Cloud Hub",
      "/team": "My Team Network | AI Cloud Hub",
      "/settings": "Account Settings | AI Cloud Hub",
      "/daily-signin": "Daily Check-in Reward | AI Cloud Hub",
      "/about": "About AI Cloud Technologies | AI Cloud Hub",
      "/redeem": "Redeem Promo Code | AI Cloud Hub",
      "/notifications": "Notifications & Updates | AI Cloud Hub",
      "/bank-info": "Bank Account Details | AI Cloud Hub",
      "/commission-details": "Referral Commissions | AI Cloud Hub",
      "/earned-history": "Earning History | AI Cloud Hub",
      "/admin": "Admin Dashboard | AI Cloud Hub",
      "/admin/users": "User Accounts Management | AI Cloud Hub",
      "/admin/deposits": "Deposit Approvals Queue | AI Cloud Hub",
      "/admin/withdrawals": "Withdrawal Approvals Queue | AI Cloud Hub",
      "/admin/packages": "Investment Package Manager | AI Cloud Hub",
      "/admin/redeem-codes": "Redeem Codes Manager | AI Cloud Hub",
      "/admin/sliders": "Homepage Sliders Settings | AI Cloud Hub",
      "/admin/settings": "Global Platform Settings | AI Cloud Hub",
      "/admin/user-packages": "User Investment Packages | AI Cloud Hub",
      "/admin/alerts": "Critical Security Alerts | AI Cloud Hub",
    };

    const path = location.pathname;
    
    // Dynamic matching for admin user detail page
    if (path.startsWith("/admin/users/")) {
      document.title = "User Details | AI Cloud Hub";
      return;
    }

    document.title = titleMap[path] || "AI Cloud Hub";
  }, [location]);

  return null;
};

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
      <VpnGuard>
      <AuthProvider>
        <BrowserRouter>
          <PageTitleUpdater />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsAndConditions />} />
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
            <Route path="/commission-details" element={<ProtectedPage><CommissionDetails /></ProtectedPage>} />
            <Route path="/earned-history" element={<ProtectedPage><EarnedHistory /></ProtectedPage>} />
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminPage><AdminDashboard /></AdminPage>} />
            <Route path="/admin/users" element={<AdminPage><AdminUsers /></AdminPage>} />
            <Route path="/admin/deposits" element={<AdminPage><AdminDeposits /></AdminPage>} />
            <Route path="/admin/withdrawals" element={<AdminPage><AdminWithdrawals /></AdminPage>} />
            <Route path="/admin/packages" element={<AdminPage><AdminPackages /></AdminPage>} />
            <Route path="/admin/redeem-codes" element={<AdminPage><AdminRedeemCodes /></AdminPage>} />
            <Route path="/admin/sliders" element={<AdminPage><AdminSliders /></AdminPage>} />
            <Route path="/admin/settings" element={<AdminPage><AdminSettings /></AdminPage>} />
            <Route path="/admin/user-packages" element={<AdminPage><AdminUserPackages /></AdminPage>} />
            <Route path="/admin/alerts" element={<AdminPage><AdminAlerts /></AdminPage>} />
            <Route path="/admin/users/:userId" element={<AdminPage><AdminUserDetail /></AdminPage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </VpnGuard>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
