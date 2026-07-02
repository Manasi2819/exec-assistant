"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

// Routes that get a full-screen blank canvas (no sidebar, no shell wrapper)
const FULLSCREEN_ROUTES = ["/", "/onboarding"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = pathname === "/" || pathname.startsWith("/onboarding");

  if (isFullScreen) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  );
}
