import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Iron Forge | Cutelaria Premium",
  description:
    "Iron Forge Cutelaria — As melhores facas táticas e de coleção. Benchmade, Spyderco, Tactical Nine e muito mais.",
  keywords: ["cutelaria", "facas", "knives", "tactical", "Iron Forge", "benchmade", "spyderco"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn("h-full", "antialiased", inter.variable, "font-sans", geist.variable)}>
      <body className="min-h-full bg-black font-sans text-white">
        {children}
      </body>
    </html>
  );
}
