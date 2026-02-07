import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import LayoutContent from "@/components/LayoutContent";

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
    <html lang="de" data-theme="dark">
      <body className="min-h-screen flex flex-col bg-[#0f0f0f] text-white">
        <Header />
        <div className="flex flex-1 min-h-0 flex-col w-full">
          <LayoutContent>{children}</LayoutContent>
        </div>
      </body>
    </html>
  );
}
