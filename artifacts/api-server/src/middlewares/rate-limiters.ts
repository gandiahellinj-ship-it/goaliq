import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

// Helper: key por userId si está autenticado, fallback a IP (con soporte IPv6 correcto)
const userOrIp = (req: Request): string => {
  const userId = (req as any).user?.id;
  if (userId) return `user:${userId}`;
  return `ip:${ipKeyGenerator(req.ip || "anonymous")}`;
};

// 🔴 IA Limiter — endpoints que llaman a Claude (caros)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 requests/hora por usuario
  keyGenerator: userOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit_exceeded",
    message: "Too many AI generation requests. Please try again later.",
    retryAfter: 3600,
  },
});

// 🔴 IA Burst Limiter — protección adicional contra ráfagas
export const aiBurstLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 3, // 3 requests/min por usuario
  keyGenerator: userOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit_exceeded",
    message: "Too many requests in short time. Please slow down.",
    retryAfter: 60,
  },
});

// 🟡 External API Limiter — endpoints públicos a APIs externas (wger, gifs)
export const externalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requests/min por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit_exceeded",
    message: "Too many requests. Please try again in a minute.",
    retryAfter: 60,
  },
});

// 🟡 Stripe Limiter — endpoints que llaman a Stripe (medios)
export const stripeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: userOrIp,
  standardHeaders: true,
  legacyHeaders: false,
});

// 🟡 Stripe Debug Limiter — /stripe/debug es más caro (loops)
export const stripeDebugLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: userOrIp,
  standardHeaders: true,
  legacyHeaders: false,
});

// 🟢 Normal Limiter — CRUD autenticado normal
export const normalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // generoso para UX legítima
  keyGenerator: userOrIp,
  standardHeaders: true,
  legacyHeaders: false,
});

// ⚪ Public Limiter — health checks y endpoints públicos baratos
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔴 Admin Limiter — endpoints admin (force-sync)
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
});
