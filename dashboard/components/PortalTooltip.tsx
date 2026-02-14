/**
 * Tooltip that renders content in a portal (document.body) so it is not clipped
 * by overflow-hidden or overflow-y-auto on ancestors. Used for long setting
 * descriptions (e.g. AI Review) in CheckCard.
 * Location: dashboard/components/PortalTooltip.tsx
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const style = getComputedStyle(el);
  const overflowY = style.overflowY;
  if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return el;
  return getScrollParent(el.parentElement);
}

export default function PortalTooltip({
  content,
  children,
  placement = "right",
}: {
  content: string;
  children: React.ReactNode;
  placement?: "right" | "left" | "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    if (!open || !triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 8;
    const maxW = 320;
    switch (placement) {
      case "right":
        return { left: rect.right + gap, top: rect.top, maxWidth: maxW };
      case "left":
        return { right: window.innerWidth - rect.left + gap, top: rect.top, maxWidth: maxW };
      case "top":
        return { left: rect.left, bottom: window.innerHeight - rect.top + gap, maxWidth: maxW };
      case "bottom":
        return { left: rect.left, top: rect.bottom + gap, maxWidth: maxW };
      default:
        return { left: rect.right + gap, top: rect.top, maxWidth: maxW };
    }
  }, [open, placement]);

  const [position, setPosition] = useState<ReturnType<typeof updatePosition>>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    setPosition(updatePosition());
    const scrollParent = getScrollParent(triggerRef.current);
    const close = () => setOpen(false);
    scrollParent?.addEventListener("scroll", close, { passive: true });
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      scrollParent?.removeEventListener("scroll", close);
      window.removeEventListener("scroll", close);
    };
  }, [open, updatePosition]);

  const tooltipEl =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed z-[9999] rounded-lg border border-white/20 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 shadow-xl whitespace-normal"
            style={{
              ...(position.left != null && { left: position.left }),
              ...(position.top != null && { top: position.top }),
              ...(position.right != null && { right: position.right }),
              ...(position.bottom != null && { bottom: position.bottom }),
              maxWidth: position.maxWidth ?? 320,
            }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body
        )
      : null;

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {tooltipEl}
    </span>
  );
}
