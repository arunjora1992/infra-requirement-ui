"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogOut, LogIn, Plus, Server, Download, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const { data: session, status } = useSession();
  const user = session?.user as
    | { email: string; name?: string | null; role: string; image?: string | null }
    | undefined;
  const isInfra = user?.role === "INFRA" || user?.role === "ADMIN";
  const isAdmin = user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-bg/70 border-b border-border/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-gradient shadow-glow-sm grid place-items-center">
            <Server size={16} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[11px] tracking-[0.25em] uppercase text-muted">Infra</div>
            <div className="font-semibold brand-mark">Requirements</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          <Link href="/dashboard" className="btn btn-ghost">Dashboard</Link>
          <Link href="/requirements/new" className="btn btn-ghost">
            <Plus size={14} /> New
          </Link>
          {isInfra && (
            <a href="/api/requirements/export?new=true" className="btn btn-ghost">
              <Download size={14} /> Export
            </a>
          )}
          {isAdmin && (
            <Link href="/admin" className="btn btn-ghost">
              <ShieldCheck size={14} /> Admin
            </Link>
          )}
        </nav>

        <div className="flex-1" />

        <ThemeToggle />

        {status === "loading" ? null : user ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{user.name ?? user.email}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted">{user.role}</div>
            </div>
            {user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="w-8 h-8 rounded-full ring-1 ring-border" />
            )}
            <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => signIn("google")}>
            <LogIn size={14} /> Sign in
          </button>
        )}
      </div>
    </header>
  );
}
