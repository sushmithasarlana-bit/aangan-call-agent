import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aangan call agent",
  description: "Every call answered, qualified and handed to a designer. No price quoted.",
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
