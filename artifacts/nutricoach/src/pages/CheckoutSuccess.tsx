import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { useTrialCopy } from "@/lib/i18n";
import { useT } from "@/lib/language";
import type { SubscriptionStatus } from "@/lib/subscription";

async function verifyCheckoutSession(
  sessionId: string,
  token: string,
): Promise<{ status: SubscriptionStatus; hasAccess: boolean; trialEndsAt: number | null }> {
  const res = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function CheckoutSuccess() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const search = useSearch();
  const { session } = useAuth();
  const tc = useTrialCopy();
  const t = useT();

  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedStatus, setVerifiedStatus] = useState<SubscriptionStatus | null>(null);

  const sessionId = new URLSearchParams(search).get("session_id");

  useEffect(() => {
    if (!session?.access_token) return;

    async function confirm() {
      try {
        let data: { status: SubscriptionStatus; hasAccess: boolean; trialEndsAt: number | null } | null = null;

        if (sessionId) {
          data = await verifyCheckoutSession(sessionId, session!.access_token!);
        }

        if (data) {
          setVerifiedStatus(data.status);
          queryClient.setQueryData(
            ["subscription", session!.user?.id],
            data,
          );
        }

        queryClient.invalidateQueries({ queryKey: ["subscription"] });
        setVerified(true);
      } catch (err: any) {
        queryClient.invalidateQueries({ queryKey: ["subscription"] });
        setError(err.message ?? "Something went wrong confirming your subscription.");
        setVerified(true);
      }
    }

    confirm();
  }, [session?.access_token, sessionId, queryClient]);

  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(() => navigate("/dashboard"), 2000);
    return () => clearTimeout(timer);
  }, [verified, navigate]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] shadow-2xl p-8 max-w-sm w-full text-center"
      >
        {!verified ? (
          <>
            <div className="w-16 h-16 rounded-full bg-[#AAFF45]/10 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-[#AAFF45] animate-spin" />
            </div>
            <h1 className="text-xl font-display font-bold uppercase text-white mb-2">{tc.activatingSubscription}</h1>
            <p className="text-[#555555] text-sm">{t("confirming_with_stripe")}</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-[#AAFF45]/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-9 h-9 text-[#AAFF45]" />
            </div>

            <h1 className="text-2xl font-display font-black uppercase text-white mb-2">{tc.successTitle} 🎉</h1>
            <p className="text-[#A0A0A0] text-sm leading-relaxed mb-6">
              {verifiedStatus === "trialing" ? tc.successBody : tc.resubscribeSuccessBody}
            </p>

            {error && (
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3.5 rounded-lg bg-[#AAFF45] text-[#0A0A0A] font-bold text-sm hover:bg-[#99EE34] transition-colors flex items-center justify-center gap-2"
            >
              {t("go_to_dashboard")}
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-xs text-[#555555] mt-4">
              {verifiedStatus === "trialing" ? tc.successFooter : tc.resubscribeSuccessFooter}
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
