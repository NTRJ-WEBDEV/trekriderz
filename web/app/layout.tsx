import "@/app/globals.css";
import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import { Providers } from "./providers";
import WebsiteShell from "@/components/WebsiteShell";
import JsonLd from "@/components/JsonLd";
import Analytics from "@/components/Analytics";
import { getSiteSettings } from "@/lib/site-settings";
import { organizationSchema, SITE_URL } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TrekRiderz — Trek. Travel. Connect.",
  description:
    "India's premier trekking & tour company. Western Ghats treks, international tours to Nepal, Bhutan, Philippines, Indonesia, Cambodia. Custom group travel packages.",
  keywords:
    "trekking India, Western Ghats trek, Nepal trek, Bhutan tour, Philippines tour, group travel, adventure travel India",
  openGraph: {
    title: "TrekRiderz — Trek. Travel. Connect.",
    description: "Western Ghats & international adventures curated for you.",
    url: SITE_URL,
    siteName: "TrekRiderz",
    type: "website",
  },
  verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } : undefined,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteSettings = await getSiteSettings();

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${bebasNeue.variable} font-sans bg-dark-900 text-white overflow-x-hidden`}
      >
        <JsonLd data={organizationSchema()} />
        <Analytics />
        <Providers>
          <WebsiteShell siteSettings={siteSettings}>{children}</WebsiteShell>
        </Providers>
      </body>
    </html>
  );
}
