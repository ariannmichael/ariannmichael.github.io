"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Modal.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  /** id of the element that names the dialog (usually its heading) */
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  /** "side": right panel / bottom sheet that keeps the car visible. "center": menus. "full": game player. */
  placement?: "side" | "center" | "full";
  className?: string;
  /**
   * Playing the quick exit animation: the owner keeps the dialog mounted for a moment after closing.
   * It's inert meanwhile, so focus and clicks can't land in a dialog that is on its way out.
   */
  closing?: boolean;
}

/**
 * Accessible modal dialog: role="dialog" + aria-modal, focus moves in on open and is trapped,
 * Esc and a click on the backdrop close it, and focus returns to the opener on close.
 * Keyboard events are stopped here so a nested modal only closes itself.
 */
export default function Modal({
  labelledBy,
  onClose,
  children,
  placement = "side",
  className,
  closing = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the focus effect on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first control (usually the close button); fall back to the panel itself.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus({ preventScroll: true });
    return () => {
      // Return focus to whatever opened the dialog, if it is still in the page.
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      onCloseRef.current();
      return;
    }
    if (e.key !== "Tab") return;
    e.stopPropagation();
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
    );
    if (items.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === firstEl || active === panel)) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && active === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }

  return (
    <div
      className={styles.backdrop}
      data-placement={placement}
      data-closing={closing || undefined}
      inert={closing || undefined}
      data-testid="modal-backdrop"
      // Only a click on the backdrop itself (not bubbling from the panel) closes.
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`${styles.panel} ${className ?? ""}`}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className={styles.close} onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}
