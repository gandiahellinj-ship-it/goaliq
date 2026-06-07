import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface AuthUser {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function supabaseUserToAuthUser(user: User): AuthUser {
  const meta = user.user_metadata || {};
  const email = user.email || null;
  const displayName = meta.full_name || meta.name || email?.split("@")[0] || null;
  const parts = displayName?.split(" ") || [];
  return {
    id: user.id,
    username: email,
    firstName: meta.first_name || parts[0] || displayName,
    lastName: meta.last_name || (parts.length > 1 ? parts.slice(1).join(" ") : null),
    profileImage: meta.avatar_url || null,
  };
}

let _openLoginModal: (() => void) | null = null;

export function registerLoginModal(fn: () => void) {
  _openLoginModal = fn;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ? supabaseUserToAuthUser(data.session.user) : null);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      const authUser = newSession?.user ? supabaseUserToAuthUser(newSession.user) : null;
      setUser(authUser);
      setIsLoading(false);

      if (authUser && typeof window !== "undefined" && (window as any).OneSignal) {
        const OS = (window as any).OneSignal;
        try {
          await OS.login(authUser.id);
          const permission = await OS.Notifications.permission;
          if (!permission) {
            await OS.Notifications.requestPermission();
          }
        } catch (e) {
          console.warn("OneSignal setup failed:", e);
        }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = useCallback(() => {
    _openLoginModal?.();
  }, []);

  const logout = useCallback(async () => {
    if (typeof window !== "undefined" && (window as any).OneSignal) {
      try {
        await (window as any).OneSignal.logout();
      } catch (e) {
        // silent — don't block sign-out
      }
    }
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
