import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { registerLoginModal } from "@/hooks/useAuth";

type Mode = "login" | "signup";

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid email or password"))
    return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed"))
    return "Por favor confirma tu correo electrónico antes de iniciar sesión.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este email ya está registrado. Intenta iniciar sesión.";
  if (m.includes("password should be at least"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("unable to validate email address"))
    return "El formato del email no es válido.";
  if (m.includes("signup is disabled"))
    return "El registro está desactivado temporalmente.";
  if (m.includes("too many requests") || m.includes("rate limit"))
    return "Demasiados intentos. Inténtalo de nuevo en unos minutos.";
  if (m.includes("network") || m.includes("fetch"))
    return "Error de conexión. Comprueba tu internet e inténtalo de nuevo.";
  return "Algo salió mal. Inténtalo de nuevo.";
}

export function AuthModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Beta code + RGPD consent (signup only)
  const [betaCode, setBetaCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [codeError, setCodeError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    registerLoginModal(() => {
      setOpen(true);
      setMode("login");
      setError(null);
      setSuccess(null);
    });
  }, []);

  // Debounced beta code validation (signup only). Public endpoint, no auth.
  useEffect(() => {
    if (mode !== "signup") return;
    const trimmed = betaCode.trim();
    if (trimmed.length < 5) {
      setCodeStatus("idle");
      setCodeError("");
      return;
    }
    setCodeStatus("checking");
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch("/api/beta/validate-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: trimmed.toUpperCase() }),
        });
        const data = await res.json();
        if (data.valid) {
          setCodeStatus("valid");
          setCodeError("");
        } else {
          setCodeStatus("invalid");
          setCodeError(data.reason || "Código no válido");
        }
      } catch {
        setCodeStatus("invalid");
        setCodeError("Error al verificar código");
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [betaCode, mode]);

  const reset = () => {
    setEmail("");
    setPassword("");
    setFirstName("");
    setError(null);
    setSuccess(null);
    setLoading(false);
    setBetaCode("");
    setCodeStatus("idle");
    setCodeError("");
    setAcceptedTerms(false);
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "signup") {
      // Pre-validation: beta code + RGPD consent are required
      if (codeStatus !== "valid") {
        setError("Necesitas un código de invitación válido");
        setLoading(false);
        return;
      }
      if (!acceptedTerms) {
        setError("Debes aceptar los términos y la política de privacidad");
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, full_name: firstName },
        },
      });
      if (err) {
        setError(translateAuthError(err.message));
      } else {
        // Email confirmation disabled in Supabase → session is present in `data.session`.
        const token = data?.session?.access_token;
        if (token) {
          const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          };
          const codeUpper = betaCode.trim().toUpperCase();
          // Fire all 3 calls in parallel; failures are non-fatal (logged).
          await Promise.all([
            fetch("/api/beta/claim-code", {
              method: "POST",
              headers,
              body: JSON.stringify({ code: codeUpper }),
            }).catch((e) => console.error("Failed to claim beta code:", e)),
            fetch("/api/consent", {
              method: "POST",
              headers,
              body: JSON.stringify({ type: "terms_of_use", accepted: true }),
            }).catch((e) => console.error("Failed to register terms consent:", e)),
            fetch("/api/consent", {
              method: "POST",
              headers,
              body: JSON.stringify({ type: "privacy_policy", accepted: true }),
            }).catch((e) => console.error("Failed to register privacy consent:", e)),
          ]);
        } else {
          console.error("No session after signup — claim-code and consent skipped");
        }
        setSuccess("¡Cuenta creada! Bienvenido a GoalIQ.");
        // Landing auto-redirects to /dashboard when isAuthenticated becomes true.
        handleClose();
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(translateAuthError(err.message));
      } else {
        handleClose();
      }
    }

    setLoading(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[#1A1A1A] rounded-xl shadow-2xl z-50 p-7 border border-[#2A2A2A]"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="font-display font-black italic text-2xl leading-none block mb-2">
                  <span className="text-white">Goal</span><span className="text-[#AAFF45]">IQ</span>
                </span>
                <h2 className="text-xl font-bold text-white">
                  {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
                </h2>
                <p className="text-sm text-[#555555] mt-0.5">
                  {mode === "login" ? "Inicia sesión para continuar" : "Empieza tu prueba gratis hoy"}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-[#2A2A2A] transition-colors text-[#555555] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-[#0A0A0A] p-1 rounded-lg mb-6 border border-[#2A2A2A]">
              {(["login", "signup"] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                    mode === m
                      ? "bg-[#2A2A2A] text-white"
                      : "text-[#555555] hover:text-[#A0A0A0]"
                  }`}
                >
                  {m === "login" ? "Iniciar sesión" : "Registrarse"}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="text-sm font-semibold text-[#A0A0A0] block mb-1.5">Nombre</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Tu nombre"
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-[#A0A0A0] block mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[#A0A0A0] block mb-1.5">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-[#A0A0A0]"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-[#A0A0A0] block mb-1.5">Código de invitación</label>
                    <input
                      type="text"
                      required
                      value={betaCode}
                      onChange={e => setBetaCode(e.target.value.toUpperCase())}
                      placeholder="GOALIQ-BETA-XXX"
                      className={`${inputClass} ${
                        codeStatus === "valid"
                          ? "border-[#AAFF45] focus:border-[#AAFF45]"
                          : codeStatus === "invalid"
                            ? "border-[#FF4444] focus:border-[#FF4444]"
                            : ""
                      }`}
                    />
                    {codeStatus === "checking" && (
                      <p className="text-xs text-[#A0A0A0] mt-1">Verificando código…</p>
                    )}
                    {codeStatus === "valid" && (
                      <p className="text-xs text-[#AAFF45] mt-1">✓ Código válido</p>
                    )}
                    {codeStatus === "invalid" && codeError && (
                      <p className="text-xs text-[#FF4444] mt-1">{codeError}</p>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="accept-terms"
                      required
                      checked={acceptedTerms}
                      onChange={e => setAcceptedTerms(e.target.checked)}
                      className="mt-1 accent-[#AAFF45]"
                    />
                    <label htmlFor="accept-terms" className="text-xs text-[#A0A0A0]">
                      Acepto los{" "}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#AAFF45] hover:underline">
                        Términos de Uso
                      </a>{" "}
                      y la{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#AAFF45] hover:underline">
                        Política de Privacidad
                      </a>
                      , incluyendo el tratamiento de mis datos personales conforme al RGPD.
                    </label>
                  </div>
                </>
              )}

              {error && (
                <div className="text-sm text-[#FF4444] bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-sm text-[#AAFF45] bg-[#AAFF45]/10 border border-[#AAFF45]/20 rounded-lg px-4 py-3">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-lg font-bold bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            </form>

            <p className="text-center text-xs text-[#555555] mt-4">
              {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                className="text-[#AAFF45] font-semibold hover:underline"
              >
                {mode === "login" ? "Regístrate gratis" : "Inicia sesión"}
              </button>
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder:text-[#555555] focus:border-[#AAFF45] focus:outline-none transition-all text-sm";
