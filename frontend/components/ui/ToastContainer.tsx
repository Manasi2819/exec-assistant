"use client";
import { Toast, ToastType } from "@/hooks/useToast";

const ICON_MAP: Record<ToastType, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
  warning: "warning",
};

const COLOR_MAP: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: "#e6f4ea", border: "#c3e6cb", icon: "#137333", text: "#0a4a1f" },
  error:   { bg: "#fce8e6", border: "#f5c6c2", icon: "#ba1a1a", text: "#5c0a0a" },
  info:    { bg: "var(--primary-fixed)", border: "rgba(52,89,165,0.2)", icon: "var(--primary)", text: "var(--on-surface)" },
  warning: { bg: "#fff8e1", border: "#ffe082", icon: "#f57f17", text: "#5c3c00" },
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!toasts.length) return null;

  return createPortal(
    <div id="toast-container-root" style={{
      position: "fixed", top: 80, right: 20, zIndex: 99999,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const c = COLOR_MAP[t.type];
        return (
          <div
            key={t.id}
            style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 8, padding: "12px 14px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 280, maxWidth: 380,
              pointerEvents: "auto",
              animation: "toastIn 0.25s ease forwards",
            }}
          >
            <span className="material-symbols-outlined fill-icon" style={{ fontSize: 18, color: c.icon, flexShrink: 0, marginTop: 1 }}>
              {ICON_MAP[t.type]}
            </span>
            <span style={{ fontSize: 13, color: c.text, lineHeight: 1.5, flex: 1 }}>{t.message}</span>
            <button
              onClick={() => onRemove(t.id)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: c.icon, flexShrink: 0 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
