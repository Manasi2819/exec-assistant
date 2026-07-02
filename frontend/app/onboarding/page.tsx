"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type ConnectionStatus = "idle" | "connecting" | "done";
type SubStatus = "" | "Connecting..." | "Authorizing..." | "Syncing..." | "✓ Connected";

interface Tool {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  description: string;
}

const TOOLS: Tool[] = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "mail",
    iconColor: "#ea4335",
    iconBg: "rgba(234,67,53,0.12)",
    description: "Read, draft and send emails with AI intelligence.",
  },
  {
    id: "calendar",
    name: "Google Calendar",
    icon: "calendar_today",
    iconColor: "#4285f4",
    iconBg: "rgba(66,133,244,0.12)",
    description: "Sync meetings, prep briefs and detect conflicts.",
  },
  {
    id: "outlook",
    name: "Outlook",
    icon: "inbox",
    iconColor: "#0078d4",
    iconBg: "rgba(0,120,212,0.12)",
    description: "Unify your Microsoft inbox and calendar data.",
  },
  {
    id: "zoom",
    name: "Zoom",
    icon: "videocam",
    iconColor: "#2d8cff",
    iconBg: "rgba(45,140,255,0.12)",
    description: "Join, record and get AI summaries of every call.",
  },
  {
    id: "slack",
    name: "Slack",
    icon: "forum",
    iconColor: "#e01e5a",
    iconBg: "rgba(224,30,90,0.12)",
    description: "Surface action items from channels and DMs.",
  },
];

// Sub-status animation sequence (ms from connect start)
const SUB_STATUSES: { text: SubStatus; delay: number }[] = [
  { text: "Connecting...", delay: 0 },
  { text: "Authorizing...", delay: 600 },
  { text: "Syncing...", delay: 1400 },
  { text: "✓ Connected", delay: 2100 },
];

const WORKSPACE_STEPS = [
  { label: "Syncing Emails",             icon: "mail",          delay: 0    },
  { label: "Reading Calendar",           icon: "calendar_today", delay: 600  },
  { label: "Understanding Meetings",     icon: "groups",         delay: 1200 },
  { label: "Building Executive Knowledge", icon: "psychology",   delay: 1800 },
  { label: "Prioritising Tasks",         icon: "task_alt",       delay: 2400 },
  { label: "Generating AI Insights",     icon: "auto_awesome",   delay: 3000 },
  { label: "Preparing Dashboard",        icon: "dashboard",      delay: 3600 },
];

export default function OnboardingPage() {
  const router = useRouter();

  // Main flow step: 0=tools, 1=preparing, 2=complete
  const [mainStep, setMainStep] = useState(0);

  // Per-tool connection status
  const [toolStatuses, setToolStatuses] = useState<Record<string, ConnectionStatus>>(
    Object.fromEntries(TOOLS.map((t) => [t.id, "idle"]))
  );
  const [toolSubStatuses, setToolSubStatuses] = useState<Record<string, SubStatus>>(
    Object.fromEntries(TOOLS.map((t) => [t.id, ""]))
  );
  const [connectingTool, setConnectingTool] = useState<string | null>(null);
  const [allConnected, setAllConnected] = useState(false);

  // Workspace preparation
  const [workspaceProgress, setWorkspaceProgress] = useState(0);
  const [workspaceChecks, setWorkspaceChecks] = useState<boolean[]>(
    new Array(WORKSPACE_STEPS.length).fill(false)
  );

  // Complete screen
  const [showComplete, setShowComplete] = useState(false);
  const [dashboardBtnReady, setDashboardBtnReady] = useState(false);

  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const subStatusTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Connect a single tool ────────────────────────────────────────────────
  const handleConnect = (toolId: string) => {
    if (toolStatuses[toolId] !== "idle" || connectingTool) return;
    setConnectingTool(toolId);
    setToolStatuses((prev) => ({ ...prev, [toolId]: "connecting" }));

    // Clear any old timers
    subStatusTimers.current.forEach(clearTimeout);
    subStatusTimers.current = [];

    // Animate sub-status text
    SUB_STATUSES.forEach(({ text, delay }) => {
      const t = setTimeout(() => {
        setToolSubStatuses((prev) => ({ ...prev, [toolId]: text }));
      }, delay);
      subStatusTimers.current.push(t);
    });

    // Mark as done
    const doneTimer = setTimeout(() => {
      setToolStatuses((prev) => ({ ...prev, [toolId]: "done" }));
      setConnectingTool(null);
    }, 2500);
    subStatusTimers.current.push(doneTimer);
  };

  // Check if all tools are connected
  useEffect(() => {
    const allDone = TOOLS.every((t) => toolStatuses[t.id] === "done");
    setAllConnected(allDone);
  }, [toolStatuses]);

  // ── Start workspace preparation ──────────────────────────────────────────
  const handlePrepare = () => {
    setMainStep(1);
  };

  useEffect(() => {
    if (mainStep !== 1) return;

    // Animate workspace steps
    WORKSPACE_STEPS.forEach((ws, i) => {
      setTimeout(() => {
        setWorkspaceChecks((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, ws.delay + 400);
    });

    // Progress bar: 0 → 100 over ~4.5s
    let pct = 0;
    progressInterval.current = setInterval(() => {
      pct += 1.2;
      setWorkspaceProgress(Math.min(pct, 100));
      if (pct >= 100) {
        clearInterval(progressInterval.current!);
        setTimeout(() => setMainStep(2), 600);
      }
    }, 50);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [mainStep]);

  // ── Complete screen ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mainStep !== 2) return;
    setShowComplete(false);
    setDashboardBtnReady(false);
    setTimeout(() => setShowComplete(true), 100);
    setTimeout(() => setDashboardBtnReady(true), 900);
  }, [mainStep]);

  const handleOpenDashboard = () => {
    router.push("/dashboard");
  };

  const connectedCount = TOOLS.filter((t) => toolStatuses[t.id] === "done").length;

  // ── Total step count for progress dots (1 per tool + preparing + complete)
  const totalDots = 3; // tools → preparing → complete

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinY { to { transform: rotate(360deg); } }
        @keyframes pulse-glow {
          0%,100% { box-shadow: 0 0 0 0 rgba(52,89,165,0.5); }
          50%     { box-shadow: 0 0 0 14px rgba(52,89,165,0); }
        }
        @keyframes checkPop {
          0%  { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); }
          100%{ transform: scale(1); opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes completePop {
          0%  { opacity: 0; transform: scale(0.85) translateY(24px); }
          60% { transform: scale(1.03) translateY(-4px); }
          100%{ opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes orb1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(50px,-30px) scale(1.08); }
        }
        @keyframes orb2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(-40px,40px) scale(1.05); }
        }
        @keyframes successPulse {
          0%  { box-shadow: 0 0 0 0 rgba(19,115,51,0.6); }
          70% { box-shadow: 0 0 0 18px rgba(19,115,51,0); }
          100%{ box-shadow: 0 0 0 0 rgba(19,115,51,0); }
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-9px); }
        }
        @keyframes subStatusFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes starBurst {
          0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
          50%  { transform: scale(1.3) rotate(10deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .ob-root {
          min-height: 100vh;
          width: 100vw;
          background: #080c18;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
          padding: 40px 24px;
        }

        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
        }
        .orb-a {
          width: 560px; height: 560px;
          background: radial-gradient(circle, rgba(52,89,165,0.28) 0%, transparent 70%);
          top: -120px; left: -100px;
          animation: orb1 22s ease-in-out infinite;
        }
        .orb-b {
          width: 460px; height: 460px;
          background: radial-gradient(circle, rgba(134,69,138,0.18) 0%, transparent 70%);
          bottom: 0; right: -80px;
          animation: orb2 26s ease-in-out infinite;
        }

        .ob-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 540px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 26px;
          padding: 44px 40px;
          backdrop-filter: blur(24px);
          animation: fadeIn 0.5s ease both;
          box-shadow: 0 24px 80px rgba(0,0,0,0.4);
        }

        /* ── Progress dots ── */
        .ob-progress-dots {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-bottom: 36px;
        }
        .ob-dot {
          width: 8px; height: 8px;
          border-radius: 99px;
          background: rgba(255,255,255,0.12);
          transition: all 0.4s ease;
        }
        .ob-dot.active {
          width: 30px;
          background: linear-gradient(90deg, #3459a5, #7b5ea7);
        }
        .ob-dot.done {
          background: #137333;
        }

        /* ── Logo ── */
        .ob-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }
        .ob-logo-mark {
          width: 34px; height: 34px;
          border-radius: 9px;
          background: linear-gradient(135deg, #3459a5 0%, #86458a 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 14px rgba(52,89,165,0.35);
        }
        .ob-logo-name {
          font-size: 15px;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
        }

        .ob-step-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #7aaeff;
          margin-bottom: 8px;
        }
        .ob-title {
          font-size: 26px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.6px;
          margin-bottom: 8px;
          line-height: 1.2;
        }
        .ob-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.42);
          line-height: 1.65;
          margin-bottom: 32px;
        }

        /* ── Tool cards ── */
        .tool-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 26px;
        }
        .tool-card {
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 13px 16px;
          transition: all 0.3s ease;
        }
        .tool-card.connected {
          border-color: rgba(19,115,51,0.4);
          background: rgba(19,115,51,0.05);
        }
        .tool-card.connecting {
          border-color: rgba(52,89,165,0.4);
          background: rgba(52,89,165,0.06);
        }
        .tool-icon-wrap {
          width: 40px; height: 40px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all 0.3s;
        }
        .tool-info { flex: 1; min-width: 0; }
        .tool-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 2px;
        }
        .tool-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.38);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tool-action { flex-shrink: 0; min-width: 100px; text-align: right; }

        /* Sub-status text */
        .sub-status {
          font-size: 11.5px;
          font-weight: 600;
          color: #7aaeff;
          animation: subStatusFade 0.25s ease both;
          white-space: nowrap;
        }
        .sub-status.done-text { color: #34a853; }

        /* Connect button */
        .connect-btn {
          font-size: 13px;
          font-weight: 600;
          color: #7aaeff;
          background: rgba(52,89,165,0.15);
          border: 1px solid rgba(52,89,165,0.3);
          border-radius: 8px;
          padding: 7px 18px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .connect-btn:hover:not(:disabled) {
          background: rgba(52,89,165,0.28);
          border-color: rgba(52,89,165,0.55);
          transform: translateY(-1px);
        }
        .connect-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Spinner */
        .spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(52,89,165,0.25);
          border-top-color: #7aaeff;
          border-radius: 50%;
          animation: spinY 0.65s linear infinite;
          flex-shrink: 0;
        }

        /* Check badge */
        .check-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #34a853;
          animation: checkPop 0.35s ease both;
        }
        .check-icon-wrap {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: rgba(19,115,51,0.2);
          display: flex; align-items: center; justify-content: center;
        }

        /* ── Next button ── */
        .ob-btn-primary {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: linear-gradient(135deg, #3459a5 0%, #5b4fcf 100%);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          padding: 17px;
          border-radius: 13px;
          border: none;
          cursor: pointer;
          transition: all 0.3s;
          letter-spacing: 0.01em;
        }
        .ob-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(52,89,165,0.45);
        }
        .ob-btn-primary:disabled {
          opacity: 0.38;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        /* ── Connected summary ── */
        .connected-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          margin-bottom: 16px;
        }
        .connected-summary strong { color: #34a853; }

        /* ── Workspace preparation ── */
        .workspace-checklist {
          display: flex;
          flex-direction: column;
          gap: 13px;
          margin-bottom: 32px;
        }
        .ws-item {
          display: flex;
          align-items: center;
          gap: 12px;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .ws-item.visible {
          opacity: 1;
          animation: fadeIn 0.4s ease both;
        }
        .ws-icon-wrap {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(52,89,165,0.1);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.4s;
        }
        .ws-icon-wrap.done-wrap { background: rgba(19,115,51,0.12); }
        .ws-label {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          transition: color 0.3s;
        }
        .ws-label.done-label { color: #fff; }
        .ws-check {
          width: 20px; height: 20px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.18);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s;
          flex-shrink: 0;
        }
        .ws-check.done {
          background: #137333;
          border-color: #137333;
          animation: checkPop 0.3s ease both;
        }

        /* Progress bar */
        .progress-bar-wrap {
          background: rgba(255,255,255,0.07);
          border-radius: 99px;
          height: 5px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #3459a5, #7aaeff, #c77dff);
          background-size: 200% auto;
          animation: shimmer 2s linear infinite;
          transition: width 0.12s ease;
        }
        .progress-pct {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          text-align: right;
          margin-bottom: 4px;
        }

        /* ── Complete screen ── */
        .complete-wrap {
          text-align: center;
          animation: completePop 0.65s ease both;
        }
        .complete-icon {
          width: 84px; height: 84px;
          border-radius: 50%;
          background: linear-gradient(135deg, #137333 0%, #34a853 100%);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 28px;
          animation: successPulse 1.5s ease-out, float 3.2s 1.5s ease-in-out infinite;
          box-shadow: 0 10px 40px rgba(19,115,51,0.45);
        }
        .complete-title {
          font-size: 27px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.6px;
          margin-bottom: 10px;
          line-height: 1.2;
        }
        .complete-sub {
          font-size: 14px;
          color: rgba(255,255,255,0.42);
          margin-bottom: 32px;
          line-height: 1.65;
        }
        .complete-connections {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .connected-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 600;
          color: #34a853;
          background: rgba(19,115,51,0.1);
          border: 1px solid rgba(19,115,51,0.22);
          border-radius: 99px;
          padding: 4px 12px;
          animation: checkPop 0.4s ease both;
        }
        .ob-btn-dashboard {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: linear-gradient(135deg, #137333 0%, #34a853 100%);
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          padding: 18px;
          border-radius: 13px;
          border: none;
          cursor: pointer;
          transition: all 0.3s;
          opacity: 0;
          letter-spacing: 0.01em;
        }
        .ob-btn-dashboard.ready {
          opacity: 1;
          animation: pulse-glow 2.2s ease-out infinite, fadeIn 0.5s ease both;
        }
        .ob-btn-dashboard:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 36px rgba(19,115,51,0.5);
        }

        @keyframes pulse-glow {
          0%,100% { box-shadow: 0 0 0 0 rgba(19,115,51,0.5); }
          50%      { box-shadow: 0 0 0 14px rgba(19,115,51,0); }
        }
      `}</style>

      <div className="ob-root">
        <div className="orb orb-a" />
        <div className="orb orb-b" />

        <div className="ob-card">
          {/* Logo */}
          <div className="ob-logo">
            <div className="ob-logo-mark">
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#fff", fontVariationSettings: "'FILL' 1" }}>
                bolt
              </span>
            </div>
            <span className="ob-logo-name">ExecuPilot AI</span>
          </div>

          {/* Progress dots */}
          <div className="ob-progress-dots">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`ob-dot ${mainStep === i ? "active" : mainStep > i ? "done" : ""}`}
              />
            ))}
          </div>

          {/* ═══════════════════════════════════════ STEP 0: Connect Tools */}
          {mainStep === 0 && (
            <div>
              <div className="ob-step-label">Step 1 of 3</div>
              <div className="ob-title">Connect your tools</div>
              <div className="ob-subtitle">
                Link your workplace tools so ExecuPilot AI can manage your executive day intelligently.
              </div>

              <div className="tool-list">
                {TOOLS.map((tool) => {
                  const status = toolStatuses[tool.id];
                  const subStatus = toolSubStatuses[tool.id];
                  return (
                    <div
                      key={tool.id}
                      className={`tool-card ${status === "done" ? "connected" : status === "connecting" ? "connecting" : ""}`}
                    >
                      {/* Icon */}
                      <div className="tool-icon-wrap" style={{ background: tool.iconBg }}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 20, color: tool.iconColor, fontVariationSettings: "'FILL' 1" }}
                        >
                          {tool.icon}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="tool-info">
                        <div className="tool-name">{tool.name}</div>
                        <div className="tool-desc">{tool.description}</div>
                      </div>

                      {/* Action */}
                      <div className="tool-action">
                        {status === "idle" && (
                          <button
                            className="connect-btn"
                            onClick={() => handleConnect(tool.id)}
                            disabled={!!connectingTool}
                            id={`connect-${tool.id}-btn`}
                          >
                            Connect
                          </button>
                        )}
                        {status === "connecting" && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <div className="spinner" />
                            {subStatus && (
                              <span key={subStatus} className="sub-status">
                                {subStatus}
                              </span>
                            )}
                          </div>
                        )}
                        {status === "done" && (
                          <div className="check-badge">
                            <div className="check-icon-wrap">
                              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#34a853", fontVariationSettings: "'FILL' 1" }}>
                                check
                              </span>
                            </div>
                            Connected
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="connected-summary">
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 16,
                    color: connectedCount === TOOLS.length ? "#34a853" : "rgba(255,255,255,0.28)",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  {connectedCount === TOOLS.length ? "check_circle" : "radio_button_unchecked"}
                </span>
                <span>
                  <strong>{connectedCount} of {TOOLS.length}</strong> tools connected
                </span>
              </div>

              <button
                className="ob-btn-primary"
                disabled={!allConnected}
                onClick={handlePrepare}
                id="prepare-workspace-btn"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                  {allConnected ? "auto_awesome" : "lock"}
                </span>
                {allConnected ? "Prepare My Workspace" : `Connect all ${TOOLS.length} tools to continue`}
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════ STEP 1: Preparing */}
          {mainStep === 1 && (
            <div>
              <div className="ob-step-label">Step 2 of 3</div>
              <div className="ob-title">Building your workspace</div>
              <div className="ob-subtitle">
                ExecuPilot AI is analysing your data and preparing your personalised executive dashboard.
              </div>

              <div className="workspace-checklist">
                {WORKSPACE_STEPS.map((ws, i) => (
                  <div key={ws.label} className={`ws-item ${workspaceChecks[i] ? "visible" : ""}`}>
                    <div className={`ws-icon-wrap ${workspaceChecks[i] ? "done-wrap" : ""}`}>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 18,
                          color: workspaceChecks[i] ? "#34a853" : "rgba(255,255,255,0.28)",
                          fontVariationSettings: "'FILL' 1",
                          transition: "color 0.3s",
                        }}
                      >
                        {ws.icon}
                      </span>
                    </div>
                    <span className={`ws-label ${workspaceChecks[i] ? "done-label" : ""}`}>
                      {ws.label}
                    </span>
                    <div className={`ws-check ${workspaceChecks[i] ? "done" : ""}`}>
                      {workspaceChecks[i] && (
                        <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#fff", fontVariationSettings: "'FILL' 1" }}>
                          check
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="progress-pct">{Math.round(workspaceProgress)}%</div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${workspaceProgress}%` }} />
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ STEP 2: Complete */}
          {mainStep === 2 && showComplete && (
            <div className="complete-wrap">
              <div className="complete-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 42, color: "#fff", fontVariationSettings: "'FILL' 1" }}>
                  check
                </span>
              </div>

              <div className="complete-title">Your Executive Workspace<br />is Ready</div>
              <div className="complete-sub">
                Everything is synced. Your AI is standing by and your<br />
                executive dashboard is personalised and waiting.
              </div>

              <div className="complete-connections">
                {TOOLS.map((t, idx) => (
                  <div
                    key={t.id}
                    className="connected-chip"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 11, color: "#34a853", fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    {t.name}
                  </div>
                ))}
              </div>

              <button
                className={`ob-btn-dashboard ${dashboardBtnReady ? "ready" : ""}`}
                onClick={handleOpenDashboard}
                id="open-dashboard-btn"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
                  dashboard
                </span>
                Open Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
