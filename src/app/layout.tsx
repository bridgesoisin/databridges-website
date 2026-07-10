import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import OtterGuide from "@/components/OtterGuide";
import ScrollDriver from "@/components/ScrollDriver";
import LoopPauser from "@/components/LoopPauser";
import CursorTracer from "@/components/CursorTracer";
import { graph, websiteLd, organizationLd, personLd } from "@/lib/jsonld";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

// Gilroy ExtraBold (the free-for-commercial-use weight), self-hosted.
// Used ONLY for the "databridges" wordmark lockup on the home hero;
// all other headings stay Syne.
const gilroy = localFont({
  src: "../fonts/Gilroy-ExtraBold.woff",
  variable: "--font-gilroy",
  weight: "800",
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
        url: "/images/og-card.jpg",
        width: 1200,
        height: 630,
        alt: "DataBridges, Making AI Useful",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DataBridges | Making AI Useful for Irish Business",
    description:
      "AI consulting, Power Platform development and workshops for Irish SMEs and public sector teams.",
    images: ["/images/og-card.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-scroll-behavior lets Next.js override CSS smooth scrolling with an
    // instant jump when navigating between routes; in-page anchor links stay
    // smooth via the html rule in globals.css.
    <html lang="en-IE" data-scroll-behavior="smooth">
      <body
        className={`${syne.variable} ${gilroy.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
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
        <LoopPauser />
        <CursorTracer />
      </body>
    </html>
  );
}
