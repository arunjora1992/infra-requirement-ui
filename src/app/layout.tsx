import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Infra Requirements",
  description: "Raise, track and manage infrastructure requirements across teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <ThemeProvider>
            <div className="bg-stage min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
                {children}
              </main>
              <footer className="border-t border-border/60 text-xs text-muted py-4 text-center">
                Infra Requirements · {new Date().getFullYear()}
              </footer>
            </div>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
