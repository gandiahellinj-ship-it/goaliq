import { useLocation } from "wouter";
import { useSubscription, useCreateCheckout, checkoutErrorMessage } from "@/lib/subscription";
import { useTrialCopy } from "@/lib/i18n";
import { useT } from "@/lib/language";
import { Loader2, Lock, Gift, Zap, Check, Clock, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const PRICE_ID = "price_1TFYJVAC9aQrlGDtdvlFPtjX";

function daysLeft(trialEndsAt: number | null): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt * 1000 - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

interface TrialGateProps {
  children: React.ReactNode;
  pageName: string;
  pageEmoji?: string;
}

export function TrialGate({ children, pageName, pageEmoji = "🎯" }: TrialGateProps) {
  const { data: subData, isLoading: subLoading } = useSubscription();
  const checkoutMutation = useCreateCheckout();
  const [, navigate] = useLocation();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const tc = useTrialCopy();
  const t = useT();

  if (subLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#AAFF45]" />
      </div>
    );
  }

  const status = subData?.status ?? "inactive";
  const hasAccess = subData?.hasAccess ?? false;
  const hasUsedTrial = subData?.hasUsedTrial ?? false;
  const trialEndsAt = subData?.trialEndsAt ?? null;
  const remaining = daysLeft(trialEndsAt);

  if (hasAccess) {
    const isTrialing = status === "trialing";
    const urgentDays = remaining !== null && remaining <= 1;

    return (
      <>
        {isTrialing && remaining !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mx-4 mt-4 mb-0 rounded-lg px-4 py-3 flex items-center gap-3 ${
              urgentDays
                ? "bg-amber-500/10 border border-amber-500/20"
                : "bg-[#AAFF45]/10 border border-[#AAFF45]/20"
            }`}
          >
            <Clock className={`w-4 h-4 shrink-0 ${urgentDays ? "text-amber-400" : "text-[#AAFF45]"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${urgentDays ? "text-amber-300" : "text-[#AAFF45]"}`}>
                {remaining === 0
                  ? tc.countdownEndsToday
                  : remaining === 1
                  ? tc.countdownOneDayLeft
                  : tc.countdownDaysLeft(remaining)}
              </p>
              <p className={`text-xs mt-0.5 ${urgentDays ? "text-amber-400/70" : "text-[#AAFF45]/70"}`}>
                {urgentDays ? tc.countdownUrgentBody : tc.countdownEnjoyBody}
              </p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors ${
                urgentDays
                  ? "bg-amber-500 text-white hover:bg-amber-400"
                  : "bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34]"
              }`}
            >
              {tc.countdownSubscribeCta}
            </button>
          </motion.div>
        )}
        {children}
      </>
    );
  }

  const isPastDue = status === "past_due";
  const isCanceled = status === "canceled";
  const isInactive = !isPastDue && !isCanceled;
  const isResubscribe = hasUsedTrial && isInactive;

  const featureHighlights = [
    t("trial_feat_1"),
    t("trial_feat_2"),
    t("trial_feat_3"),
    t("trial_feat_4"),
    t("trial_feat_5"),
  ];

  async function handleStartTrial() {
    setCheckoutError(null);
    try {
      const { url } = await checkoutMutation.mutateAsync(PRICE_ID);
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error("Checkout error:", err.message);
      setCheckoutError(checkoutErrorMessage(err));
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <div className="relative inline-flex mb-3">
            <div className="w-16 h-16 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
              <span className="text-3xl">{pageEmoji}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#0A0A0A] rounded-full flex items-center justify-center border border-[#2A2A2A]">
              <Lock className="w-3 h-3 text-[#555555]" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            {isResubscribe ? tc.resubscribeTitle : pageName}
          </h2>

          {isPastDue && (
            <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 mt-3">
              {tc.paymentOverdue}
            </p>
          )}
          {isCanceled && (
            <p className="text-sm text-[#A0A0A0] mt-2">{tc.subscriptionCanceled}</p>
          )}
          {isInactive && (
            <p className="text-sm text-[#A0A0A0] mt-2 leading-relaxed">
              {isResubscribe ? tc.resubscribeGate : tc.tagline}
            </p>
          )}
        </div>

        <ul className="space-y-2.5 mb-5">
          {featureHighlights.map(f => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-[#A0A0A0]">
              <div className="w-5 h-5 rounded-full bg-[#AAFF45]/10 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-[#AAFF45]" />
              </div>
              {f}
            </li>
          ))}
        </ul>

        {isPastDue ? (
          <button
            onClick={() => navigate("/pricing")}
            className="w-full py-3.5 rounded-lg font-bold text-sm bg-amber-500 text-white hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {tc.ctaAddPayment}
          </button>
        ) : isCanceled || isResubscribe ? (
          <button
            onClick={handleStartTrial}
            disabled={checkoutMutation.isPending}
            className="w-full py-3.5 rounded-lg font-bold text-sm bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34] active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {checkoutMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {tc.ctaRedirecting}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {tc.resubscribeCta}
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleStartTrial}
            disabled={checkoutMutation.isPending}
            className="w-full py-3.5 rounded-lg font-bold text-sm bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34] active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {checkoutMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {tc.ctaRedirecting}
              </>
            ) : (
              <>
                <Gift className="w-4 h-4" />
                {tc.ctaStart}
              </>
            )}
          </button>
        )}

        {checkoutError && (
          <p className="text-xs text-[#FF4444] mt-2 text-center">{checkoutError}</p>
        )}

        <div className="mt-4 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2A2A2A] shrink-0" />
          <p className="text-xs text-[#555555]">
            {isResubscribe || isCanceled ? tc.resubscribeNote : tc.noCardCharge}
          </p>
        </div>

      </motion.div>
    </div>
  );
}
