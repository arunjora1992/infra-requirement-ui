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
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (!domainAllowed(user.email)) return false;
      // Bootstrap role on first sign-in
      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            role: roleForEmail(user.email),
          },
        });
      } else {
        // Allow env-driven elevation when admin/infra/manager lists change
        const desired = roleForEmail(user.email);
        if (desired !== "USER" && existing.role !== desired && existing.role !== "ADMIN") {
          await prisma.user.update({ where: { id: existing.id }, data: { role: desired } });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      if (token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.team = dbUser.team ?? undefined;
        }
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
