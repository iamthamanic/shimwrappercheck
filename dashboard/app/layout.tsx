import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "shimwrappercheck Dashboard",
  description: "Config & AGENTS.md for shimwrappercheck",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-[#0f0f0f] text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
