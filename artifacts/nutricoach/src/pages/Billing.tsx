import { useState } from "react";
import { useLocation } from "wouter";
import { useSubscription, useCreatePortal, useCreateCheckout, checkoutErrorMessage } from "@/lib/subscription";
import { useTrialCopy } from "@/lib/i18n";
import { useT } from "@/lib/language";
import { motion } from "framer-motion";

import {
  ArrowLeft, CreditCard, CheckCircle2, Clock, AlertTriangle,
  XCircle, Gift, Zap, Loader2, ExternalLink, ShieldCheck,
} from "lucide-react";

const PRICE_ID = "price_1TFYJVAC9aQrlGDtdvlFPtjX";

function daysLeft(trialEndsAt: number | null): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt * 1000 - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

type StatusConfig = {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
};

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "trialing":
      return {
        icon: Gift,
        iconColor: "text-[#AAFF45]",
        bgColor: "bg-[#AAFF45]/10",
        borderColor: "border-[#AAFF45]/20",
        badgeBg: "bg-[#AAFF45]/20 text-[#AAFF45]",
      };
    case "active":
      return {
        icon: CheckCircle2,
        iconColor: "text-[#AAFF45]",
        bgColor: "bg-[#AAFF45]/10",
        borderColor: "border-[#AAFF45]/20",
        badgeBg: "bg-[#AAFF45]/20 text-[#AAFF45]",
      };
    case "past_due":
      return {
        icon: AlertTriangle,
        iconColor: "text-amber-400",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/20",
        badgeBg: "bg-amber-500/20 text-amber-300",
      };
    case "canceled":
      return {
        icon: XCircle,
        iconColor: "text-[#555555]",
        bgColor: "bg-[#1A1A1A]",
        borderColor: "border-[#2A2A2A]",
        badgeBg: "bg-[#2A2A2A] text-[#A0A0A0]",
      };
    default:
      return {
        icon: Clock,
        iconColor: "text-[#555555]",
        bgColor: "bg-[#1A1A1A]",
        borderColor: "border-[#2A2A2A]",
        badgeBg: "bg-[#2A2A2A] text-[#A0A0A0]",
      };
  }
}

export default function Billing() {
  const [, navigate] = useLocation();
  const { data: subData, isLoading } = useSubscription();
  const portalMutation = useCreatePortal();
  const checkoutMutation = useCreateCheckout();
  const tc = useTrialCopy();
  const t = useT();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const status = subData?.status ?? "inactive";
  const hasAccess = subData?.hasAccess ?? false;
  const hasUsedTrial = subData?.hasUsedTrial ?? false;
  const trialEndsAt = subData?.trialEndsAt ?? null;
  const remaining = daysLeft(trialEndsAt);

  const trialEndFormatted = trialEndsAt
    ? new Date(trialEndsAt * 1000).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const cfg = getStatusConfig(status);
  const isResubscribe = hasUsedTrial && !hasAccess && status !== "past_due";
  const StatusIcon = cfg.icon;

  const isManageable = ["trialing", "active", "past_due"].includes(status);

  function getBadgeText() {
    switch (status) {
      case "trialing": return t("trial_active_badge");
      case "active": return t("active_badge");
      case "past_due": return t("payment_overdue_badge");
      case "canceled": return t("canceled_badge");
      default: return t("no_plan_badge");
    }
  }

  function getDescription() {
    switch (status) {
      case "trialing": return t("trial_desc");
      case "active": return t("active_desc");
      case "past_due": return t("past_due_desc");
      case "canceled": return t("canceled_desc");
      default: return hasUsedTrial ? t("no_plan_resubscribe") : t("no_plan_trial");
    }
  }

  async function handleManage() {
    try {
      const { url } = await portalMutation.mutateAsync();
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error("Portal error:", err.message);
    }
  }

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

  const badgeText = getBadgeText();
  const description = getDescription();

  const features = [
    t("feat_meal_plan"),
    t("feat_workout"),
    t("feat_ingredient_swap"),
    t("feat_weight"),
    t("feat_insights"),
    t("feat_streak"),
  ];

  return (
    <div className="p-5 sm:p-7 lg:p-10 max-w-xl mx-auto font-sans">
      <button
        onClick={() => navigate("/dashboard")}
        className="inline-flex items-center gap-2 text-[#555555] hover:text-white text-sm font-medium mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("back_to_dashboard")}
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-[#AAFF45]/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-[#AAFF45]" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold uppercase text-white">{t("billing_title")}</h1>
          <p className="text-sm text-[#555555]">{t("billing_subtitle")}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#AAFF45]" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Status card */}
          <div className={`rounded-lg border-2 p-5 ${cfg.bgColor} ${cfg.borderColor}`}>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-[#0A0A0A]/30 flex items-center justify-center shrink-0">
                <StatusIcon className={`w-6 h-6 ${cfg.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-white">GoalIQ</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badgeBg}`}>
                    {badgeText}
                  </span>
                </div>
                <p className="text-sm text-[#A0A0A0] leading-relaxed">{description}</p>
              </div>
            </div>
          </div>

          {/* Plan details */}
          <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2A2A2A]">
              <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-3">{t("plan_details")}</p>
              <div className="space-y-3">
                <Row label={t("plan_label")} value="GoalIQ" />
                <Row label={t("price_label")} value={t("price_monthly_display")} />
                <Row label={t("status_label")} value={badgeText} />
                {status === "trialing" && trialEndFormatted && (
                  <Row
                    label={t("trial_ends_label")}
                    value={trialEndFormatted}
                    valueExtra={
                      remaining !== null
                        ? remaining === 0
                          ? t("ends_today")
                          : remaining === 1
                          ? t("one_day_left")
                          : t("n_days_left", { n: remaining })
                        : undefined
                    }
                    urgency={remaining !== null && remaining <= 1}
                  />
                )}
                {status === "active" && (
                  <Row label={t("billing_monthly_label")} value={t("monthly_billing")} />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-4 space-y-3">
              {isManageable && (
                <button
                  onClick={handleManage}
                  disabled={portalMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#2A2A2A] text-white text-sm font-semibold hover:bg-[#3A3A3A] transition-colors disabled:opacity-60"
                >
                  {portalMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  {t("manage_subscription")}
                </button>
              )}

              {!hasAccess && status !== "past_due" && (
                <button
                  onClick={status === "canceled" ? () => navigate("/pricing") : handleStartTrial}
                  disabled={checkoutMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#AAFF45] text-[#0A0A0A] text-sm font-bold hover:bg-[#99EE34] transition-colors disabled:opacity-60"
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isResubscribe || status === "canceled" ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Gift className="w-4 h-4" />
                  )}
                  {isResubscribe || status === "canceled" ? tc.ctaResubscribe : tc.ctaStart}
                </button>
              )}

              {checkoutError && (
                <p className="text-xs text-[#FF4444] mt-2 text-center px-2">{checkoutError}</p>
              )}
            </div>
          </div>

          {/* What's included */}
          {hasAccess && (
            <div className="bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] p-5">
              <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-3">{t("whats_included")}</p>
              <ul className="space-y-2.5">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-[#A0A0A0]">
                    <CheckCircle2 className="w-4 h-4 text-[#AAFF45] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <ShieldCheck className="w-4 h-4 text-[#2A2A2A]" />
            <p className="text-xs text-[#555555]">{t("payments_secured")}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueExtra,
  urgency,
}: {
  label: string;
  value: string;
  valueExtra?: string;
  urgency?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[#555555]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">{value}</span>
        {valueExtra && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgency ? "bg-amber-500/20 text-amber-300" : "bg-[#AAFF45]/20 text-[#AAFF45]"}`}>
            {valueExtra}
          </span>
        )}
      </div>
    </div>
  );
}
