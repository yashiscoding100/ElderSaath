import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { BillingBlocker } from "@/components/BillingBlocker";
import { MandatoryPermissions } from "@/components/MandatoryPermissions";
import { StartupPopupModal } from "@/components/StartupPopupModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Elder Saath",
  description: "Because distance shouldn't mean less care.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <BillingBlocker />
          <MandatoryPermissions />
          <StartupPopupModal />
          {children}
        </Providers>
      </body>
    </html>
  );
}
