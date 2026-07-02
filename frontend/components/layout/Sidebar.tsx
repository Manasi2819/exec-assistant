"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/inbox", label: "Inbox", icon: "inbox", badge: 4 },
  { href: "/calendar", label: "Calendar", icon: "calendar_today" },
  { href: "/meetings/m1/brief", label: "Meeting Brief", icon: "description" },
  { href: "/mom", label: "Minutes of Meeting", icon: "summarize", badge: 1 },
  { href: "/tasks", label: "Action Items", icon: "assignment", badge: 7 },
  { href: "/notifications", label: "Notifications", icon: "notifications", badge: 2 },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const FOOTER_ITEMS = [
  { href: "/settings", label: "Help", icon: "help" },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <nav className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo-mark">
          <span className="material-symbols-outlined fill-icon" style={{ color: "#fff", fontSize: 20 }}>
            bolt
          </span>
        </div>
        <div>
          <div className="sidebar-brand-name">ExecuPilot AI</div>
          <div className="sidebar-brand-sub">Enterprise Suite</div>
        </div>
      </div>


      {/* Navigation */}
      <div className="sidebar-nav">
        <div className="sidebar-nav-label">Workspace</div>
        {NAV_ITEMS.map(({ href, label, icon, badge }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <span className={`material-symbols-outlined ${active ? "fill-icon" : ""}`} style={{ fontSize: 20 }}>
                {icon}
              </span>
              <span style={{ flex: 1, fontSize: 14 }}>{label}</span>
              {badge && (
                <span className="nav-badge">{badge}</span>
              )}
            </Link>
          );
        })}
      </div>


      {/* Footer */}
      <div className="sidebar-footer">
        <Link href="/settings" className="nav-item">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>help</span>
          <span style={{ fontSize: 14 }}>Help</span>
        </Link>
        <Link href="/" className="nav-item">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
          <span style={{ fontSize: 14 }}>Sign Out</span>
        </Link>
      </div>
    </nav>
  );
}
