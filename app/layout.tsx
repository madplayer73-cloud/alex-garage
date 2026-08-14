import type { Metadata } from "next";
import { Geist, Manrope } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alex Garage | Rodinné misie",
  description: "Rodinné úlohy, odznaky a cesta k červenému Yarisu.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk">
      <body className={`${geist.variable} ${manrope.variable}`}>{children}</body>
    </html>
  );
}
