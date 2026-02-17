export interface Notification {
  id: number;
  type: "money" | "security" | "system" | "promo" | "update";
  title: string;
  desc: string;
  time: string;
}

export const notifications: Notification[] = [
  { id: 1, type: "system", title: "Scheduled Maintenance", desc: "Platform will undergo maintenance on Feb 22, 2:00 AM – 4:00 AM IST. Please save your work.", time: "1h ago" },
  { id: 2, type: "money", title: "Deposit Confirmed", desc: "Your deposit of Rs 5,000 via bank transfer has been approved and credited to your wallet.", time: "2h ago" },
  { id: 3, type: "promo", title: "Weekend Bonus Offer", desc: "Top up Rs 10,000+ this weekend and receive a 5% cashback bonus. Limited time only!", time: "3h ago" },
  { id: 4, type: "security", title: "New Login Detected", desc: "A new sign-in was detected from Colombo, LK on Chrome. If this wasn't you, change your password immediately.", time: "5h ago" },
  { id: 5, type: "money", title: "Commission Earned", desc: "You earned Rs 150 in Tier-1 referral commission from user ID 8A3CF.", time: "6h ago" },
  { id: 6, type: "update", title: "New GPU Stock Available", desc: "Llama 3 & Mistral GPU clusters are now available for rental in the AI Packages Mall.", time: "8h ago" },
  { id: 7, type: "system", title: "KYC Verification Required", desc: "Complete your KYC verification to unlock withdrawal limits above Rs 50,000.", time: "12h ago" },
  { id: 8, type: "money", title: "Withdrawal Processed", desc: "Your withdrawal of Rs 2,500 to HNB Bank ****4521 has been processed successfully.", time: "1d ago" },
  { id: 9, type: "promo", title: "Referral Milestone Reached", desc: "Congratulations! You've referred 10 users. Claim your Rs 500 milestone bonus in Redeem.", time: "1d ago" },
  { id: 10, type: "security", title: "Password Changed", desc: "Your account password was updated successfully. Contact support if you didn't make this change.", time: "2d ago" },
  { id: 11, type: "update", title: "App Update v1.4.2", desc: "New features: improved package tracking, faster withdrawals, and bug fixes.", time: "3d ago" },
  { id: 12, type: "money", title: "Daily Sign-In Reward", desc: "You received Rs 10 for your daily check-in. Keep your streak going!", time: "3d ago" },
];

export const typeEmoji: Record<Notification["type"], string> = {
  money: "💰",
  security: "🔒",
  system: "📢",
  promo: "🎁",
  update: "🚀",
};
