"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

// ── Data ─────────────────────────────────────────────────────────────────────

const AUDIENCE = [
  { icon: "person", label: "CEO / Chief Executive", desc: "Reclaim hours of leadership bandwidth every day." },
  { icon: "lightbulb", label: "Founder & Co-Founder", desc: "Move fast without drowning in operational overhead." },
  { icon: "corporate_fare", label: "C-Suite Executives", desc: "Stay ahead with AI-curated intelligence briefings." },
  { icon: "trending_up", label: "VPs & Directors", desc: "Manage large teams without losing strategic focus." },
  { icon: "groups", label: "Team Leads & Managers", desc: "Run tighter meetings, ship cleaner outcomes." },
  { icon: "business_center", label: "Business Professionals", desc: "Work smarter with AI handling the routine load." },
];

const CAPABILITIES = [
  {
    icon: "mark_email_read",
    color: "#4285f4",
    bg: "rgba(66,133,244,0.12)",
    label: "AI Email Intelligence",
    desc: "Reads every email, flags urgency, surfaces approvals and auto-categories your inbox — before you open it.",
  },
  {
    icon: "draw",
    color: "#7aaeff",
    bg: "rgba(122,174,255,0.12)",
    label: "AI Draft Replies",
    desc: "Generates context-aware reply drafts in your voice. Review, edit, send. One click.",
  },
  {
    icon: "event_note",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    label: "AI Meeting Preparation",
    desc: "Delivers a full meeting brief — agenda, participants, prior context — 30 minutes before every call.",
  },
  {
    icon: "summarize",
    color: "#34a853",
    bg: "rgba(52,168,83,0.12)",
    label: "Automatic Meeting Minutes",
    desc: "Transcribes, summarises, and distributes MoMs with action items assigned in seconds.",
  },
  {
    icon: "calendar_month",
    color: "#ea4335",
    bg: "rgba(234,67,53,0.12)",
    label: "Calendar Optimisation",
    desc: "Detects conflicts, protects focus blocks, and reorders your day to match your energy.",
  },
  {
    icon: "schedule_send",
    color: "#fbbc04",
    bg: "rgba(251,188,4,0.12)",
    label: "Smart Scheduling",
    desc: "Finds perfect meeting slots across your team's calendars — no back-and-forth emails.",
  },
  {
    icon: "task_alt",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
    label: "Task Automation",
    desc: "Extracts action items from every email and meeting automatically. Zero manual entry.",
  },
  {
    icon: "insights",
    color: "#c77dff",
    bg: "rgba(199,125,255,0.12)",
    label: "Executive Insights",
    desc: "A daily AI-curated briefing — priorities, risks, decisions — in under 2 minutes.",
  },
  {
    icon: "notifications_active",
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    label: "AI Notifications",
    desc: "Only surfaces alerts that actually matter. No noise — just what requires your attention now.",
  },
  {
    icon: "account_tree",
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    label: "Multi-Agent Workflow",
    desc: "Specialist AI agents work in parallel across email, calendar, and tasks — coordinated automatically.",
  },
];

const STATS = [
  { value: "4.2h", label: "saved per day" },
  { value: "98%", label: "AI accuracy" },
  { value: "<2s", label: "response time" },
  { value: "10×", label: "faster workflows" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleStart = () => {
    setRipple(true);
    setTimeout(() => router.push("/onboarding"), 650);
  };

  return (
    <>
      <style>{`
        /* ── Reset & Base ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Keyframes ── */
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes floatUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes rippleOut {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(35); opacity: 0; }
        }
        @keyframes orb1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%     { transform: translate(70px,-50px) scale(1.12); }
          66%     { transform: translate(-40px,35px) scale(0.94); }
        }
        @keyframes orb2 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%     { transform: translate(-60px,55px) scale(1.07); }
          66%     { transform: translate(50px,-25px) scale(1.12); }
        }
        @keyframes orb3 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(35px,65px) scale(1.09); }
        }
        @keyframes badgePop {
          0%   { opacity: 0; transform: scale(0.8) translateY(6px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes cardEntrance {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes dotPulse {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.3; }
        }

        /* ── Root ── */
        .lp-root {
          min-height: 100vh;
          width: 100%;
          background: #080c18;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow-x: hidden;
          position: relative;
          font-family: 'Inter', system-ui, sans-serif;
          color: #fff;
        }

        /* ── Background orbs ── */
        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
        }
        .orb-1 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(52,89,165,0.32) 0%, transparent 70%);
          top: -200px; left: -150px;
          animation: orb1 20s ease-in-out infinite;
        }
        .orb-2 {
          width: 580px; height: 580px;
          background: radial-gradient(circle, rgba(134,69,138,0.22) 0%, transparent 70%);
          top: 25%; right: -160px;
          animation: orb2 25s ease-in-out infinite;
        }
        .orb-3 {
          width: 480px; height: 480px;
          background: radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%);
          bottom: 5%; left: 15%;
          animation: orb3 18s ease-in-out infinite;
        }
        .orb-4 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(199,125,255,0.12) 0%, transparent 70%);
          bottom: 30%; right: 5%;
          animation: orb1 28s ease-in-out infinite reverse;
        }

        /* ── Grid noise overlay ── */
        .grid-overlay {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
          z-index: 0;
        }

        /* ── Ripple overlay ── */
        .ripple-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 9999;
        }
        .ripple-circle {
          width: 80px; height: 80px;
          background: linear-gradient(135deg, #3459a5, #7b5ea7);
          border-radius: 50%;
          animation: rippleOut 0.65s ease-out forwards;
        }

        /* ── Navigation ── */
        .nav {
          width: 100%;
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 40px;
          transition: all 0.4s ease;
        }
        .nav.scrolled {
          background: rgba(8,12,24,0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 4px 32px rgba(0,0,0,0.3);
        }
        .nav-inner {
          width: 100%;
          max-width: 1200px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 0;
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .nav-logo-mark {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #3459a5 0%, #86458a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 16px rgba(52,89,165,0.4);
        }
        .nav-brand {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.3px;
        }
        .nav-badge {
          font-size: 10px;
          font-weight: 600;
          color: #7aaeff;
          background: rgba(52,89,165,0.15);
          border: 1px solid rgba(52,89,165,0.3);
          border-radius: 99px;
          padding: 4px 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        /* ── Section base ── */
        .section {
          width: 100%;
          max-width: 1200px;
          padding: 0 40px;
          position: relative;
          z-index: 10;
        }

        /* ── Section label ── */
        .section-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7aaeff;
          margin-bottom: 18px;
        }
        .section-label-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #7aaeff;
        }

        /* ── Hero ── */
        .hero {
          padding: 100px 40px 80px;
          text-align: center;
          max-width: 900px;
          margin: 0 auto;
        }
        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(52,89,165,0.12);
          border: 1px solid rgba(52,89,165,0.28);
          border-radius: 99px;
          padding: 7px 20px;
          font-size: 12px;
          font-weight: 600;
          color: #7aaeff;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          margin-bottom: 32px;
          animation: badgePop 0.6s 0.15s ease both;
        }
        .eyebrow-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #7aaeff;
          animation: pulse-ring 1.6s ease-out infinite;
        }
        .hero-title {
          font-size: clamp(46px, 7vw, 80px);
          font-weight: 900;
          line-height: 1.03;
          letter-spacing: -3px;
          color: #fff;
          margin-bottom: 28px;
          animation: floatUp 0.7s 0.25s ease both;
        }
        .hero-title-grad {
          background: linear-gradient(130deg, #7aaeff 0%, #c77dff 40%, #f97316 75%, #7aaeff 100%);
          background-size: 250% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 5s linear infinite;
        }
        .hero-sub {
          font-size: 19px;
          font-weight: 400;
          color: rgba(255,255,255,0.52);
          line-height: 1.7;
          max-width: 620px;
          margin: 0 auto 16px;
          animation: floatUp 0.7s 0.35s ease both;
        }
        .hero-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-bottom: 52px;
          animation: floatUp 0.7s 0.45s ease both;
        }
        .hero-tag {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.45);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 99px;
          padding: 5px 14px;
          letter-spacing: 0.02em;
        }

        /* ── Primary CTA ── */
        .cta-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          animation: floatUp 0.7s 0.55s ease both;
        }
        .cta-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: linear-gradient(135deg, #3459a5 0%, #5b4fcf 45%, #86458a 100%);
          background-size: 200% auto;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          padding: 20px 56px;
          border-radius: 99px;
          border: none;
          cursor: pointer;
          letter-spacing: 0.01em;
          box-shadow: 0 0 0 0 rgba(52,89,165,0.5), 0 10px 40px rgba(52,89,165,0.45);
          transition: all 0.35s ease;
          animation: shimmer 5s linear infinite;
          overflow: hidden;
        }
        .cta-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.2s;
          border-radius: inherit;
        }
        .cta-btn:hover::before { background: rgba(255,255,255,0.09); }
        .cta-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 0 0 10px rgba(52,89,165,0.13), 0 20px 56px rgba(52,89,165,0.55);
        }
        .cta-btn:active { transform: translateY(0); }
        .cta-btn-ring {
          position: absolute;
          inset: -4px;
          border-radius: 99px;
          border: 2px solid rgba(52,89,165,0.35);
          animation: pulse-ring 2.2s ease-out infinite;
        }
        .cta-note {
          font-size: 12px;
          color: rgba(255,255,255,0.28);
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        /* ── Stats row ── */
        .stats-row {
          display: flex;
          justify-content: center;
          gap: 0;
          margin-top: 72px;
          animation: floatUp 0.7s 0.7s ease both;
        }
        .stat-item {
          text-align: center;
          padding: 0 40px;
          border-right: 1px solid rgba(255,255,255,0.07);
        }
        .stat-item:last-child { border-right: none; }
        .stat-value {
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -1.5px;
          line-height: 1;
        }
        .stat-label {
          font-size: 11px;
          color: rgba(255,255,255,0.38);
          font-weight: 600;
          margin-top: 5px;
          text-transform: uppercase;
          letter-spacing: 0.09em;
        }

        /* ── Section divider ── */
        .section-divider {
          width: 100%;
          max-width: 1200px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          margin: 0 auto;
        }

        /* ── Target Audience ── */
        .audience-section {
          padding: 100px 40px;
          width: 100%;
          max-width: 1200px;
          position: relative;
          z-index: 10;
        }
        .audience-heading {
          font-size: clamp(32px, 4vw, 50px);
          font-weight: 800;
          color: #fff;
          letter-spacing: -1.5px;
          line-height: 1.1;
          margin-bottom: 14px;
        }
        .audience-sub {
          font-size: 17px;
          color: rgba(255,255,255,0.45);
          margin-bottom: 56px;
          max-width: 500px;
          line-height: 1.65;
        }
        .audience-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .audience-card {
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 28px 24px;
          display: flex;
          align-items: flex-start;
          gap: 18px;
          transition: all 0.35s ease;
          cursor: default;
          animation: cardEntrance 0.5s ease both;
        }
        .audience-card:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(52,89,165,0.35);
          transform: translateY(-5px);
          box-shadow: 0 12px 40px rgba(52,89,165,0.18);
        }
        .audience-icon-wrap {
          width: 48px; height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(52,89,165,0.2) 0%, rgba(134,69,138,0.2) 100%);
          border: 1px solid rgba(52,89,165,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .audience-text { flex: 1; }
        .audience-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 5px;
          letter-spacing: -0.2px;
        }
        .audience-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.42);
          line-height: 1.55;
        }

        /* ── Why Different ── */
        .why-section {
          padding: 100px 40px;
          width: 100%;
          max-width: 1200px;
          position: relative;
          z-index: 10;
        }
        .why-heading {
          font-size: clamp(32px, 4vw, 50px);
          font-weight: 800;
          color: #fff;
          letter-spacing: -1.5px;
          line-height: 1.1;
          margin-bottom: 14px;
        }
        .why-sub {
          font-size: 17px;
          color: rgba(255,255,255,0.45);
          margin-bottom: 56px;
          max-width: 540px;
          line-height: 1.65;
        }
        .capabilities-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }
        .cap-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          padding: 24px 20px;
          transition: all 0.35s ease;
          cursor: default;
          animation: cardEntrance 0.5s ease both;
          position: relative;
          overflow: hidden;
        }
        .cap-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, transparent 60%, rgba(255,255,255,0.02) 100%);
          pointer-events: none;
        }
        .cap-card:hover {
          background: rgba(255,255,255,0.055);
          transform: translateY(-5px);
          box-shadow: 0 12px 36px rgba(0,0,0,0.25);
        }
        .cap-icon-wrap {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          transition: transform 0.3s;
        }
        .cap-card:hover .cap-icon-wrap {
          transform: scale(1.1);
        }
        .cap-label {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
          line-height: 1.25;
          letter-spacing: -0.1px;
        }
        .cap-desc {
          font-size: 11.5px;
          color: rgba(255,255,255,0.38);
          line-height: 1.6;
        }

        /* ── Trust / Social Proof ── */
        .trust-section {
          width: 100%;
          padding: 60px 40px;
          position: relative;
          z-index: 10;
          text-align: center;
        }
        .trust-inner {
          max-width: 1000px;
          margin: 0 auto;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 24px;
          padding: 48px 60px;
          backdrop-filter: blur(16px);
        }
        .trust-label {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin-bottom: 32px;
        }
        .trust-stats {
          display: flex;
          justify-content: center;
          gap: 0;
        }
        .trust-stat {
          flex: 1;
          padding: 0 32px;
          border-right: 1px solid rgba(255,255,255,0.08);
        }
        .trust-stat:last-child { border-right: none; }
        .trust-stat-value {
          font-size: 42px;
          font-weight: 900;
          letter-spacing: -2px;
          line-height: 1;
          background: linear-gradient(135deg, #7aaeff 0%, #c77dff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        }
        .trust-stat-label {
          font-size: 12px;
          color: rgba(255,255,255,0.38);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.09em;
        }

        /* ── Bottom CTA ── */
        .bottom-cta {
          width: 100%;
          padding: 100px 40px 120px;
          position: relative;
          z-index: 10;
          text-align: center;
        }
        .bottom-cta-inner {
          max-width: 700px;
          margin: 0 auto;
        }
        .bottom-cta-eyebrow {
          font-size: 11px;
          font-weight: 700;
          color: #7aaeff;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin-bottom: 20px;
        }
        .bottom-cta-title {
          font-size: clamp(28px, 4vw, 46px);
          font-weight: 800;
          color: #fff;
          letter-spacing: -1.5px;
          line-height: 1.1;
          margin-bottom: 20px;
        }
        .bottom-cta-sub {
          font-size: 16px;
          color: rgba(255,255,255,0.42);
          margin-bottom: 44px;
          line-height: 1.65;
        }

        /* ── Footer ── */
        .footer {
          width: 100%;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 28px 40px;
          text-align: center;
          position: relative;
          z-index: 10;
        }
        .footer-text {
          font-size: 12px;
          color: rgba(255,255,255,0.2);
          font-weight: 500;
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .capabilities-grid { grid-template-columns: repeat(3, 1fr); }
          .audience-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .hero { padding: 72px 24px 60px; }
          .audience-section, .why-section { padding: 72px 24px; }
          .capabilities-grid { grid-template-columns: repeat(2, 1fr); }
          .audience-grid { grid-template-columns: 1fr; }
          .stats-row { gap: 0; flex-wrap: wrap; }
          .stat-item { padding: 16px 24px; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.07); width: 50%; }
          .stat-item:nth-child(odd) { border-right: 1px solid rgba(255,255,255,0.07); }
          .trust-inner { padding: 36px 24px; }
          .trust-stats { flex-wrap: wrap; }
          .trust-stat { padding: 16px; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08); width: 50%; }
          .trust-stat:nth-child(odd) { border-right: 1px solid rgba(255,255,255,0.08); }
          .nav { padding: 0 24px; }
        }
        @media (max-width: 480px) {
          .capabilities-grid { grid-template-columns: 1fr 1fr; }
          .hero-title { letter-spacing: -2px; }
          .cta-btn { padding: 18px 36px; font-size: 15px; }
          .bottom-cta { padding: 72px 24px 80px; }
        }
      `}</style>

      <div className="lp-root">
        {/* Background */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
        <div className="grid-overlay" />

        {/* Ripple on CTA click */}
        {ripple && (
          <div className="ripple-overlay">
            <div className="ripple-circle" />
          </div>
        )}

        {/* ── Navigation ── */}
        <nav className={`nav${scrolled ? " scrolled" : ""}`}>
          <div className="nav-inner">
            <div className="nav-logo">
              <div className="nav-logo-mark">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#fff", fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                  bolt
                </span>
              </div>
              <span className="nav-brand">ExecuPilot AI</span>
            </div>
            <span className="nav-badge">Enterprise Suite</span>
          </div>
        </nav>

        {/* ══════════════════════════════════════════════ HERO */}
        <section className="hero" ref={heroRef} id="hero">
          <div className="hero-eyebrow">
            <div className="eyebrow-dot" />
            AI-Powered Executive Intelligence
          </div>

          <h1 className="hero-title">
            Your AI{" "}
            <span className="hero-title-grad">Executive</span>
            <br />
            Assistant
          </h1>

          <p className="hero-sub">
            The platform that automatically manages everything on your plate —
          </p>

          <div className="hero-tags">
            {["Emails", "Meetings", "Calendar", "Tasks", "Follow-ups", "Executive Workflows"].map((t) => (
              <span key={t} className="hero-tag">{t}</span>
            ))}
          </div>

          {/* Single primary CTA */}
          <div className="cta-wrap">
            <button className="cta-btn" id="start-demo-btn" onClick={handleStart}>
              <div className="cta-btn-ring" />
              <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>
                play_circle
              </span>
              Start Interactive Demo
            </button>
            <span className="cta-note">No account required &nbsp;·&nbsp; 5-minute interactive walkthrough</span>
          </div>

          {/* Stats */}
          <div className="stats-row">
            {STATS.map((s) => (
              <div key={s.label} className="stat-item">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider" />

        {/* ══════════════════════════════════════════════ TARGET AUDIENCE */}
        <section className="audience-section" id="audience">
          <div className="section-label">
            <div className="section-label-dot" />
            Built For
          </div>
          <h2 className="audience-heading">
            Designed for leaders<br />who move fast
          </h2>
          <p className="audience-sub">
            ExecuPilot AI is purpose-built for the people whose time is the most valuable in any organisation.
          </p>

          <div className="audience-grid">
            {AUDIENCE.map((a, i) => (
              <div
                key={a.label}
                className="audience-card"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="audience-icon-wrap">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 22, color: "#7aaeff", fontVariationSettings: "'FILL' 1" }}
                  >
                    {a.icon}
                  </span>
                </div>
                <div className="audience-text">
                  <div className="audience-title">{a.label}</div>
                  <div className="audience-desc">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider" />

        {/* ══════════════════════════════════════════════ WHY DIFFERENT */}
        <section className="why-section" id="features">
          <div className="section-label">
            <div className="section-label-dot" />
            Why ExecuPilot AI
          </div>
          <h2 className="why-heading">
            Not just another<br />productivity tool
          </h2>
          <p className="why-sub">
            Ten deeply integrated AI capabilities working in concert — so every part of your executive day runs on autopilot.
          </p>

          <div className="capabilities-grid">
            {CAPABILITIES.map((c, i) => (
              <div
                key={c.label}
                className="cap-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div
                  className="cap-icon-wrap"
                  style={{ background: c.bg, border: `1px solid ${c.color}22` }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 22, color: c.color, fontVariationSettings: "'FILL' 1" }}
                  >
                    {c.icon}
                  </span>
                </div>
                <div className="cap-label">{c.label}</div>
                <div className="cap-desc">{c.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider" />

        {/* ══════════════════════════════════════════════ TRUST BAR */}
        <section className="trust-section" id="trust">
          <div className="trust-inner">
            <div className="trust-label">Proven executive impact</div>
            <div className="trust-stats">
              <div className="trust-stat">
                <div className="trust-stat-value">4.2h</div>
                <div className="trust-stat-label">Saved per day, per executive</div>
              </div>
              <div className="trust-stat">
                <div className="trust-stat-value">98%</div>
                <div className="trust-stat-label">AI task accuracy rate</div>
              </div>
              <div className="trust-stat">
                <div className="trust-stat-value">&lt;2s</div>
                <div className="trust-stat-label">Average AI response time</div>
              </div>
              <div className="trust-stat">
                <div className="trust-stat-value">10×</div>
                <div className="trust-stat-label">Faster workflow execution</div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════ BOTTOM CTA */}
        <section className="bottom-cta" id="cta">
          <div className="bottom-cta-inner">
            <div className="bottom-cta-eyebrow">Get Started — Free Demo</div>
            <h2 className="bottom-cta-title">
              Ready to experience the future of executive productivity?
            </h2>
            <p className="bottom-cta-sub">
              See ExecuPilot AI in action. Walk through the full platform in 5 minutes — no sign-up, no commitment.
            </p>
            <div className="cta-wrap">
              <button className="cta-btn" id="start-demo-bottom-btn" onClick={handleStart}>
                <div className="cta-btn-ring" />
                <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>
                  play_circle
                </span>
                Start Interactive Demo
              </button>
              <span className="cta-note">No account required &nbsp;·&nbsp; Interactive walkthrough</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <span className="footer-text">
            © 2026 ExecuPilot AI · Enterprise Suite · All rights reserved
          </span>
        </footer>
      </div>
    </>
  );
}
