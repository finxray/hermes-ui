import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stoix",
  description: "Local Hermes Agent workspace with project-scoped chat, plugins, skills, configuration, keys, and logs.",
  icons: {
    icon: [
      {
        media: "(prefers-color-scheme: light)",
        type: "image/png",
        url: "/assets/stoix-helmet-black.png"
      },
      {
        media: "(prefers-color-scheme: dark)",
        type: "image/png",
        url: "/assets/stoix-helmet-white.png"
      }
    ]
  }
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
