import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Building2,
  Copy,
  Camera,
  Upload,
  X,
  Smartphone,
  Coins,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import LoadingScreen from "@/components/LoadingScreen";

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  description: string;
  details?: Record<string, string>;
}

const iconMap: Record<string, any> = {
  building: Building2,
  smartphone: Smartphone,
  coins: Coins,
};

interface CryptoPaymentDetails {
  id?: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  payment_id: string;
  usd_amount: number;
  exchange_rate: number;
}

const SUPPORTED_COINS = [
  { id: "trx", name: "TRON (TRX)", description: "TRON network coin" },
  {
    id: "usdttrc20",
    name: "USDT (TRC20)",
    description: "Tether on TRON network (Low fee)",
  },
  { id: "btc", name: "Bitcoin (BTC)", description: "Bitcoin network" },
  { id: "eth", name: "Ethereum (ETH)", description: "Ethereum network" },
  { id: "ltc", name: "Litecoin (LTC)", description: "Litecoin network" },
];

const Deposit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bankDetails, setBankDetails] = useState({
    bank_name: "Commercial Bank PLC",
    account_name: "AI Cloud Technologies",
    account_number: "82001567XX",
    branch: "Colombo 07",
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("bank_transfer");
  const [methodsLoaded, setMethodsLoaded] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState("usdttrc20");
  const [cryptoPaymentDetails, setCryptoPaymentDetails] =
    useState<CryptoPaymentDetails | null>(null);
  const [minDepositInfo, setMinDepositInfo] = useState<{
    min_amount: number;
    rs_equivalent: number;
    pay_currency: string;
  } | null>(null);
  const [fetchingMin, setFetchingMin] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);

  const apiMinimumLimit = (selectedMethod === "crypto_nowpayments" && minDepositInfo)
    ? minDepositInfo.rs_equivalent
    : 0;
  const effectiveMinimum = Math.max(500, apiMinimumLimit);
  const effectiveMinCrypto = (minDepositInfo && minDepositInfo.rs_equivalent > 0)
    ? (minDepositInfo.min_amount * (effectiveMinimum / minDepositInfo.rs_equivalent))
    : 0;

  // Play a short sweet chime: C5 -> E5 -> G5
  const playSuccessSound = () => {
    try {
      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = "sine";
      const now = audioContext.currentTime;

      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      oscillator.frequency.setValueAtTime(523.25, now); // C5
      oscillator.frequency.setValueAtTime(659.25, now + 0.15); // E5
      oscillator.frequency.setValueAtTime(783.99, now + 0.3); // G5

      oscillator.start(now);
      oscillator.stop(now + 0.6);
    } catch (err) {
      console.warn("AudioContext sound play failed:", err);
    }
  };

  useEffect(() => {
    if (!user) return;

    const initializeSettings = async () => {
      try {
        const [methodsRes, cryptoRes, pendingRes] = await Promise.all([
          supabase
            .from("platform_settings")
            .select("value")
            .eq("key", "payment_methods")
            .maybeSingle(),
          supabase
            .from("platform_settings")
            .select("value")
            .eq("key", "nowpayments_settings")
            .maybeSingle(),
          supabase
            .from("deposit_requests")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "pending")
            .eq("payment_method", "crypto_nowpayments")
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        let methods: PaymentMethod[] = [];
        if (methodsRes.data?.value) {
          methods = (methodsRes.data.value as any[]).filter(
            (m: PaymentMethod) => m.enabled,
          );
        }

        const cryptoSettings = cryptoRes.data?.value as {
          enabled?: boolean;
        } | null;
        if (cryptoSettings?.enabled) {
          methods.unshift({
            id: "crypto_nowpayments",
            name: "Cryptocurrency",
            icon: "coins",
            enabled: true,
            description: "Pay securely with BTC, USDT, TRX, LTC, etc.",
          });
        }

        setPaymentMethods(methods);
        if (methods.length > 0) setSelectedMethod(methods[0].id);

        // Check if there is an active pending deposit
        if (pendingRes.data && pendingRes.data.length > 0) {
          const pendingDep = pendingRes.data[0];
          try {
            const parsedNotes = JSON.parse(pendingDep.notes || "");
            if (parsedNotes && parsedNotes.pay_address) {
              setCryptoPaymentDetails({
                id: pendingDep.id,
                pay_address: parsedNotes.pay_address,
                pay_amount: parsedNotes.pay_amount,
                pay_currency: parsedNotes.pay_currency,
                payment_id: parsedNotes.payment_id,
                usd_amount:
                  parsedNotes.usd_amount ||
                  pendingDep.amount / (parsedNotes.exchange_rate || 300),
                exchange_rate: parsedNotes.exchange_rate || 300,
              });
              setAmount(pendingDep.amount.toString());
            }
          } catch (e) {
            console.error(
              "Notes column is not valid JSON or missing details:",
              e,
            );
          }
        }
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setMethodsLoaded(true);
      }
    };

    initializeSettings();
  }, [user]);

  useEffect(() => {
    if (selectedMethod !== "crypto_nowpayments") return;

    const fetchMinAmount = async () => {
      setFetchingMin(true);
      setMinDepositInfo(null);
      try {
        const { data, error } = await supabase.functions.invoke(
          "create-nowpayments-invoice",
          {
            body: { pay_currency: selectedCoin, action: "get_min_amount" },
          },
        );
        if (!error && data && !data.error) {
          setMinDepositInfo({
            min_amount: data.min_amount,
            rs_equivalent: data.rs_equivalent,
            pay_currency: selectedCoin,
          });
        }
      } catch (e) {
        console.error("Error fetching min amount:", e);
      }
      setFetchingMin(false);
    };

    fetchMinAmount();
  }, [selectedCoin, selectedMethod]);

  // Realtime channel hook for deposit status update detection
  useEffect(() => {
    if (!cryptoPaymentDetails?.id) return;

    const channel = supabase
      .channel(`deposit-request-status-${cryptoPaymentDetails.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deposit_requests",
          filter: `id=eq.${cryptoPaymentDetails.id}`,
        },
        (payload) => {
          console.log("Realtime update payload received:", payload);
          const newStatus = payload.new.status;
          if (newStatus === "approved") {
            setIsPaymentSuccess(true);
          } else if (newStatus === "rejected" || newStatus === "cancelled") {
            toast.error("Deposit request was unsuccessful or cancelled.");
            setCryptoPaymentDetails(null);
            setAmount("");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cryptoPaymentDetails?.id]);

  // Navigate to dashboard 3s after payment success
  useEffect(() => {
    if (isPaymentSuccess) {
      playSuccessSound();
      const timer = setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isPaymentSuccess, navigate]);

  const handleCancelPayment = async () => {
    if (!cryptoPaymentDetails?.id) return;
    const confirmCancel = window.confirm(
      "Are you sure? Only cancel if you haven't sent the funds yet.",
    );
    if (!confirmCancel) return;

    setLoading(true);
    try {
      // 1. Update deposit status to cancelled in database
      const { error: depError } = await supabase
        .from("deposit_requests")
        .update({ status: "cancelled", notes: "Payment cancelled by user." })
        .eq("id", cryptoPaymentDetails.id);

      if (depError) throw depError;

      // 2. Reject/cancel the corresponding transaction record
      await supabase
        .from("transactions")
        .update({
          status: "rejected",
          description: "Crypto Deposit cancelled by user",
        })
        .eq("reference_id", cryptoPaymentDetails.id);

      toast.success("Payment cancelled successfully.");
      setCryptoPaymentDetails(null);
      setAmount("");
    } catch (err: any) {
      console.error("Error cancelling payment:", err);
      toast.error(err.message || "Failed to cancel payment");
    } finally {
      setLoading(false);
    }
  };

  const [verifying, setVerifying] = useState(false);

  const checkPaymentStatus = async () => {
    if (!cryptoPaymentDetails?.id) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase
        .from("deposit_requests")
        .select("status")
        .eq("id", cryptoPaymentDetails.id)
        .single();

      if (error) throw error;

      if (data.status === "approved") {
        setIsPaymentSuccess(true);
        toast.success("Payment confirmed!");
      } else if (data.status === "pending") {
        toast.info(
          "Payment is still pending blockchain confirmation. Please wait a few minutes.",
        );
      } else if (data.status === "rejected" || data.status === "cancelled") {
        toast.error(`Payment was ${data.status}.`);
        setCryptoPaymentDetails(null);
        setAmount("");
      }
    } catch (err: any) {
      console.error("Error checking payment status:", err);
      toast.error(err.message || "Failed to check status. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Max 5MB.");
      return;
    }
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!user) return;
    setLoading(true);

    if (!amt || amt < effectiveMinimum) {
      if (effectiveMinimum === 500) {
        toast.error("The minimum deposit is 500");
      } else {
        toast.error(`The minimum deposit for this network is higher, it is ${effectiveMinimum.toLocaleString()}`);
      }
      setLoading(false);
      return;
    }

    if (selectedMethod === "crypto_nowpayments") {
      try {
        const { data, error } = await supabase.functions.invoke(
          "create-nowpayments-invoice",
          {
            body: { amount: amt, pay_currency: selectedCoin },
          },
        );
        if (error || data?.error || !data?.pay_address) {
          throw new Error(
            error?.message ||
              data?.error ||
              "Failed to initialize crypto checkout.",
          );
        }
        setCryptoPaymentDetails(data);
        setLoading(false);
        return;
      } catch (err: any) {
        toast.error(err.message || "Could not start Crypto payment process");
        setLoading(false);
        return;
      }
    }

    let slipUrl: string | null = null;
    if (slipFile) {
      setUploading(true);
      const ext = slipFile.name.split(".").pop();
      const path = `slips/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("uploads")
        .upload(path, slipFile);
      if (uploadErr) {
        toast.error("Failed to upload payment slip");
        setLoading(false);
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(path);
      slipUrl = urlData.publicUrl;
      setUploading(false);
    }

    const { data: depData, error: depErr } = await supabase
      .from("deposit_requests")
      .insert({
        user_id: user.id,
        amount: amt,
        payment_method: selectedMethod as any,
        notes: reference.trim() || null,
        slip_url: slipUrl,
      })
      .select("id")
      .single();

    if (!depErr && depData) {
      const methodName =
        paymentMethods.find((m) => m.id === selectedMethod)?.name ||
        selectedMethod;
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit" as const,
        amount: amt,
        status: "pending" as const,
        description: `Deposit via ${methodName}${reference ? ` - ${reference}` : ""}`,
        reference_id: depData.id,
      });
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "money",
        title: "Deposit Request Submitted",
        description: `Your deposit of Rs ${amt.toLocaleString()} via ${methodName} is pending approval.`,
      });
    }

    setLoading(false);
    if (depErr) {
      toast.error("Failed to submit deposit request");
    } else {
      setSubmitted(true);
    }
  };

  const activeMethod = paymentMethods.find((m) => m.id === selectedMethod);

  if (!methodsLoaded) {
    return (
      <LoadingScreen
        title="Loading Deposit Portal"
        subtitle="Securing gateway connections..."
      />
    );
  }

  if (isPaymentSuccess) {
    return (
      <div className="px-4 py-8 animate-fade-in">
        <div className="shadow-neu rounded-2xl bg-card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-bounce" />
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground">
            Payment Successful!
          </h2>
          <p className="text-sm text-muted-foreground">
            Your crypto deposit of{" "}
            <strong>Rs {parseFloat(amount).toLocaleString()}</strong> has been
            automatically processed and credited.
          </p>
          <div className="pt-2 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Redirecting you to dashboard...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cryptoPaymentDetails) {
    return (
      <div className="px-4 py-6 animate-fade-in space-y-6">
        <div className="shadow-neu rounded-2xl bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              onClick={() => setCryptoPaymentDetails(null)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-heading font-bold text-foreground">
              Complete Crypto Deposit
            </h2>
          </div>

          <div className="flex flex-col items-center py-4 bg-muted/20 rounded-2xl border border-border/50">
            <QRCodeSVG
              value={cryptoPaymentDetails.pay_address}
              size={176}
              level="H"
              includeMargin={false}
              className="bg-white p-2 rounded-xl shadow-sm border border-border"
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              Scan QR Code to pay
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
              <span className="text-xs text-muted-foreground block font-medium">
                SEND EXACT CRYPTO AMOUNT
              </span>
              <span className="text-2xl font-heading font-black text-primary block mt-1 tracking-tight">
                {cryptoPaymentDetails.pay_amount}{" "}
                {cryptoPaymentDetails.pay_currency.toUpperCase()}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-1">
                Equivalent to Rs {parseFloat(amount).toLocaleString()} (~$
                {cryptoPaymentDetails.usd_amount.toFixed(2)} USD)
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Destination Wallet Address
              </Label>
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-xl border border-border/60">
                <span className="text-xs font-mono break-all text-foreground flex-1 select-all font-semibold leading-relaxed">
                  {cryptoPaymentDetails.pay_address}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-primary shrink-0 hover:bg-primary/10 rounded-lg"
                  onClick={() =>
                    copyText(cryptoPaymentDetails.pay_address, "Wallet address")
                  }
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Cryptocurrency Reference ID
              </Label>
              <p className="text-xs font-mono text-muted-foreground bg-muted/20 p-2 rounded-lg break-all">
                {cryptoPaymentDetails.payment_id}
              </p>
            </div>
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 rounded-xl flex items-start gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Important Deposit Rules:</p>
              <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-muted-foreground">
                <li>
                  Send only {cryptoPaymentDetails.pay_currency.toUpperCase()} to
                  this address. Sending other coins will result in permanent
                  loss.
                </li>
                <li>
                  Ensure you cover any exchange/wallet withdrawal fees so the
                  network receives the exact amount.
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-2 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Waiting for blockchain payment confirmation...</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
              This screen will update automatically. Confirmation typically
              takes 2–10 minutes depending on network congestion.
            </p>
          </div>

          <Button
            className="w-full rounded-xl h-12 gradient-primary text-primary-foreground font-semibold mt-4"
            onClick={checkPaymentStatus}
            disabled={loading || verifying}
          >
            {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Check Payment Status
          </Button>

          <Button
            className="w-full rounded-xl h-12 border border-border text-foreground font-semibold mt-2"
            variant="ghost"
            onClick={handleCancelPayment}
            disabled={loading || verifying}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Cancel Payment & Return
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="px-4 py-8 animate-fade-in">
        <div className="shadow-neu rounded-2xl bg-card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground">
            Deposit Request Submitted
          </h2>
          <p className="text-sm text-muted-foreground">
            Your deposit of <strong>Rs {parseFloat(amount).toFixed(2)}</strong>{" "}
            is pending approval.
          </p>
          <Button
            onClick={() => {
              setSubmitted(false);
              setAmount("");
              setReference("");
              setSlipFile(null);
              setSlipPreview(null);
            }}
            variant="outline"
            className="rounded-xl"
          >
            Make Another Deposit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4 flex items-center gap-3">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-heading font-bold text-foreground">
          Deposit
        </h1>
      </div>

      <div className="px-4 space-y-5 pb-8">
        {methodsLoaded && paymentMethods.length === 0 ? (
          <div className="shadow-neu rounded-2xl bg-card p-6 text-center space-y-4 border border-destructive/20 mt-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive animate-pulse shrink-0" />
              <span>System Maintenance Active</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We are currently performing scheduled maintenance on our deposit
              systems. Deposits are temporarily offline. You can't deposit now.
              Please try again later.
            </p>
            <div className="pt-2">
              <Link to="/dashboard">
                <Button
                  className="rounded-xl w-full font-semibold"
                  variant="outline"
                >
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Payment Method Selection */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Select Method
              </p>
              <div className="space-y-2">
                {paymentMethods.map((method) => {
                  const IconComp = iconMap[method.icon] || Building2;
                  const isSelected = selectedMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethod(method.id)}
                      className={cn(
                        "w-full shadow-neu rounded-2xl bg-card p-4 flex items-center gap-4 transition-all text-left",
                        isSelected
                          ? "ring-2 ring-primary"
                          : "ring-1 ring-border hover:ring-primary/40",
                      )}
                    >
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          isSelected ? "gradient-primary" : "bg-muted",
                        )}
                      >
                        <IconComp
                          className={cn(
                            "w-6 h-6",
                            isSelected
                              ? "text-primary-foreground"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-heading font-bold text-foreground">
                          {method.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {method.description}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coin Selection (when Cryptocurrency is selected) */}
            {selectedMethod === "crypto_nowpayments" && (
              <div className="shadow-neu rounded-2xl bg-card p-5 space-y-3">
                <h3 className="text-sm font-heading font-bold text-foreground">
                  Select Crypto Asset
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select the currency you wish to pay with
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SUPPORTED_COINS.map((coin) => {
                    const isCoinSelected = selectedCoin === coin.id;
                    return (
                      <button
                        key={coin.id}
                        type="button"
                        onClick={() => setSelectedCoin(coin.id)}
                        className={cn(
                          "w-full rounded-xl bg-muted/20 p-3 flex items-center justify-between text-left transition-all border",
                          isCoinSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            {coin.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {coin.description}
                          </p>
                        </div>
                        {isCoinSelected && (
                          <CheckCircle2 className="w-4 h-4 text-primary animate-scale-in" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment Details */}
            {methodsLoaded && selectedMethod === "bank_transfer" && (
              <div className="shadow-neu rounded-2xl bg-card p-5 space-y-3">
                <h3 className="text-sm font-heading font-bold text-foreground">
                  Receiving Bank Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span className="font-medium text-foreground">
                      {bankDetails.bank_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">A/C Name</span>
                    <span className="font-medium text-foreground">
                      {bankDetails.account_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">A/C No</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground font-mono">
                        {bankDetails.account_number}
                      </span>
                      <button
                        onClick={() =>
                          copyText(bankDetails.account_number, "Account number")
                        }
                        className="text-primary hover:text-primary/80"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch</span>
                    <span className="font-medium text-foreground">
                      {bankDetails.branch}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {methodsLoaded &&
              selectedMethod !== "bank_transfer" &&
              activeMethod?.details && (
                <div className="shadow-neu rounded-2xl bg-card p-5 space-y-3">
                  <h3 className="text-sm font-heading font-bold text-foreground">
                    {activeMethod.name} Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    {Object.entries(activeMethod.details).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="flex justify-between items-center"
                        >
                          <span className="text-muted-foreground capitalize">
                            {key.replace(/_/g, " ")}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground font-mono">
                              {value}
                            </span>
                            <button
                              onClick={() => copyText(value, key)}
                              className="text-primary hover:text-primary/80"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Enter Amount (Rs)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  className="rounded-xl h-12 text-lg shadow-neu-inset bg-muted/30"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                {selectedMethod === "crypto_nowpayments" && (
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between px-1">
                    {fetchingMin ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Fetching
                        minimum limit...
                      </span>
                    ) : minDepositInfo ? (
                      <span>
                        Minimum Limit:{" "}
                        <strong className="text-primary">
                          {Number(effectiveMinCrypto.toFixed(6))}{" "}
                          {minDepositInfo.pay_currency.toUpperCase()}
                        </strong>{" "}
                        (~Rs {effectiveMinimum.toLocaleString()})
                      </span>
                    ) : (
                      <span className="text-destructive">
                        Minimum limit details unavailable
                      </span>
                    )}
                  </div>
                )}
              </div>
              {selectedMethod !== "crypto_nowpayments" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Transaction Reference / Remark
                    </Label>
                    <Input
                      placeholder="e.g. TXN12345"
                      className="rounded-xl h-12 shadow-neu-inset bg-muted/30"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Upload Payment Slip
                    </Label>
                    {slipPreview ? (
                      <div className="relative rounded-2xl overflow-hidden border border-border">
                        <img
                          src={slipPreview}
                          alt="Payment slip"
                          className="w-full max-h-48 object-contain bg-muted/20"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSlipFile(null);
                            setSlipPreview(null);
                          }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-border rounded-2xl p-6 text-center bg-muted/20 cursor-pointer hover:border-primary/40 transition-colors block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Camera className="w-6 h-6 text-primary" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Tap to upload payment slip
                          </p>
                          <Upload className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </label>
                    )}
                  </div>
                </>
              )}
              <Button
                type="submit"
                className="w-full rounded-xl h-12 gradient-primary text-primary-foreground font-semibold text-base"
                disabled={loading || uploading}
              >
                {(loading || uploading) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {uploading ? "Uploading Slip..." : "Confirm Deposit"}
              </Button>
              {selectedMethod !== "crypto_nowpayments" && (
                <p className="text-xs text-destructive text-center font-medium flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Minimum deposit Rs 500. Transfer exact amount. Requests are
                    processed within 30 minutes.
                  </span>
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Deposit;
