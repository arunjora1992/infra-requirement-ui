import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./db";
import type { Role } from "@prisma/client";

function listFromEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function roleForEmail(email: string): Role {
  const e = email.toLowerCase();
  if (listFromEnv("ADMIN_EMAILS").includes(e)) return "ADMIN";
  if (listFromEnv("INFRA_EMAILS").includes(e)) return "INFRA";
  if (listFromEnv("MANAGER_EMAILS").includes(e)) return "MANAGER";
  return "USER";
}

function domainAllowed(email: string): boolean {
  const allowed = listFromEnv("ALLOWED_EMAIL_DOMAINS");
  if (allowed.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && allowed.includes(domain);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { prompt: "select_account" } },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (!domainAllowed(user.email)) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      if (!token.email) return token;

      // The PrismaAdapter creates the User row on first sign-in; we just enrich the JWT
      // and apply env-driven role elevation here (after the row exists).
      const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
      if (dbUser) {
        const desired = roleForEmail(dbUser.email);
        if (desired !== "USER" && dbUser.role !== desired && dbUser.role !== "ADMIN") {
          const updated = await prisma.user.update({
            where: { id: dbUser.id },
            data: { role: desired },
          });
          token.role = updated.role;
          token.team = updated.team ?? undefined;
        } else {
          token.role = dbUser.role;
          token.team = dbUser.team ?? undefined;
        }
        token.uid = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role ?? "USER";
        (session.user as any).team = token.team;
      }
      return session;
    },
  },
};

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
  team?: string | null;
};
