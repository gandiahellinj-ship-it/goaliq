import { useLocation } from "wouter";
import { Lock, Gift, Zap } from "lucide-react";
import { useTrialCopy } from "@/lib/i18n";
import { useSubscription } from "@/lib/subscription";

interface UpgradeBannerProps {
  feature: string;
  compact?: boolean;
  className?: string;
  requiredTier?: string;
}

export function UpgradeBanner({
  feature,
  compact = false,
  className = "",
}: UpgradeBannerProps) {
  const [, navigate] = useLocation();
  const t = useTrialCopy();
  const { data: subData } = useSubscription();

  const hasUsedTrial = subData?.hasUsedTrial ?? false;
  const hasAccess = subData?.hasAccess ?? false;
  const isResubscribe = hasUsedTrial && !hasAccess;

  if (compact) {
    return (
      <button
        onClick={() => navigate("/pricing")}
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors text-[#AAFF45] bg-[#AAFF45]/10 border border-[#AAFF45]/20 hover:bg-[#AAFF45]/20 ${className}`}
      >
        {isResubscribe ? <Zap className="w-3 h-3" /> : <Gift className="w-3 h-3" />}
        {isResubscribe ? t.ctaResubscribe : t.ctaUnlock}
      </button>
    );
  }

  return (
    <div className={`rounded-lg border-2 p-6 text-center bg-[#1A1A1A] border-[#AAFF45]/20 ${className}`}>
      <div className="w-12 h-12 rounded-lg bg-[#AAFF45]/10 flex items-center justify-center mx-auto mb-3">
        <Lock className="w-6 h-6 text-[#AAFF45]" />
      </div>
      <h3 className="font-bold text-white mb-1">{feature}</h3>
      {isResubscribe ? (
        <>
          <p className="text-sm text-[#A0A0A0] mb-1 leading-relaxed">{t.resubscribeSubtitle}</p>
          <p className="text-xs text-[#555555] mb-4">{t.resubscribeNote}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-[#A0A0A0] mb-1 leading-relaxed">{t.availableDuringTrial}</p>
          <p className="text-xs text-[#555555] mb-4">{t.tagline}</p>
        </>
      )}
      <button
        onClick={() => navigate("/pricing")}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all hover:-translate-y-0.5 bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34]"
      >
        {isResubscribe ? <Zap className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
        {isResubscribe ? t.ctaResubscribe : t.ctaStartShort}
      </button>
    </div>
  );
}
