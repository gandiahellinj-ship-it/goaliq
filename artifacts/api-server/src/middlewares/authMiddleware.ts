import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { verifySupabaseToken } from "../lib/supabase";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
      supabaseToken?: string;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  req.supabaseToken = token;
  try {
    const supabaseUser = await verifySupabaseToken(token);
    if (supabaseUser) {
      req.user = {
        id: supabaseUser.id,
        username: supabaseUser.email || supabaseUser.id,
        firstName:
          supabaseUser.user_metadata?.first_name ||
          supabaseUser.user_metadata?.full_name?.split(" ")[0] ||
          null,
        lastName: supabaseUser.user_metadata?.last_name || null,
        profileImage: supabaseUser.user_metadata?.avatar_url || null,
      };
    }
  } catch {
    // Invalid token — proceed as unauthenticated
  }

  next();
}
