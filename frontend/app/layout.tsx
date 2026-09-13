import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chord",
  description: "Flexible flight search and intelligent fare alerts."
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
