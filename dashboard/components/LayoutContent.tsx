/**
 * Client wrapper: zeigt Sidebar nur auf /, auf /settings nur Main (volle Breite).
 * Location: /components/LayoutContent.tsx
 */
"use client";

import { usePathname } from "@/i18n/navigation";
import SidebarMyShim from "./SidebarMyShim";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = pathname !== "/settings";

  return (
    <div className="flex flex-1 min-h-0 w-full relative">
      {showSidebar && (
        <aside className="flex-1 min-h-0 border-r border-white/20 flex flex-col overflow-hidden min-w-0 relative z-0">
          <SidebarMyShim />
        </aside>
      )}
      <main className="flex flex-col flex-1 min-h-0 min-w-0 relative z-0 bg-[#0f0f0f] p-6 overflow-auto">
        <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
      </main>
    </div>
  );
}
