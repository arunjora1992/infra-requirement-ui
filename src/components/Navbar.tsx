"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogOut, LogIn, Plus, Download, ShieldCheck, LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        "hover:text-fg hover:bg-surface-2/70",
        active ? "text-fg bg-surface-2/70" : "text-muted",
      )}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const user = session?.user as
    | { email: string; name?: string | null; role: string; image?: string | null }
    | undefined;
  const isInfra = user?.role === "INFRA" || user?.role === "ADMIN";
  const isAdmin = user?.role === "ADMIN";
  const onDash = pathname === "/dashboard";
  const onNew = pathname?.startsWith("/requirements/new");
  const onAdmin = pathname?.startsWith("/admin");

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-bg/65 border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo size={32} className="transition-transform group-hover:scale-105" />
          <div className="leading-tight">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted">
              Infra
            </div>
            <div className="font-semibold text-[15px] brand-mark">
              Requirements
            </div>
          </div>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-1 ml-3 pl-3 border-l border-border/60">
            <NavLink href="/dashboard" active={!!onDash}>
              <span className="inline-flex items-center gap-1.5">
                <LayoutDashboard size={14} /> Dashboard
              </span>
            </NavLink>
            <NavLink href="/requirements/new" active={!!onNew}>
              <span className="inline-flex items-center gap-1.5">
                <Plus size={14} /> New
              </span>
            </NavLink>
            {isInfra && (
              <a
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted hover:text-fg hover:bg-surface-2/70 transition-colors"
                href="/api/requirements/export?new=true"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Download size={14} /> Export
                </span>
              </a>
            )}
            {isAdmin && (
              <NavLink href="/admin" active={!!onAdmin}>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Admin
                </span>
              </NavLink>
            )}
          </nav>
        )}

        <div className="flex-1" />

        <ThemeToggle />

        {status === "loading" ? null : user ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-sm font-medium">{user.name ?? user.email}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
                {user.role}
              </div>
            </div>
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="w-8 h-8 rounded-full ring-1 ring-border/80"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent-gradient grid place-items-center text-white text-xs font-semibold">
                {(user.name ?? user.email)[0]?.toUpperCase()}
              </div>
            )}
            <button
              className="btn btn-ghost"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
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
