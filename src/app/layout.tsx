import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

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
  icons: {
    icon: "/images/favicon.png",
  },
  title: "DataBridges | Making AI Useful for Irish Business",
  description:
    "AI consulting, Power Platform development and workshops for Irish SMEs and public sector teams. Based in Kilcock, Co. Kildare.",
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    title: "DataBridges | Making AI Useful for Irish Business",
    description:
      "AI consulting, Power Platform development and workshops for Irish SMEs and public sector teams. Based in Kilcock, Co. Kildare.",
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
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Nav />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
