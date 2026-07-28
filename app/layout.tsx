import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/lib/hooks/useSettings";
import { AuthProvider } from "@/lib/hooks/useAuth";
import { AccessProvider } from "@/lib/hooks/useAccess";
import { AuthGate } from "@/components/auth-gate";
import { DataScope } from "@/components/data-scope";
import { VoiceConsentSheet } from "@/components/voice-consent-sheet";
import { ProfileBinder } from "@/components/profile-binder";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { PwaRegister } from "@/components/pwa-register";
import { MobileNav } from "@/components/mobile-nav";
import { JuiceLayer } from "@/components/juice";
import { CinematicLayer } from "@/components/cinematic";

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
  title: "Clara — American English, for real conversations",
  description: "Warm, gamified American-English coaching for Colombian Spanish speakers — listen, speak, converse, and level up.",
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
  themeColor: "#123a93",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // stop iOS zooming/jumping when she taps the mic
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Always the light editorial canvas — the game's warmth reads best on white,
    // so the OS dark preference is intentionally ignored.
    /* Default to Spanish: the coaching UI is Spanish, so a screen reader
       announces it correctly and Chrome won't offer to (mis)translate the page
       for a Spanish speaker. The client syncs this to the coach language (see
       useSettings) for English-coaching users. */
    <html lang="es" className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AccessProvider>
          <PwaRegister />
          <AuthGate>
            {/* DataScope binds IndexedDB to the signed-in account before any
                provider or page can read it, and re-mounts everything below on
                account switch — SettingsProvider must live inside it. */}
            <DataScope>
              <SettingsProvider>
                <ProfileBinder />
                <OnboardingFlow />
                <SiteHeader />
                <main className="flex-1">{children}</main>
                <MobileNav />
                <JuiceLayer />
                <CinematicLayer />
                <VoiceConsentSheet />
              </SettingsProvider>
            </DataScope>
          </AuthGate>
          <Toaster position="top-center" richColors />
          </AccessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
