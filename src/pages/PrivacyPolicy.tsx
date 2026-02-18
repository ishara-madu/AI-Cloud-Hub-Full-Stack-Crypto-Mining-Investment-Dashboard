import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

const PrivacyPolicy = () => {
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-heading font-bold text-foreground">Privacy Policy</h1>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <p className="text-muted-foreground text-xs">Last updated: February 18, 2026</p>

          <section>
            <h2 className="text-lg font-heading font-bold">1. Information We Collect</h2>
            <p>When you register and use AICloudHub, we collect:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>Account Information:</strong> Name, email address, phone number, and password.</li>
              <li><strong>Financial Information:</strong> Bank account details, deposit/withdrawal history, and wallet balances.</li>
              <li><strong>Device Information:</strong> IP address, browser fingerprint, canvas hash, WebGL hash, audio hash, font hash, user agent, device type, screen resolution, and timezone for security monitoring.</li>
              <li><strong>Activity Data:</strong> Login times, daily sign-ins, package purchases, referral activity, commission history, and transaction records.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold">2. Device Tracking & Security</h2>
            <p className="text-sm">We use advanced device fingerprinting and IP address logging to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Detect and prevent unauthorized access to your account.</li>
              <li>Identify suspicious multi-account activity from the same device or IP.</li>
              <li>Block registration attempts from devices already associated with existing accounts.</li>
              <li>Protect the platform against fraud, abuse, and policy violations.</li>
              <li>Administrators use this data to investigate and act on suspicious activity.</li>
            </ul>
            <p className="text-sm mt-2 font-semibold text-destructive/80">Important: Attempting to circumvent device tracking using VPNs, proxies, or device spoofing is a violation of our Terms & Conditions and may result in permanent account termination.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold">3. Account Freezing & Banning</h2>
            <p className="text-sm">We reserve the right to freeze (temporarily or permanently) accounts that:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Engage in fraudulent deposits or withdrawals.</li>
              <li>Use multiple accounts from the same device or IP to exploit referral or commission systems.</li>
              <li>Violate platform Terms & Conditions.</li>
              <li>Show suspicious transaction patterns flagged by our integrity monitoring system.</li>
            </ul>
            <p className="text-sm mt-2"><strong>Temporary bans</strong> automatically expire after the duration set by the administrator and count toward your ban history. <strong>Permanent bans</strong> require administrator action to remove.</p>
            <p className="text-sm">All bans reduce your Credit Score, which affects your earnings, commissions, and withdrawal fees.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold">4. Credit Score System</h2>
            <p className="text-sm">Your credit score (starting at 100%) is a measure of your account standing:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Each ban reduces your score by 20% × your ban count.</li>
              <li>Your referral team members' scores are also affected by your bans.</li>
              <li>Score recovers +1% per day through daily sign-ins, up to a maximum of 100%.</li>
              <li>Credit score directly impacts your daily rewards, commission multipliers, and withdrawal fees.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold">5. Financial Data & Integrity</h2>
            <p className="text-sm">Your deposit, withdrawal, commission, and balance data is stored securely. We use automated integrity checks during every financial operation. Any discrepancies trigger automatic alerts to administrators for investigation. Fraudulent financial activity will result in account termination and potential legal action.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold">6. Data Sharing</h2>
            <p className="text-sm">We do not sell your personal data. We may share data with:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Platform administrators for account management, security review, and fraud prevention.</li>
              <li>Law enforcement if required by applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold">7. Data Retention</h2>
            <p className="text-sm">Your data is retained as long as your account is active. If your account is deleted by an administrator, all associated data (transactions, commissions, device logs, referrals, notifications, bank accounts, etc.) will be permanently removed.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold">8. Your Rights</h2>
            <p className="text-sm">You may request to view or export your data by contacting support. Account deletion requests must go through the platform administrator. Note that deletion removes all earning history and referral connections permanently.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold">9. Security</h2>
            <p className="text-sm">We implement Row-Level Security (RLS) policies, encrypted authentication, and server-side validation to protect your data. Sensitive operations (deposits, withdrawals, bans) use atomic database functions to ensure integrity. However, no system is 100% secure — use a strong, unique password and never share your credentials.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold">10. Consent</h2>
            <p className="text-sm">By creating an account and accepting this policy at login/registration, you acknowledge that you have read and agree to this Privacy Policy, including our advanced device tracking, credit score system, ban policies, and account management practices. This consent is required to use the platform.</p>
          </section>
        </div>

        {/* Agreement checkbox at bottom */}
        <div className="mt-8 p-4 rounded-xl border border-border bg-muted/30">
          <div className="flex items-start gap-3">
            <Checkbox
              id="privacy-agree"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="privacy-agree" className="text-sm text-foreground leading-snug cursor-pointer">
              I have read and agree to this Privacy Policy, including device tracking, account freezing, ban policies, and data collection practices.
            </label>
          </div>
          {accepted && (
            <Button
              className="w-full mt-4 rounded-xl gradient-primary text-primary-foreground font-semibold"
              onClick={() => navigate(-1)}
            >
              Done — Go Back
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
