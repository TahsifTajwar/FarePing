import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

type SupabaseUserResponse = {
  id?: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
  };
};

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string | null;
  };
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({
      message: "Sign in to manage saved flight alerts."
    });
    return;
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    res.status(500).json({
      message: "Supabase Auth is not configured on the backend."
    });
    return;
  }

  try {
    const supabaseUser = await getSupabaseUser(token);

    if (!supabaseUser.id) {
      res.status(401).json({
        message: "Your sign-in session is invalid. Please sign in again."
      });
      return;
    }

    const email = supabaseUser.email ?? null;
    const name = supabaseUser.user_metadata?.name ?? supabaseUser.user_metadata?.full_name ?? null;

    await prisma.user.upsert({
      where: {
        id: supabaseUser.id
      },
      update: {
        email,
        name
      },
      create: {
        id: supabaseUser.id,
        email,
        name
      }
    });

    (req as AuthenticatedRequest).user = {
      id: supabaseUser.id,
      email
    };

    next();
  } catch {
    res.status(401).json({
      message: "Your sign-in session could not be verified. Please sign in again."
    });
  }
}

function getBearerToken(req: Request) {
  const authorizationHeader = req.header("authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

async function getSupabaseUser(token: string) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Supabase user lookup failed.");
  }

  return (await response.json()) as SupabaseUserResponse;
}
