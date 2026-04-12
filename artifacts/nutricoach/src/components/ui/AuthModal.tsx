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

  useEffect(() => {
    registerLoginModal(() => {
      setOpen(true);
      setMode("login");
      setError(null);
      setSuccess(null);
    });
  }, []);

  const reset = () => {
    setEmail("");
    setPassword("");
    setFirstName("");
    setError(null);
    setSuccess(null);
    setLoading(false);
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
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, full_name: firstName },
        },
      });
      if (err) {
        setError(translateAuthError(err.message));
      } else {
        setSuccess("¡Cuenta creada! Revisa tu correo para confirmarla y luego inicia sesión.");
        setMode("login");
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
