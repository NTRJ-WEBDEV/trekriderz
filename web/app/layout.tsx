import "@/app/globals.css";
import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import { Providers } from "./providers";
import WebsiteShell from "@/components/WebsiteShell";
import { getSiteSettings } from "@/lib/site-settings";

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
  title: "TrekRiderz — Trek. Travel. Connect.",
  description:
    "India's premier trekking & tour company. Western Ghats treks, international tours to Nepal, Bhutan, Philippines, Indonesia, Cambodia. Custom group travel packages.",
  keywords:
    "trekking India, Western Ghats trek, Nepal trek, Bhutan tour, Philippines tour, group travel, adventure travel India",
  openGraph: {
    title: "TrekRiderz — Trek. Travel. Connect.",
    description: "Western Ghats & international adventures curated for you.",
    url: "https://trekriderz.com",
    siteName: "TrekRiderz",
    type: "website",
  },
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
        <Providers>
          <WebsiteShell siteSettings={siteSettings}>{children}</WebsiteShell>
        </Providers>
      </body>
    </html>
  );
}
