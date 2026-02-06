import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "shimwrappercheck Dashboard",
  description: "Config & AGENTS.md für shimwrappercheck",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" data-theme="light">
      <body className="min-h-screen bg-base-200">
        <Nav />
        <main className="container mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
