import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/lib/subscription";
import { useTrialCopy } from "@/lib/i18n";
import { useT } from "@/lib/language";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Utensils,
  Dumbbell,
  CalendarDays,
  TrendingUp,
  ShoppingCart,
  LogOut,
  ChevronDown,
  Lock,
  CreditCard,
  Gift,
  Clock,
  User,
  Settings,
  FlaskConical,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GATED_ROUTES = new Set(["/meals", "/workouts", "/calendar", "/progress", "/shopping"]);

const navItems = [
  { href: "/dashboard",  icon: LayoutDashboard, labelKey: "nav_home",      gated: false },
  { href: "/meals",      icon: Utensils,        labelKey: "nav_meals",     gated: true  },
  { href: "/shopping",   icon: ShoppingCart,    labelKey: "nav_shopping",  gated: true  },
  { href: "/workouts",   icon: Dumbbell,        labelKey: "nav_workouts",  gated: true  },
  { href: "/calendar",   icon: CalendarDays,    labelKey: "nav_calendar",  gated: true  },
  { href: "/progress",   icon: TrendingUp,      labelKey: "nav_progress",  gated: true  },
];

function GoalIQLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const h = size === "sm" ? 22 : 28;
  return (
    <img
      src="/images/GOALIQ.png"
      alt="GoalIQ"
      style={{ height: h, width: "auto", objectFit: "contain", display: "block" }}
    />
  );
}

// ─── QA Types ─────────────────────────────────────────────────────────────────

type QAResult = { label: string; status: "pass" | "fail" | "warn"; detail?: string };
type QAReport = {
  timestamp: string;
  summary: { passing: number; failing: number; warnings: number; status: string };
  results: QAResult[];
};

type E2EResult = { id: number; name: string; status: "pass" | "fail" | "warn" | "skip"; detail?: string; warnings?: string[] };
type E2EReport = {
  timestamp:  string;
  testUser:   string;
  summary:    { total: number; passing: number; failing: number; warnings: number; status: string; durationMs: number };
  results:    E2EResult[];
};

// ─── Shared result row ───────────────────────────────────────────────────────

function QAResultRow({ status, label, detail, warnings }: {
  status: "pass" | "fail" | "warn" | "skip";
  label: string;
  detail?: string;
  warnings?: string[];
}) {
  const t = useT();
  const icon =
    status === "pass" ? <CheckCircle2 className="w-3.5 h-3.5 text-[#AAFF45] shrink-0 mt-0.5" /> :
    status === "fail" ? <XCircle       className="w-3.5 h-3.5 text-red-400  shrink-0 mt-0.5" /> :
    status === "warn" ? <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" /> :
                        <AlertTriangle className="w-3.5 h-3.5 text-[#555555] shrink-0 mt-0.5" />;
  const bg =
    status === "pass" ? "bg-[#AAFF45]/5 border-[#AAFF45]/10" :
    status === "fail" ? "bg-red-500/10 border-red-500/20" :
    status === "warn" ? "bg-orange-500/10 border-orange-500/20" :
                        "bg-[#222]/10 border-[#333]/20";
  const detailColor =
    status === "fail" ? "text-red-400" :
    status === "warn" ? "text-orange-400" : "text-[#555555]";

  void t;
  return (
    <div className={`flex items-start gap-2 text-xs py-1.5 px-3 rounded-lg border ${bg}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <span className="text-white font-medium">{label}</span>
        {detail && <span className={`ml-2 ${detailColor}`}>{detail}</span>}
        {warnings?.map((w, i) => (
          <div key={i} className="text-orange-400 mt-0.5 pl-2">↳ {w}</div>
        ))}
      </div>
    </div>
  );
}

// ─── QA Modal ────────────────────────────────────────────────────────────────

function QAModal({ report, session, onClose }: { report: QAReport; session: any; onClose: () => void }) {
  const { summary, results, timestamp } = report;
  const [e2eLoading, setE2eLoading] = useState(false);
  const [e2eReport, setE2eReport]   = useState<E2EReport | null>(null);

  const statusColor =
    summary.status === "HEALTHY"         ? "text-[#AAFF45]" :
    summary.status === "NEEDS ATTENTION" ? "text-orange-400" :
                                           "text-red-400";

  const groups = {
    fail: results.filter((r) => r.status === "fail"),
    warn: results.filter((r) => r.status === "warn"),
    pass: results.filter((r) => r.status === "pass"),
  };

  async function runE2E() {
    setE2eLoading(true);
    setE2eReport(null);
    try {
      const token = session?.access_token;
      const res = await fetch("/api/qa/e2e", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(180_000),
      });
      const data = await res.json();
      setE2eReport(data);
    } catch (err) {
      console.error("E2E failed:", err);
    } finally {
      setE2eLoading(false);
    }
  }

  const e2eStatusColor =
    !e2eReport ? "" :
    e2eReport.summary.status === "ALL GOOD"        ? "text-[#AAFF45]" :
    e2eReport.summary.status === "NEEDS ATTENTION" ? "text-orange-400" :
                                                      "text-red-400";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border shadow-2xl flex flex-col"
        style={{ backgroundColor: "#111111", borderColor: "#2A2A2A" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 z-10" style={{ backgroundColor: "#111111", borderBottom: "1px solid #2A2A2A" }}>
          <div>
            <p className="text-xs font-bold text-[#555555] uppercase tracking-widest">GoalIQ QA Report</p>
            <p className={`text-lg font-black uppercase ${statusColor}`}>{summary.status}</p>
            <p className="text-[10px] text-[#555555] mt-0.5">{new Date(timestamp).toLocaleString("es-ES")}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2A2A2A] transition-colors text-[#555555] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary pills */}
        <div className="flex gap-3 px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#AAFF45]">
            <CheckCircle2 className="w-3.5 h-3.5" /> {summary.passing} passing
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
            <XCircle className="w-3.5 h-3.5" /> {summary.failing} failing
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-400">
            <AlertTriangle className="w-3.5 h-3.5" /> {summary.warnings} warnings
          </div>
        </div>

        {/* QA Results */}
        <div className="px-5 pb-4 space-y-4">
          {groups.fail.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">❌ Failing</p>
              <div className="space-y-1">
                {groups.fail.map((r, i) => (
                  <QAResultRow key={i} status="fail" label={r.label} detail={r.detail} />
                ))}
              </div>
            </div>
          )}
          {groups.warn.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">⚠️ Warnings</p>
              <div className="space-y-1">
                {groups.warn.map((r, i) => (
                  <QAResultRow key={i} status="warn" label={r.label} detail={r.detail} />
                ))}
              </div>
            </div>
          )}
          {groups.pass.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#AAFF45] uppercase tracking-widest mb-2">✅ Passing</p>
              <div className="space-y-1">
                {groups.pass.map((r, i) => (
                  <QAResultRow key={i} status="pass" label={r.label} detail={r.detail} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* E2E divider + button */}
        <div className="px-5 pb-5" style={{ borderTop: "1px solid #2A2A2A" }}>
          <div className="pt-4">
            <button
              onClick={runE2E}
              disabled={e2eLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors"
              style={{
                backgroundColor: e2eLoading ? "color-mix(in srgb, #7c3aed 20%, transparent)" : "color-mix(in srgb, #7c3aed 15%, transparent)",
                color: "#a78bfa",
                border: "1px solid color-mix(in srgb, #7c3aed 40%, transparent)",
              }}
            >
              {e2eLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ejecutando tests… (puede tardar 1 minuto)
                </>
              ) : (
                <>
                  <FlaskConical className="w-4 h-4" />
                  🤖 Test E2E completo
                </>
              )}
            </button>
          </div>

          {/* E2E Results */}
          {e2eReport && (
            <div className="mt-4 space-y-3">
              {/* E2E header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#555555] uppercase tracking-widest">E2E Test Suite</p>
                  <p className={`text-base font-black uppercase ${e2eStatusColor}`}>{e2eReport.summary.status}</p>
                  <p className="text-[10px] text-[#555555]">
                    {e2eReport.summary.passing}/{e2eReport.summary.total} passed · {(e2eReport.summary.durationMs / 1000).toFixed(1)}s
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-[#AAFF45] font-semibold">✅ {e2eReport.summary.passing}</span>
                  <span className="text-red-400 font-semibold">❌ {e2eReport.summary.failing}</span>
                  <span className="text-orange-400 font-semibold">⚠️ {e2eReport.summary.warnings}</span>
                </div>
              </div>

              {/* E2E result rows */}
              <div className="space-y-1">
                {e2eReport.results.map((r) => (
                  <QAResultRow
                    key={r.id}
                    status={r.status}
                    label={`${String(r.id).padStart(2, "0")}. ${r.name}`}
                    detail={r.detail}
                    warnings={r.warnings}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, isAuthenticated, logout, session } = useAuth();
  const [location, setLocation] = useLocation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const { data: subData } = useSubscription();
  const [qaOpen, setQaOpen] = useState(false);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaReport, setQaReport] = useState<QAReport | null>(null);

  const isDevEnv =
    typeof window !== "undefined" &&
    window.location.hostname.includes("replit.dev");

  const runQA = useCallback(async () => {
    setQaLoading(true);
    try {
      const token = session?.access_token;
      const res = await fetch("/api/qa", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setQaReport(data);
      setQaOpen(true);
    } catch (err) {
      console.error("QA check failed:", err);
    } finally {
      setQaLoading(false);
    }
  }, [session]);

  const hasAccess = subData?.hasAccess ?? false;
  const isTrialing = subData?.status === "trialing";
  const trialEndsAt = subData?.trialEndsAt ?? null;
  const t = useTrialCopy();
  const tl = useT();

  function trialDaysLeft(): number | null {
    if (!trialEndsAt) return null;
    const ms = trialEndsAt * 1000 - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("age")
      .maybeSingle()
      .then(({ data }) => {
        setHasCompletedOnboarding(!!data?.age);
        setProfileLoading(false);
      });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    } else if (isAuthenticated && !profileLoading) {
      if (!hasCompletedOnboarding && location !== "/onboarding") {
        setLocation("/onboarding");
      }
    }
  }, [authLoading, isAuthenticated, profileLoading, hasCompletedOnboarding, location, setLocation]);

  if (authLoading || (isAuthenticated && profileLoading)) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !hasCompletedOnboarding) {
    return null;
  }

  const displayName = user?.firstName || user?.username?.split("@")[0] || "there";

  function NavLink({ item }: { item: typeof navItems[0] }) {
    const isActive = location === item.href;
    const isLocked = item.gated && !hasAccess;

    return (
      <Link
        key={item.href}
        href={item.href}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative"
        style={{
          backgroundColor: isActive ? "color-mix(in srgb, var(--giq-accent) 10%, transparent)" : "transparent",
          color: isActive ? "var(--giq-accent)" : "var(--giq-text-secondary)",
          fontWeight: isActive ? 600 : 400,
          borderLeft: isActive ? "2px solid var(--giq-accent)" : "2px solid transparent",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--giq-bg-card)";
            (e.currentTarget as HTMLElement).style.color = "var(--giq-text-primary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--giq-text-secondary)";
          }
        }}
      >
        <item.icon
          className="w-5 h-5 shrink-0"
          style={{ color: isActive ? "var(--giq-accent)" : "var(--giq-text-muted)" }}
        />
        <span className="text-sm">{tl(item.labelKey)}</span>
        {isLocked && !isActive && (
          <Lock className="ml-auto w-3.5 h-3.5" style={{ color: "var(--giq-border)" }} />
        )}
      </Link>
    );
  }

  function MobileNavItem({ item }: { item: typeof navItems[0] }) {
    const isActive = location === item.href;
    const isLocked = item.gated && !hasAccess;

    return (
      <Link
        key={item.href}
        href={item.href}
        className="flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 relative"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 relative"
          style={{
            backgroundColor: isActive
              ? "color-mix(in srgb, var(--giq-accent) 15%, transparent)"
              : "transparent",
          }}
        >
          <item.icon
            className="w-5 h-5"
            style={{ color: isActive ? "var(--giq-accent)" : "var(--giq-text-muted)" }}
          />
          {isLocked && !isActive && (
            <div
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: "var(--giq-bg-card)",
                border: "1px solid var(--giq-border)",
              }}
            >
              <Lock className="w-2 h-2" style={{ color: "var(--giq-text-muted)" }} />
            </div>
          )}
        </div>
        <span
          className="text-[10px] font-medium mt-0.5 transition-colors"
          style={{ color: isActive ? "var(--giq-accent)" : "var(--giq-text-muted)" }}
        >
          {tl(item.labelKey)}
        </span>
      </Link>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row font-sans overflow-x-hidden"
      style={{ backgroundColor: "var(--giq-bg-primary)", color: "var(--giq-text-primary)" }}
    >
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 sticky top-0 h-screen z-40"
        style={{
          backgroundColor: "var(--giq-bg-secondary)",
          borderRight: "1px solid var(--giq-border)",
        }}
      >
        <div className="p-5" style={{ borderBottom: "1px solid var(--giq-border)" }}>
          <GoalIQLogo />
        </div>

        <nav className="flex-1 px-3 py-5 space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {isTrialing ? (
          <div className="px-3 pb-3">
            <Link
              href="/billing"
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                backgroundColor: "color-mix(in srgb, var(--giq-accent) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--giq-accent) 20%, transparent)",
                color: "var(--giq-accent)",
              }}
            >
              {(trialDaysLeft() ?? 0) <= 1 ? (
                <Clock className="w-4 h-4 shrink-0" />
              ) : (
                <Gift className="w-4 h-4 shrink-0" />
              )}
              <span className="flex-1 text-xs">
                {trialDaysLeft() === 0
                  ? tl("trial_ends_today")
                  : trialDaysLeft() === 1
                  ? tl("trial_days_left_one")
                  : tl("trial_days_left_n", { n: trialDaysLeft()! })}
              </span>
            </Link>
          </div>
        ) : !hasAccess ? (
          <div className="px-3 pb-3">
            <Link
              href="/pricing"
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-bold transition-colors"
              style={{
                backgroundColor: "var(--giq-accent)",
                color: "var(--giq-accent-text)",
              }}
            >
              <Gift className="w-4 h-4 shrink-0" />
              {t.ctaStartFree}
            </Link>
          </div>
        ) : null}

        {/* QA Button — dev only */}
        {isDevEnv && (
          <div className="px-3 pb-2">
            <button
              onClick={runQA}
              disabled={qaLoading}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{
                backgroundColor: "color-mix(in srgb, #6366f1 12%, transparent)",
                color: "#818cf8",
                border: "1px solid color-mix(in srgb, #6366f1 30%, transparent)",
              }}
            >
              {qaLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              )}
              {qaLoading ? "Analizando…" : "🔍 QA"}
            </button>
          </div>
        )}



        <div className="p-3 mt-auto" style={{ borderTop: "1px solid var(--giq-border)" }}>
          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
              style={{ color: "var(--giq-text-primary)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--giq-bg-card)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")
              }
            >
              <img
                src={user?.profileImage || `${import.meta.env.BASE_URL}images/avatar.png`}
                alt="Profile"
                className="w-9 h-9 rounded-lg object-cover shrink-0"
                style={{
                  border: "1px solid var(--giq-border)",
                  backgroundColor: "var(--giq-bg-card)",
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--giq-text-primary)" }}>
                  {displayName}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--giq-text-muted)" }}>
                  {user?.username || ""}
                </p>
              </div>
              <ChevronDown
                className={cn("w-4 h-4 transition-transform shrink-0", profileMenuOpen && "rotate-180")}
                style={{ color: "var(--giq-text-muted)" }}
              />
            </button>

            <AnimatePresence>
              {profileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-full left-0 right-0 mb-1 rounded-lg shadow-2xl overflow-hidden"
                  style={{
                    backgroundColor: "var(--giq-bg-card)",
                    border: "1px solid var(--giq-border)",
                  }}
                >
                  <ProfileMenuItem
                    icon={<User className="w-4 h-4" />}
                    label={tl("my_profile")}
                    href="/profile"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <ProfileMenuItem
                    icon={<CreditCard className="w-4 h-4" />}
                    label={tl("billing")}
                    href="/billing"
                    onClick={() => setProfileMenuOpen(false)}
                    bordered
                  />
                  <ProfileMenuItem
                    icon={<Settings className="w-4 h-4" />}
                    label={tl("nav_settings")}
                    href="/settings"
                    onClick={() => setProfileMenuOpen(false)}
                    bordered
                  />
                  <button
                    onClick={() => { setProfileMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                    style={{
                      color: "var(--giq-error)",
                      borderTop: "1px solid var(--giq-border)",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.backgroundColor =
                        "color-mix(in srgb, var(--giq-error) 10%, transparent)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")
                    }
                  >
                    <LogOut className="w-4 h-4" />
                    {tl("sign_out")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40"
        style={{
          backgroundColor: "var(--giq-bg-secondary)",
          borderBottom: "1px solid var(--giq-border)",
        }}
      >
        <GoalIQLogo size="sm" />

        <div className="flex items-center gap-2">
          {/* QA button — dev only */}
          {isDevEnv && (
            <button
              onClick={runQA}
              disabled={qaLoading}
              className="p-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: "color-mix(in srgb, #6366f1 12%, transparent)",
                color: "#818cf8",
                border: "1px solid color-mix(in srgb, #6366f1 30%, transparent)",
              }}
              title="QA"
            >
              {qaLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FlaskConical className="w-4 h-4" />
              )}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg transition-colors"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--giq-bg-card)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")
              }
            >
              <img
                src={user?.profileImage || `${import.meta.env.BASE_URL}images/avatar.png`}
                alt="Profile"
                className="w-8 h-8 rounded-lg object-cover"
                style={{
                  border: "1px solid var(--giq-border)",
                  backgroundColor: "var(--giq-bg-card)",
                }}
              />
              <span
                className="text-sm font-medium max-w-[80px] truncate"
                style={{ color: "var(--giq-text-primary)" }}
              >
                {displayName}
              </span>
              <ChevronDown
                className={cn("w-4 h-4 transition-transform", profileMenuOpen && "rotate-180")}
                style={{ color: "var(--giq-text-muted)" }}
              />
            </button>

            <AnimatePresence>
              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute right-0 top-full mt-1 w-52 rounded-lg shadow-2xl z-50 overflow-hidden"
                    style={{
                      backgroundColor: "var(--giq-bg-card)",
                      border: "1px solid var(--giq-border)",
                    }}
                  >
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--giq-border)" }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--giq-text-primary)" }}>
                        {displayName}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--giq-text-muted)" }}>
                        {user?.username || ""}
                      </p>
                    </div>
                    <ProfileMenuItem
                      icon={<User className="w-4 h-4" />}
                      label={tl("my_profile")}
                      href="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <ProfileMenuItem
                      icon={<CreditCard className="w-4 h-4" />}
                      label={tl("billing")}
                      href="/billing"
                      onClick={() => setProfileMenuOpen(false)}
                      bordered
                    />
                    <ProfileMenuItem
                      icon={<Settings className="w-4 h-4" />}
                      label={tl("nav_settings")}
                      href="/settings"
                      onClick={() => setProfileMenuOpen(false)}
                      bordered
                    />
                    <button
                      onClick={() => { setProfileMenuOpen(false); logout(); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                      style={{
                        color: "var(--giq-error)",
                        borderTop: "1px solid var(--giq-border)",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.backgroundColor =
                          "color-mix(in srgb, var(--giq-error) 10%, transparent)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")
                      }
                    >
                      <LogOut className="w-4 h-4" />
                      {tl("sign_out")}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-0 overflow-x-hidden min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-0 pt-2 pb-safe"
        style={{
          backgroundColor: "var(--giq-bg-secondary)",
          borderTop: "1px solid var(--giq-border)",
        }}
      >
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <MobileNavItem key={item.href} item={item} />
          ))}
        </div>
      </nav>

      {/* QA Modal */}
      {qaOpen && qaReport && (
        <QAModal report={qaReport} session={session} onClose={() => setQaOpen(false)} />
      )}
    </div>
  );
}

function ProfileMenuItem({
  icon,
  label,
  href,
  onClick,
  bordered,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick: () => void;
  bordered?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
      style={{
        color: "var(--giq-text-secondary)",
        borderTop: bordered ? "1px solid var(--giq-border)" : undefined,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--giq-text-primary)";
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--giq-border)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--giq-text-secondary)";
        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
      }}
    >
      {icon}
      {label}
    </Link>
  );
}
