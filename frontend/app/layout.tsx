import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { QueryProvider } from "@/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "ExecuPilot AI — Enterprise Suite",
  description: "AI-powered executive assistant — email intelligence, calendar, meeting prep, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        {/* Material Symbols Outlined icon font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ height: "100%" }}>
        <QueryProvider>
          <div className="app-shell">
            <Sidebar />
            <div className="main-content">
              {children}
            </div>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
