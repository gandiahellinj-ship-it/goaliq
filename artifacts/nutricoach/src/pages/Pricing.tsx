import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Check, ArrowLeft, Settings, Zap, Gift, Shield } from "lucide-react";
import { motion } from "framer-motion";
import {
  useSubscription,
  useCreateCheckout,
  useCreatePortal,
  checkoutErrorMessage,
  type SubscriptionStatus,
} from "@/lib/subscription";
import { useTrialCopy } from "@/lib/i18n";
import { useT } from "@/lib/language";

const PRICE_ID = "price_1TFYJVAC9aQrlGDtdvlFPtjX";

export default function Pricing() {
  const { isAuthenticated, login } = useAuth();
  const [, navigate] = useLocation();
  const { data: subData, isLoading } = useSubscription();
  const checkoutMutation = useCreateCheckout();
  const portalMutation = useCreatePortal();
  const tc = useTrialCopy();
  const t = useT();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const status = subData?.status ?? "none";
  const access = subData?.hasAccess ?? false;
  const hasUsedTrial = subData?.hasUsedTrial ?? false;

  const isResubscribe = isAuthenticated && hasUsedTrial && !access;

  const allFeatures = [
    t("pricing_feat_1"),
    t("pricing_feat_shopping"),
    t("pricing_feat_2"),
    t("pricing_feat_3"),
    t("pricing_feat_4"),
    t("pricing_feat_5"),
    t("pricing_feat_6"),
    t("pricing_feat_7"),
    t("pricing_feat_8"),
  ];

  function statusLabel(s: SubscriptionStatus): string {
    switch (s) {
      case "trialing": return t("pricing_status_trial");
      case "active": return t("pricing_status_active");
      case "past_due": return t("pricing_status_past_due");
      case "canceled": return t("pricing_status_canceled");
      case "unpaid": return t("pricing_status_unpaid");
      default: return "";
    }
  }

  function statusColor(s: SubscriptionStatus): string {
    if (s === "trialing") return "bg-[#AAFF45]/10 border-[#AAFF45]/20 text-[#AAFF45]";
    if (s === "active") return "bg-[#AAFF45]/10 border-[#AAFF45]/20 text-[#AAFF45]";
    return "bg-amber-500/10 border-amber-500/20 text-amber-400";
  }

  const handleCta = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }
    if (access) {
      navigate("/dashboard");
      return;
    }
    if (status === "past_due") {
      try {
        const { url } = await portalMutation.mutateAsync();
        if (url) window.location.href = url;
      } catch (err: any) {
        console.error("Portal error:", err.message);
      }
      return;
    }
    setCheckoutError(null);
    try {
      const { url } = await checkoutMutation.mutateAsync(PRICE_ID);
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error("Checkout error:", err.message);
      setCheckoutError(checkoutErrorMessage(err));
    }
  };

  const handleManage = async () => {
    try {
      const { url } = await portalMutation.mutateAsync();
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error("Portal error:", err.message);
    }
  };

  function ctaLabel() {
    if (!isAuthenticated) return tc.ctaSignup;
    if (access) return t("go_to_dashboard");
    if (status === "past_due") return tc.ctaAddPayment;
    if (isResubscribe) return tc.resubscribeCta;
    return tc.ctaStartShort;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-10 sm:py-16 font-sans">
      <div className="max-w-xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#555555] hover:text-white text-sm font-medium mb-10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("back_to_home")}
        </Link>

        <div className="flex items-center gap-2 mb-6 justify-center">
          <span className="font-display font-black italic text-2xl leading-none">
            <span className="text-white">Goal</span><span className="text-[#AAFF45]">IQ</span>
          </span>
        </div>

        <div className="text-center max-w-xl mx-auto mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-white mb-3">
            {isResubscribe ? tc.resubscribeTitle : t("one_plan_everything")}
          </h1>
          <p className="text-[#A0A0A0] text-base">
            {isResubscribe ? tc.resubscribeSubtitle : tc.pricingSubheading}
          </p>
        </div>

        {isAuthenticated && status !== "none" && (
          <div className="flex justify-center mb-8">
            <div className={`inline-flex items-center gap-2 border font-semibold text-sm px-4 py-2 rounded-full ${statusColor(status as SubscriptionStatus)}`}>
              <span>{statusLabel(status as SubscriptionStatus)}</span>
              {(status === "active" || status === "trialing") && (
                <button
                  onClick={handleManage}
                  disabled={portalMutation.isPending}
                  className="ml-1 flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
                >
                  <Settings className="w-3 h-3" />
                  {t("pricing_manage")}
                </button>
              )}
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1A1A1A] rounded-xl border border-[#AAFF45]/30 shadow-2xl overflow-hidden"
        >
          <div className="bg-[#AAFF45] px-8 pt-8 pb-10 text-center relative">
            <div className="inline-flex items-center gap-2 bg-[#0A0A0A]/20 text-[#0A0A0A] text-xs font-bold px-3 py-1.5 rounded-full mb-5">
              <Gift className="w-3.5 h-3.5" />
              {isResubscribe ? tc.resubscribeBadge : tc.badge}
            </div>
            <div className="flex items-end justify-center gap-1 mb-1">
              <span className="text-5xl font-black text-[#0A0A0A]">€19.99</span>
              <span className="text-[#0A0A0A]/60 font-semibold mb-1.5">{t("per_month")}</span>
            </div>
            <p className="text-[#0A0A0A]/70 text-sm">
              {isResubscribe ? tc.resubscribePriceNote : tc.priceAfterTrial}
            </p>
          </div>

          <div className="px-8 py-8">
            <ul className="space-y-3.5 mb-8">
              {allFeatures.map(feat => (
                <li key={feat} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#AAFF45]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-[#AAFF45]" />
                  </div>
                  <span className="text-sm text-[#A0A0A0]">{feat}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleCta}
              disabled={isLoading || checkoutMutation.isPending || portalMutation.isPending}
              className="w-full py-4 rounded-lg font-bold text-base bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34] transition-all hover:-translate-y-0.5 shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isLoading || checkoutMutation.isPending ? (
                <span className="inline-block w-5 h-5 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
              ) : access || isResubscribe ? (
                <>
                  <Zap className="w-5 h-5" />
                  {ctaLabel()}
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5" />
                  {ctaLabel()}
                </>
              )}
            </button>

            {checkoutError && (
              <p className="text-xs text-[#FF4444] mt-2 text-center px-2">{checkoutError}</p>
            )}

            <div className="flex items-center gap-2 justify-center mt-5 text-xs text-[#555555]">
              <Shield className="w-3.5 h-3.5" />
              {isResubscribe ? tc.resubscribeSecured : tc.securedByStripe}
            </div>
          </div>
        </motion.div>

        <div className="mt-8 text-center text-sm text-[#555555]">
          {isResubscribe ? (
            <p>{tc.resubscribeNote}</p>
          ) : (
            <p>{t("after_trial_note")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
