import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | DataBridges",
    default: "DataBridges — AI Consulting for Irish Businesses",
  },
  description:
    "DataBridges helps Irish businesses adopt AI and automation without the hype. Practical AI consulting, Power Platform, SharePoint, and training from Kilcock, Co. Kildare.",
  keywords: [
    "AI consulting Ireland",
    "Power Platform",
    "SharePoint automation",
    "AI training",
    "Kildare",
    "business automation",
    "Microsoft 365",
  ],
  authors: [{ name: "Oisín — DataBridges" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "DataBridges",
    title: "DataBridges — AI Consulting for Irish Businesses",
    description:
      "Practical AI adoption, Power Platform, SharePoint automation, and training for Irish businesses. Based in Kilcock, Co. Kildare.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IE">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
