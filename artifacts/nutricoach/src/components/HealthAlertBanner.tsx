import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, X } from "lucide-react";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import {
  buildUserDataSnapshot,
  logBlocked,
  logWarningShown,
} from "@/lib/onboarding-service";

// Drift dismissal lives in sessionStorage so the warning re-surfaces on the
// next visit but isn't nagged within the same browsing session. Blocking
// alerts are never dismissible.
const SESSION_DISMISS_KEY = "goaliq_health_drift_dismissed";

export function HealthAlertBanner() {
  const [, navigate] = useLocation();
  const { data: check } = useHealthCheck();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  });

  // Audit log on first show of a non-ok status. logBlocked/logWarningShown
  // already dedupe in-memory per trigger_reason within a session, so re-mounts
  // (route navigations) do not create duplicate rows.
  useEffect(() => {
    if (!check || check.status === "ok") return;
    const snapshot = buildUserDataSnapshot({
      weightKg:       check.currentWeightKg ?? check.profileWeightKg ?? 0,
      heightCm:       check.profileHeightCm ?? 0,
      age:            check.profileAge ?? 0,
      sex:            check.profileSex ?? "",
      goalType:       check.profileGoal ?? "",
      targetWeightKg: check.profileTargetKg,
      trainingLevel:  check.profileTrainingLevel,
    });
    if (check.status === "blocking") {
      void logBlocked("post_onboarding_imc_drift", snapshot, "auto_blocked_post_drift");
    } else {
      void logWarningShown("post_onboarding_weight_drift", snapshot);
    }
  }, [check?.status]);

  if (!check || check.status === "ok") return null;

  const isBlocking = check.status === "blocking";
  if (!isBlocking && dismissed) return null;

  const accent = isBlocking ? "#ff4444" : "#ffaa00";
  const tintBg = isBlocking ? "rgba(255,68,68,0.07)" : "rgba(255,170,0,0.07)";
  const tintBorder = isBlocking ? "rgba(255,68,68,0.25)" : "rgba(255,170,0,0.25)";
  const textColor = isBlocking ? "#ff7777" : "#ffcc66";

  function handleDismiss() {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      style={{
        background: tintBg,
        border: `1px solid ${tintBorder}`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <AlertTriangle
        className="w-4 h-4 shrink-0"
        style={{ color: accent, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 12,
            color: textColor,
            fontWeight: 600,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {check.messageEs}
        </p>
        <button
          onClick={() => navigate("/onboarding?edit=true")}
          style={{
            marginTop: 10,
            background: accent,
            color: "#0a0a0a",
            border: "none",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Actualizar mi perfil →
        </button>
      </div>
      {!isBlocking && (
        <button
          onClick={handleDismiss}
          aria-label="Cerrar"
          style={{
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
            padding: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
