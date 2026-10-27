import { useState } from 'react';
import {
  UploadCloud,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  Dumbbell,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from '../ui/icons';

export function BentoDashboardView() {
  const [isHardwareQuoteOpen, setIsHardwareQuoteOpen] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    gateType: 'speed_gate',
    lanes: '2',
    branch: 'Downtown Flagship',
    contactPhone: '',
    notes: '',
  });
  return (
    <div className="flex flex-col w-full pb-12">
      {/* Top Command Action Streamer */}
      <div className="px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-surface-container-low border-b border-outline-variant/30 shadow-sm">
        <div className="flex flex-col gap-1">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-outline font-semibold">
            <span>GymPulse</span>
            <span className="text-on-surface-variant font-bold">/</span>
            <span className="text-on-surface-variant">Downtown Flagship</span>
            <span className="text-on-surface-variant font-bold">/</span>
            <span className="text-primary font-bold">Master Hub</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-on-surface flex items-center gap-2 font-display">
              Downtown Flagship
              <span className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-bold rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-1.5" />
                LIVE OPS
              </span>
            </h1>
            <span className="text-outline text-xs hidden sm:inline">•</span>
            <span className="text-xs text-on-surface-variant">
              842 Active Checked-in Members Today
            </span>
            <span className="text-outline text-xs hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-secondary">
              Capacity 68%
            </span>
          </div>
        </div>

        {/* Page Quick Action Cluster */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setIsHardwareQuoteOpen(true);
              setQuoteSubmitted(false);
            }}
            className="group flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-secondary/30 hover:border-secondary text-secondary text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Automated turnstile gates hardware integration quote"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            <span>Want automated turnstile gates? Request hardware quote</span>
          </button>

          <button
            type="button"
            className="group flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-secondary group-hover:scale-110 transition-transform" />
            <span>Submit Document</span>
          </button>

          <button
            type="button"
            className="group flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-outline group-hover:text-primary transition-colors" />
            <span>Export Shift Audit</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-on-primary-container text-xs font-bold transition-all shadow-[0_0_20px_-3px_rgba(158,233,57,0.35)] active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Check-in</span>
          </button>
        </div>
      </div>

      {/* Primary Asymmetric Bento Canvas */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 min-w-0">
        {/* [BOX 1: 2x2 Bento Hub] Real-time Telemetry & Live Access Pulse */}
        <div className="xl:col-span-2 xl:row-span-2 rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 flex flex-col justify-between relative overflow-hidden group shadow-lg min-w-0">
          {/* Ambient Glow */}
          <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-start justify-between pb-4">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Real-time Telemetry
                </span>
                <h2 className="text-xl font-bold text-on-surface font-display">
                  Live Membership & Access Pulse
                </h2>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-high rounded-lg border border-outline-variant/40">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span className="text-[10px] text-on-surface font-mono font-bold">
                  1.2s LATENCY
                </span>
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col">
                <span className="text-[11px] text-on-surface-variant font-medium">Active Members</span>
                <span className="text-2xl font-black text-on-surface tracking-tight mt-1 font-stat-metric">
                  1,420
                </span>
                <span className="text-[10px] text-primary flex items-center gap-0.5 mt-1 font-bold">
                  ↑ +4.8% net
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col">
                <span className="text-[11px] text-on-surface-variant font-medium">Expiring 7-Days</span>
                <span className="text-2xl font-black text-tertiary tracking-tight mt-1 font-stat-metric">
                  18
                </span>
                <span className="text-[10px] text-tertiary mt-1">Notices sent</span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col">
                <span className="text-[11px] text-on-surface-variant font-medium">Pending Renewals</span>
                <span className="text-2xl font-black text-secondary tracking-tight mt-1 font-stat-metric">
                  32
                </span>
                <span className="text-[10px] text-secondary mt-1">Auto-debit staged</span>
              </div>
            </div>

            {/* Hourly Occupancy Area Curve (Inline SVG) */}
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-on-surface font-bold">
                  Hourly Throughput vs Capacity Peak
                </span>
                <span className="text-[10px] text-outline font-mono">
                  06:00 - 22:00 UTC
                </span>
              </div>

              <div className="w-full h-32 relative">
                <svg
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                  viewBox="0 0 500 120"
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary, #9ee939)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--color-primary, #9ee939)" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="secondaryAreaGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-secondary, #4cd7f6)" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="var(--color-secondary, #4cd7f6)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Capacity Ceiling */}
                  <line x1="0" x2="500" y1="20" y2="20" stroke="var(--color-outline-variant, #424936)" strokeDasharray="4 4" strokeWidth="1" />
                  
                  {/* Historical Average Path */}
                  <path d="M0,90 Q60,75 120,40 T240,65 T360,30 T500,70 L500,120 L0,120 Z" fill="url(#secondaryAreaGradient)" />
                  
                  {/* Real-time Active Today */}
                  <path d="M0,105 Q70,95 140,55 T260,35 T380,18 T500,45 L500,120 L0,120 Z" fill="url(#areaGradient)" />
                  <path d="M0,105 Q70,95 140,55 T260,35 T380,18 T500,45" fill="none" stroke="var(--color-primary, #9ee939)" strokeWidth="3" />

                  {/* Current Ping Point */}
                  <circle cx="380" cy="18" r="5" fill="var(--color-primary, #9ee939)" className="animate-ping" />
                  <circle cx="380" cy="18" r="4" fill="var(--color-primary, #9ee939)" />
                </svg>
              </div>

              <div className="flex justify-between text-[10px] text-outline pt-2 font-mono">
                <span>06:00</span>
                <span>09:00 (Rush)</span>
                <span>12:00</span>
                <span>15:00</span>
                <span className="text-primary font-bold">18:00 (Peak: 68%)</span>
                <span>22:00</span>
              </div>
            </div>

            {/* Mini Turnstile Access Stream */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-on-surface font-bold">
                  Real-time Desk Check-In Stream (Software Mode)
                </span>
                <span className="text-[11px] text-primary hover:underline cursor-pointer">
                  View Check-in Feed →
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center text-secondary text-xs font-bold">
                      DV
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface leading-tight">
                        Derrick Vance
                      </span>
                      <span className="text-[10px] text-outline">
                        Tier: Black Platinum • Desk Scanner #02
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-on-surface-variant font-mono">2m ago</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                      <CheckCircle2 className="w-3 h-3" /> APPROVED
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary text-xs font-bold">
                      MK
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface leading-tight">
                        Maya Kowalski
                      </span>
                      <span className="text-[10px] text-outline">
                        Tier: Standard Core • Desk Scanner #01
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-on-surface-variant font-mono">4m ago</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                      <CheckCircle2 className="w-3 h-3" /> APPROVED
                    </span>
                  </div>
                </div>
              </div>

              {/* Turnstile Hardware Add-on Callout Banner */}
              <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-surface-container-high to-surface-container border border-secondary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-secondary/15 flex items-center justify-center text-secondary shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-on-surface">Automated Turnstiles & Gates</span>
                    <span className="text-[10px] text-on-surface-variant">
                      Phase 1 uses software desk scanning. Want automated turnstile gates? Request hardware quote.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsHardwareQuoteOpen(true);
                    setQuoteSubmitted(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                >
                  Request Quote
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* [BOX 2: Wide 2x1 Bento Box] Regional Facility Network Health */}
        <div className="xl:col-span-2 rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 flex flex-col justify-between shadow-lg min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                Cluster Overview
              </span>
              <h2 className="text-lg font-bold text-on-surface font-display">
                Regional Facility Network Health
              </h2>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-primary hover:underline text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Location</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Branch 1: Downtown */}
            <div className="p-4 rounded-xl bg-surface-container border-2 border-primary/40 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/15 text-primary rounded">
                  ACTIVE HUB
                </span>
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              </div>
              <div className="my-3">
                <h3 className="text-sm font-bold text-on-surface leading-tight">Downtown Flagship</h3>
                <span className="text-[10px] text-outline">Metro Center Zone</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="text-[10px] text-on-surface-variant">Headcount</div>
                  <div className="text-base font-bold text-on-surface">842</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-on-surface-variant">MTD Volume</div>
                  <div className="text-base font-bold text-primary">$42.5k</div>
                </div>
              </div>
            </div>

            {/* Branch 2: Westside */}
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 hover:border-secondary/50 transition-colors shadow-sm flex flex-col justify-between cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary/15 text-secondary rounded">
                  PEAK LOAD
                </span>
                <span className="text-[10px] text-outline font-mono">#02</span>
              </div>
              <div className="my-3">
                <h3 className="text-sm font-bold text-on-surface leading-tight">Westside CrossFit</h3>
                <span className="text-[10px] text-outline">Industrial Park Pier</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="text-[10px] text-on-surface-variant">Headcount</div>
                  <div className="text-base font-bold text-on-surface">520</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-on-surface-variant">Capacity</div>
                  <div className="text-base font-bold text-secondary">92%</div>
                </div>
              </div>
            </div>

            {/* Branch 3: Uptown */}
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 hover:border-tertiary/50 transition-colors shadow-sm flex flex-col justify-between cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-tertiary-container/20 text-tertiary rounded">
                  INSPECTION
                </span>
                <span className="text-[10px] text-outline font-mono">#03</span>
              </div>
              <div className="my-3">
                <h3 className="text-sm font-bold text-on-surface leading-tight">Uptown Spa Club</h3>
                <span className="text-[10px] text-outline">North Highlands</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="text-[10px] text-on-surface-variant">Headcount</div>
                  <div className="text-base font-bold text-on-surface">310</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-on-surface-variant">Status</div>
                  <div className="text-xs font-bold text-tertiary">Audit Pend.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* [BOX 3: Medium 1x2 Bento Box] Platform Compliance Vault */}
        <div className="xl:col-span-1 xl:row-span-2 rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 flex flex-col justify-between shadow-lg min-w-0">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Regulatory Vault
              </span>
              <ShieldCheck className="w-4 h-4 text-outline" />
            </div>
            <h2 className="text-base font-bold text-on-surface font-display mb-3">
              Platform Compliance
            </h2>

            {/* Progress Meter */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-on-surface-variant">Audit Readiness</span>
                <span className="text-sm font-bold text-primary font-mono">85%</span>
              </div>
              <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: '85%' }} />
              </div>
            </div>

            {/* Compliance List with Left Status Strips */}
            <div className="flex flex-col gap-2.5">
              <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 flex flex-col relative overflow-hidden pl-3.5 shadow-xs">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface">Operating License 2025</span>
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded">
                    VERIFIED
                  </span>
                </div>
                <span className="text-[10px] text-outline mt-0.5 font-mono">#OP-88219</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 flex flex-col relative overflow-hidden pl-3.5 shadow-xs">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface">Fire Safety Clearance</span>
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded">
                    VERIFIED
                  </span>
                </div>
                <span className="text-[10px] text-outline mt-0.5">Valid until Oct 2026</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 flex flex-col relative overflow-hidden pl-3.5 shadow-xs">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary-container" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface">AED / CPR Staff Registry</span>
                  <span className="px-1.5 py-0.5 bg-tertiary-container/20 text-tertiary text-[9px] font-bold rounded">
                    PENDING
                  </span>
                </div>
                <span className="text-[10px] text-outline mt-0.5">Review queue: Admin Desk</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 flex flex-col relative overflow-hidden pl-3.5 shadow-xs">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-error" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface">Public Liability Cover</span>
                  <span className="px-1.5 py-0.5 bg-error-container/30 text-error text-[9px] font-bold rounded">
                    ACTION REQ
                  </span>
                </div>
                <span className="text-[10px] text-error font-bold mt-0.5">Renew by Nov 30!</span>
              </div>
            </div>
          </div>

          {/* Mini Drag & Drop File Area */}
          <div className="mt-4 p-3 rounded-xl bg-surface-container/70 border border-dashed border-outline-variant hover:border-primary transition-colors flex flex-col items-center justify-center text-center cursor-pointer group">
            <UploadCloud className="w-5 h-5 text-outline group-hover:text-primary transition-colors mb-1" />
            <span className="text-xs font-bold text-on-surface">Upload Verification PDF</span>
            <span className="text-[10px] text-outline mb-2">Max 25MB (PDF, DOCX)</span>
            <button
              type="button"
              className="px-3 py-1 rounded bg-surface-container-highest hover:bg-surface-bright text-on-surface text-[11px] font-semibold transition-colors"
            >
              Select File
            </button>
          </div>
        </div>

        {/* [BOX 4: 1x1 Bento Box] Trainer & Class Roster */}
        <div className="xl:col-span-1 rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 flex flex-col justify-between shadow-lg min-w-0">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                Floor Coaches
              </span>
              <span className="px-2 py-0.5 bg-secondary/15 text-secondary text-[10px] font-bold rounded">
                14 ON DUTY
              </span>
            </div>
            <h2 className="text-base font-bold text-on-surface font-display mb-3">
              Trainer Roster
            </h2>

            <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-primary font-mono font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-primary animate-pulse" /> IN 15M
                </span>
                <span className="text-[10px] text-outline">Arena 1</span>
              </div>
              <span className="text-xs font-bold text-on-surface">Olympic Lifting with Marcus</span>
              <div className="flex items-center justify-between pt-1">
                <div className="flex -space-x-1.5">
                  <span className="inline-block h-5 w-5 rounded-full bg-surface-variant text-center text-[9px] leading-5 text-on-surface font-bold ring-1 ring-surface">
                    DA
                  </span>
                  <span className="inline-block h-5 w-5 rounded-full bg-secondary text-center text-[9px] leading-5 text-on-secondary font-bold ring-1 ring-surface">
                    SL
                  </span>
                  <span className="inline-block h-5 w-5 rounded-full bg-primary text-center text-[9px] leading-5 text-on-primary font-bold ring-1 ring-surface">
                    +16
                  </span>
                </div>
                <span className="text-[10px] text-secondary font-bold font-mono">18 / 20 SPOTS</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 text-[11px] text-outline">
            <span>6 Classes Today</span>
            <span className="text-primary hover:underline cursor-pointer">View schedule →</span>
          </div>
        </div>

        {/* [BOX 5: 1x1 Bento Box] Equipment Status & Diagnostics */}
        <div className="xl:col-span-1 rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 flex flex-col justify-between shadow-lg min-w-0">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                Asset Diagnostics
              </span>
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                98% ONLINE
              </span>
            </div>
            <h2 className="text-base font-bold text-on-surface font-display mb-3">
              Equipment Status
            </h2>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container border border-outline-variant/30">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-tertiary" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-on-surface leading-tight">Cable Cross #02</span>
                    <span className="text-[10px] text-outline">Pulley inspection</span>
                  </div>
                </div>
                <span className="text-[10px] text-tertiary font-bold">PENDING</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container border border-outline-variant/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-error" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-on-surface leading-tight">Treadmill #08</span>
                    <span className="text-[10px] text-outline">Motor calibration</span>
                  </div>
                </div>
                <span className="text-[10px] text-error font-bold">OFFLINE</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="w-full mt-2 py-1.5 px-3 rounded-lg bg-surface-container-high hover:bg-surface-bright text-secondary text-xs font-semibold transition-colors text-center"
          >
            Log Maintenance Ticket
          </button>
        </div>

        {/* [BOX 6: Wide 2x1 Bento Box] Revenue & Billing Snapshot */}
        <div className="xl:col-span-2 rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 flex flex-col justify-between shadow-lg relative overflow-hidden min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Financial Velocity
              </span>
              <h2 className="text-lg font-bold text-on-surface font-display">
                Revenue & Billing Terminal
              </h2>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-on-primary-container text-xs font-bold transition-all shadow-xs"
            >
              Retry Queued Debits
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
            <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col">
              <span className="text-[11px] text-on-surface-variant">Monthly Recurring (MRR)</span>
              <span className="text-2xl font-black text-on-surface tracking-tight mt-1 font-stat-metric">
                $94,280
              </span>
              <span className="text-[10px] text-primary font-bold mt-1">↑ +12.4% vs last mo</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col">
              <span className="text-[11px] text-on-surface-variant">Failed Payment Alerts</span>
              <span className="text-2xl font-black text-error tracking-tight mt-1 font-stat-metric">
                8
              </span>
              <span className="text-[10px] text-error-container mt-1 font-semibold">$1,420 recoverable</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col">
              <span className="text-[11px] text-on-surface-variant">Cleared Today</span>
              <span className="text-2xl font-black text-secondary tracking-tight mt-1 font-stat-metric">
                $4,185
              </span>
              <span className="text-[10px] text-outline mt-1 font-mono">Batch payout: 23:59 GST</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-outline-variant/20">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" /> Gateway: Nominal (99.99%)
            </span>
            <span className="text-primary hover:underline cursor-pointer">
              Detailed Financial Ledger →
            </span>
          </div>
        </div>
      </div>

      {/* Hardware Quote Request Modal */}
      {isHardwareQuoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-surface-container-low border border-outline-variant/50 p-6 shadow-2xl flex flex-col gap-4 text-on-surface">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                  Hardware Integration Add-on
                </span>
                <h3 className="text-lg font-bold font-display text-on-surface">
                  Request Automated Turnstile Gates Quote
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHardwareQuoteOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {quoteSubmitted ? (
              <div className="py-8 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-on-surface">Quote Request Received!</h4>
                <p className="text-xs text-on-surface-variant max-w-sm">
                  Our hardware engineering partner will reach out within 24 hours with certified turnstile specs (ZKTeco/Hikvision), site survey coordination, and turnkey installation pricing.
                </p>
                <button
                  type="button"
                  onClick={() => setIsHardwareQuoteOpen(false)}
                  className="mt-2 px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-on-primary-container text-xs font-bold transition-all"
                >
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuoteSubmitted(true);
                }}
                className="flex flex-col gap-3.5 text-xs"
              >
                <p className="text-[11px] text-on-surface-variant">
                  Phase 1 MVP runs on instant software desk scanning. Automated optical speed gates, flap barriers, and biometric turnstiles are available as an enterprise hardware add-on.
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-on-surface">Gate Type</label>
                  <select
                    value={quoteForm.gateType}
                    onChange={(e) => setQuoteForm({ ...quoteForm, gateType: e.target.value })}
                    className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-secondary"
                  >
                    <option value="speed_gate">Optical Speed Gate (Sleek Glass Swings - Recommended)</option>
                    <option value="tripod">Tripod Turnstile (Heavy Duty Floor Stanchion)</option>
                    <option value="flap_barrier">High-Throughput Flap Barrier</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-on-surface">Lanes Needed</label>
                    <select
                      value={quoteForm.lanes}
                      onChange={(e) => setQuoteForm({ ...quoteForm, lanes: e.target.value })}
                      className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-secondary"
                    >
                      <option value="1">1 Lane (Single Direction)</option>
                      <option value="2">2 Lanes (Bi-directional)</option>
                      <option value="4">4 Lanes (Multi-entry)</option>
                      <option value="6+">6+ Lanes (Large Chain)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-on-surface">Facility Branch</label>
                    <input
                      type="text"
                      value={quoteForm.branch}
                      onChange={(e) => setQuoteForm({ ...quoteForm, branch: e.target.value })}
                      className="p-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-secondary"
                      placeholder="e.g. Downtown Flagship"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-on-surface">Contact Phone (WhatsApp)</label>
                  <input
                    type="tel"
                    value={quoteForm.contactPhone}
                    onChange={(e) => setQuoteForm({ ...quoteForm, contactPhone: e.target.value })}
                    className="p-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-secondary"
                    placeholder="+971 50 123 4567"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-on-surface">Additional Facility Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={quoteForm.notes}
                    onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                    className="p-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-secondary resize-none"
                    placeholder="e.g. Glass entry doors, ADA wheelchair lane required..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setIsHardwareQuoteOpen(false)}
                    className="px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    Submit Hardware Quote Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
