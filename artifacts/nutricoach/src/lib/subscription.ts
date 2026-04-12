import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "inactive"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "none";

export type SubscriptionTier = "none" | "basic" | "pro" | "premium";

export interface StripePlan {
  id: string;
  name: string;
  description: string;
  metadata: { tier?: string; order?: string };
  prices: {
    id: string;
    unit_amount: number;
    currency: string;
    recurring: { interval: string } | null;
  }[];
}

async function apiRequest<T>(
  url: string,
  token?: string | null,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error("NETWORK_ERROR");
  }

  if (!res.ok) {
    // Try to extract a meaningful message from JSON error bodies
    const text = await res.text().catch(() => "");
    try {
      const json = JSON.parse(text);
      const msg = json?.error ?? json?.message ?? json?.detail ?? "";
      throw new Error(msg || `HTTP ${res.status}`);
    } catch (parseErr: any) {
      if (parseErr?.message && !parseErr.message.startsWith("HTTP")) throw parseErr;
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  return res.json();
}

export function checkoutErrorMessage(err: any): string {
  const msg: string = err?.message ?? "";
  if (!msg || msg === "NETWORK_ERROR" || /^HTTP 5/.test(msg)) {
    return "Service temporarily unavailable. Please refresh and try again.";
  }
  if (msg === "HTTP 401" || msg.toLowerCase().includes("unauthorized")) {
    return "Please log in again and retry.";
  }
  if (msg === "HTTP 400" || msg.toLowerCase().includes("priceid required")) {
    return "Invalid plan. Please contact support.";
  }
  return msg || "Something went wrong. Please try again.";
}

export function hasFullAccess(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

export function useSubscription() {
  const { session, isAuthenticated } = useAuth();
  return useQuery<{ status: SubscriptionStatus; hasAccess: boolean; trialEndsAt: number | null; hasUsedTrial: boolean }>({
    queryKey: ["subscription", session?.user?.id],
    queryFn: async () => {
      if (!session?.access_token) return { status: "none" as SubscriptionStatus, hasAccess: false, trialEndsAt: null, hasUsedTrial: false };
      return apiRequest("/api/subscription", session.access_token);
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    placeholderData: { status: "none" as SubscriptionStatus, hasAccess: false, trialEndsAt: null, hasUsedTrial: false },
  });
}

export function useStripePlans() {
  return useQuery<{ plans: StripePlan[] }>({
    queryKey: ["stripe-plans"],
    queryFn: () => apiRequest("/api/plans"),
    staleTime: 10 * 60 * 1000,
    placeholderData: { plans: [] },
  });
}

export function useStartTrial() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error("Not authenticated");
      return apiRequest<{ status: SubscriptionStatus; hasAccess: boolean }>(
        "/api/subscribe",
        session.access_token,
        { method: "POST" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

export function useCreateCheckout() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (priceId: string) => {
      if (!session?.access_token) throw new Error("Not authenticated");
      return apiRequest<{ url: string }>("/api/checkout", session.access_token, {
        method: "POST",
        body: JSON.stringify({ priceId }),
      });
    },
  });
}

export function useCreatePortal() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error("Not authenticated");
      return apiRequest<{ url: string }>("/api/portal", session.access_token, {
        method: "POST",
      });
    },
  });
}

export function tierCanAccess(
  status: SubscriptionStatus | SubscriptionTier,
  _required: SubscriptionTier,
): boolean {
  return hasFullAccess(status as SubscriptionStatus);
}
