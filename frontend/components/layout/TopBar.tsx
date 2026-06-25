"use client";
import Link from "next/link";

interface TopBarProps {
  title: string;
  icon?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, icon = "insights", actions }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="material-symbols-outlined" style={{ color: "var(--secondary)", fontSize: 20 }}>
          {icon}
        </span>
        <h1>{title}</h1>
      </div>

      {/* Search */}
      <div className="topbar-search">
        <span className="material-symbols-outlined search-icon">search</span>
        <input type="text" placeholder="Search insights..." />
      </div>

      {/* Actions */}
      <div className="topbar-actions">
        {actions}
        <button className="icon-btn" title="Notifications">
          <span className="material-symbols-outlined">notifications</span>
          <span className="badge-dot" />
        </button>
        <Link href="/settings" className="icon-btn" title="Integrations">
          <span className="material-symbols-outlined">hub</span>
        </Link>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--secondary)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
            border: "1px solid var(--outline-variant)",
          }}
          title="Profile"
        >
          U
        </div>
      </div>
    </header>
  );
}
