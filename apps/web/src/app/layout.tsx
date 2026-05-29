import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brain Memory Studio",
  description: "Static Hermes UI shell with mocked project, session, and memory data."
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
