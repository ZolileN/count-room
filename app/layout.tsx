import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { APP_DESCRIPTION, APP_NAME, SOURCE_LINE, siteUrl } from "@/lib/config";
import { partyColourCss } from "@/lib/parties";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Nav } from "@/components/Nav";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${APP_NAME}: 2026 local election results`, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: { title: `${APP_NAME}: live 2026 local election results`, description: APP_DESCRIPTION, type: "website", siteName: APP_NAME, locale: "en_ZA" },
  twitter: { card: "summary_large_image", title: `${APP_NAME}: live 2026 local election results`, description: APP_DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#101214" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: partyColourCss() }} />
      </head>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-3">
            <Link href="/" className="display text-xl font-bold tracking-tight">
              {APP_NAME}
            </Link>
            <span className="text-xs text-ink-3">2026 local elections</span>
            <div className="ml-auto">
              <AutoRefresh />
            </div>
          </div>
          <Nav />
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 pb-16 pt-5">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-sm text-ink-2">
            <p className="font-medium text-ink">{SOURCE_LINE}</p>
            <p>
              {APP_NAME} is a non-commercial, politically neutral public-interest tool. It does not endorse any party or
              candidate. Projections and coalition figures are arithmetic on the provisional count, not forecasts of who
              will govern. <Link href="/method" className="underline">How the numbers work</Link>.
            </p>
            <p className="text-xs text-ink-3">{APP_NAME} · Not affiliated with the IEC.</p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
