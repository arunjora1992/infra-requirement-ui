import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "./auth";

export async function currentUser(): Promise<SessionUser | null> {
  const s = await getServerSession(authOptions);
  if (!s?.user?.email) return null;
  return s.user as SessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Not authenticated");
  return u;
}

export async function requireRole(roles: SessionUser["role"][]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new HttpError(403, "Forbidden");
  return u;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
