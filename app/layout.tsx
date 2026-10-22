import type { Metadata } from "next";
import "./globals.css";
import "../src/ui/wow/theme.css";

export const metadata: Metadata = {
  title: "WoW Forever Idle · Komponentenwerkbank",
  description: "Interne Komponentenwerkbank für die deutsche WoW Forever Idle Oberfläche. Native klassische UI-Bauteile; noch kein spielbares Spiel.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
