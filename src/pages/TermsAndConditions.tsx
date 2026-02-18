import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermsAndConditions = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/login"><Button variant="ghost" size="icon" className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-xl font-heading font-bold text-foreground">Terms & Conditions</h1>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground/90">
        <p className="text-muted-foreground text-xs">Last updated: February 18, 2026</p>

        <section>
          <h2 className="text-lg font-heading font-bold">1. Acceptance of Terms</h2>
          <p className="text-sm">By creating an account or logging into AICloudHub, you confirm that you have read, understood, and agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree, you must not use the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">2. Eligibility</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>You must be at least 18 years old to use this platform.</li>
            <li>You must have received a valid invitation code to register.</li>
            <li>You may only maintain one account. Multiple accounts are strictly prohibited.</li>
            <li>Using a VPN, proxy, or shared device to circumvent detection systems is prohibited.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">3. Account Responsibilities</h2>
          <p className="text-sm">You are responsible for:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Keeping your login credentials confidential and not sharing them with anyone.</li>
            <li>All activity that occurs under your account.</li>
            <li>Providing accurate and truthful information during registration and throughout your use.</li>
            <li>Maintaining a valid bank account linked to your identity for withdrawals.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">4. Packages & Earnings</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>AI packages generate a daily income of 5% of the price paid, credited to your wallet.</li>
            <li>Earnings are subject to platform availability and package validity period.</li>
            <li>Platform reserves the right to modify package terms with prior notice.</li>
            <li>Package income is non-guaranteed and dependent on platform operations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">5. Deposits & Withdrawals</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>A minimum cumulative deposit of Rs 500 is required before any withdrawal.</li>
            <li>Minimum withdrawal amount is Rs 1,000.</li>
            <li>A handling fee starting at 5% (increased by poor credit score) applies to all withdrawals.</li>
            <li>Withdrawal requests are reviewed and processed by administrators. Processing may take up to 5 business days.</li>
            <li>Fraudulent deposits or chargebacks will result in permanent account termination.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">6. Referral & Commission Program</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Referral commissions are earned when referred users make approved deposits.</li>
            <li>Commission rates are set by administrators and may change at any time.</li>
            <li>Commissions are scaled by your current Credit Score.</li>
            <li>Artificial referral manipulation is prohibited and will result in banning.</li>
            <li>The platform offers a 3-tier referral system (Tier 1, 2, and 3).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">7. Credit Score System</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>All accounts start with a credit score of 100%.</li>
            <li>Each ban reduces your credit score by 20% × ban count.</li>
            <li>Team members in your referral chain also suffer proportional credit score reductions when you are banned.</li>
            <li>Credit score recovers by +1% per day through consistent daily sign-ins.</li>
            <li>Credit score directly affects: earnings multiplier, commission rates, and withdrawal fees.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">8. Prohibited Activities</h2>
          <p className="text-sm">The following activities will result in immediate account suspension or permanent ban:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Creating or using multiple accounts from the same device or IP address.</li>
            <li>Attempting to manipulate platform systems, balances, or commission structures.</li>
            <li>Submitting fraudulent deposit slips or false payment proofs.</li>
            <li>Using automated bots or scripts to interact with the platform.</li>
            <li>Abusing the referral or redeem code systems.</li>
            <li>Any form of money laundering or financial fraud.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">9. Temporary & Permanent Bans</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Administrators may apply temporary bans for minor violations. The account is automatically unfrozen after the duration expires.</li>
            <li>Permanent bans are applied for serious or repeated violations.</li>
            <li>Both temporary and permanent bans count toward your ban history and credit score penalties.</li>
            <li>During any ban, all withdrawals, commissions, and package income are suspended.</li>
            <li>Banned users will be notified via the platform's notification system.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">10. Platform Rights</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>AICloudHub reserves the right to modify, suspend, or terminate the platform at any time.</li>
            <li>We reserve the right to adjust package structures, commission rates, and withdrawal limits.</li>
            <li>We may freeze or close accounts found to be in violation of these terms without prior notice.</li>
            <li>Administrators may conduct audits of any account at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">11. Limitation of Liability</h2>
          <p className="text-sm">AICloudHub is not liable for any loss of earnings, investment loss, or financial damages resulting from account bans, platform downtime, or changes to platform terms. Participation in the platform's earning programs is at your own risk.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">12. Governing Law</h2>
          <p className="text-sm">These terms are governed by applicable laws. Any disputes shall be resolved through the platform's internal dispute resolution process before any external legal proceedings.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">13. Updates to Terms</h2>
          <p className="text-sm">We may update these Terms & Conditions at any time. Continued use of the platform after changes constitutes acceptance of the updated terms. Users will be notified of major changes via the notification system.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold">14. Contact</h2>
          <p className="text-sm">For any questions regarding these Terms & Conditions, please contact the platform administrator through the in-app support channel.</p>
        </section>
      </div>
    </div>
  </div>
);

export default TermsAndConditions;
