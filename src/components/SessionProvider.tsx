"use client";

import { SessionProvider as NA } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProvider({ children }: { children: ReactNode }) {
  return <NA>{children}</NA>;
}
