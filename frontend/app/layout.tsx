import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarePing",
  description: "Track flexible flights and get SMS alerts when prices drop."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
