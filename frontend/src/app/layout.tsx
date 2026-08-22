import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

// Signal Desktop is set in Inter throughout.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Signal",
  description: "Speak Freely",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Dark is Signal's default; the appearance setting will toggle this class.
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="font-sans text-body1 antialiased">{children}</body>
    </html>
  );
}
