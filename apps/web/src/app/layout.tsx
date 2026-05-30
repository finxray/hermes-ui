import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brain Memory Studio",
  description: "Local Hermes UI and Brain Memory Studio with project-scoped chat and read-only memory inspection."
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
