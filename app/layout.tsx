import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/lib/hooks/useSettings";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { Onboarding } from "@/components/onboarding";
import { PwaRegister } from "@/components/pwa-register";
import { MobileNav } from "@/components/mobile-nav";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Editorial display serif — used for big headings and the hero practice word.
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Clara — English pronunciation course",
  description: "Warm, interactive pronunciation coaching for Spanish speakers — listen, speak, and level up.",
  applicationName: "Clara",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Clara" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // The app intentionally mixes Spanish coaching with English practice targets.
  // Browser auto-translate would rewrite the very words she's learning to say,
  // so it's disabled outright. The legacy Apple tag guarantees a fullscreen
  // home-screen launch on older iOS (Next emits only the modern equivalent).
  other: { google: "notranslate", "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#123a93" },
    { media: "(prefers-color-scheme: dark)", color: "#17181d" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // stop iOS zooming/jumping when she taps the mic
  viewportFit: "cover",
};

// Applies .dark before first paint (no flash) and tracks the system setting
// live. The design tokens for dark already exist in globals.css.
const THEME_SCRIPT = `(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){document.documentElement.classList.toggle('dark',m.matches)}a();m.addEventListener('change',a)})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the theme script may add .dark before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <SettingsProvider>
          <PwaRegister />
          <Onboarding />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <MobileNav />
          <Toaster position="top-center" richColors />
        </SettingsProvider>
      </body>
    </html>
  );
}
