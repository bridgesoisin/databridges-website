import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import OtterGuide from "@/components/OtterGuide";
import ScrollDriver from "@/components/ScrollDriver";
import CursorTracer from "@/components/CursorTracer";
import { graph, websiteLd, organizationLd, personLd } from "@/lib/jsonld";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://databridges.ie"),
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/images/favicon.png", sizes: "64x64", type: "image/png" },
    ],
    apple: "/images/favicon.png",
  },
  title: {
    default: "DataBridges | Making AI Useful for Irish Business",
    template: "%s | DataBridges",
  },
  description:
    "AI consulting, Power Platform development and workshops for Irish SMEs and public sector teams. Based in Kilcock, Co. Kildare.",
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    url: "https://databridges.ie",
    title: "DataBridges | Making AI Useful for Irish Business",
    description:
      "AI consulting, Power Platform development and workshops for Irish SMEs and public sector teams. Based in Kilcock, Co. Kildare.",
    images: [
      {
        url: "/images/logo-wordmark.png",
        width: 1200,
        height: 630,
        alt: "DataBridges",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DataBridges | Making AI Useful for Irish Business",
    description:
      "AI consulting, Power Platform development and workshops for Irish SMEs and public sector teams.",
    images: ["/images/logo-wordmark.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IE">
      <body
        className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              graph(websiteLd, organizationLd, personLd)
            ),
          }}
        />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Nav />
        <main id="main-content">{children}</main>
        <Footer />
        <OtterGuide />
        <ScrollDriver />
        <CursorTracer />
      </body>
    </html>
  );
}
