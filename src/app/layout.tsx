import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/Navbar";

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Infra Requirements",
    template: "%s · Infra Requirements",
  },
  description:
    "Raise, track and manage infrastructure requirements across teams — VMs, Kubernetes namespaces, BoQ, tenure and expiry alerts.",
  applicationName: "Infra Requirements",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7ff" },
    { media: "(prefers-color-scheme: dark)", color: "#060916" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
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
