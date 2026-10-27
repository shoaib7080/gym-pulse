import { useState } from 'react';
import {
  Users,
  Activity,
  ShieldCheck,
  Receipt,
  Search,
  Download,
  CheckCircle2,
  Clock,
  UploadCloud,
} from '../ui/icons';

interface MemberRecord {
  id: string;
  name: string;
  initials: string;
  tier: string;
  tierCategory: 'vip' | 'standard' | 'trial' | 'flagged';
  checkInTime: string;
  locker: string;
  passStatus: 'Verified' | 'Waiver Req.' | 'Badge Expired';
}

const MEMBERS_DATA: MemberRecord[] = [
  {
    id: '#GP-98214',
    name: 'Marcus Vance',
    initials: 'MV',
    tier: 'VIP Platinum',
    tierCategory: 'vip',
    checkInTime: '10:42 AM (38m ago)',
    locker: '#L-084',
    passStatus: 'Verified',
  },
  {
    id: '#GP-74112',
    name: 'Elena Rostova',
    initials: 'ER',
    tier: 'Standard Annual',
    tierCategory: 'standard',
    checkInTime: '11:05 AM (15m ago)',
    locker: '#L-112',
    passStatus: 'Verified',
  },
  {
    id: '#GP-31290',
    name: 'Devon Miller',
    initials: 'DM',
    tier: 'VIP Platinum',
    tierCategory: 'vip',
    checkInTime: '11:14 AM (6m ago)',
    locker: '#L-019',
    passStatus: 'Verified',
  },
  {
    id: '#GP-11002',
    name: 'Sophia Chen',
    initials: 'SC',
    tier: 'Free 7-Day Trial',
    tierCategory: 'trial',
    checkInTime: '11:18 AM (2m ago)',
    locker: 'No Locker',
    passStatus: 'Waiver Req.',
  },
  {
    id: '#GP-88301',
    name: 'Tariq Washington',
    initials: 'TW',
    tier: 'Standard Annual',
    tierCategory: 'standard',
    checkInTime: '11:19 AM (Just now)',
    locker: '#L-042',
    passStatus: 'Verified',
  },
  {
    id: '#GP-78902',
    name: 'Chloe Zhang',
    initials: 'CZ',
    tier: 'Standard Club',
    tierCategory: 'flagged',
    checkInTime: '11:22 AM (Pending)',
    locker: 'Unassigned',
    passStatus: 'Badge Expired',
  },
];

export function OperationsView() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'vip' | 'standard' | 'trial' | 'flagged'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = MEMBERS_DATA.filter((m) => {
    const matchesFilter = activeFilter === 'all' || m.tierCategory === activeFilter;
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.locker.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Secondary Horizontal Navigation / Operations Bar */}
      <section className="sticky top-0 z-20 w-full bg-surface-container-low/95 backdrop-blur-md px-6 py-2.5 border-b border-outline-variant/30 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <nav aria-label="Operations Tabs" className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs font-semibold shadow-xs"
            >
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Overview & Operations</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-xs font-medium"
            >
              <span>Membership Roster</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high text-[10px] text-outline font-mono">
                1,420
              </span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-xs font-medium"
            >
              <span>Branch Telemetry</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high text-[10px] text-outline">
                3 Sites
              </span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-xs font-medium"
            >
              <span>Compliance Audits</span>
              <span className="px-1.5 py-0.2 rounded-full bg-tertiary-container/30 text-tertiary text-[10px] font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />1 Action
              </span>
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-xs text-on-surface-variant border border-outline-variant/30">
              <Clock className="w-3.5 h-3.5 text-secondary" />
              <span>Today: Oct 26, 2026</span>
            </div>

            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Daily Log</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Flow */}
      <div className="w-full max-w-[1720px] mx-auto p-6 flex flex-col gap-6 min-w-0">
        {/* Operational KPI Ribbon */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Metric 1: Total Active Members */}
          <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Total Active Members
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-on-surface font-stat-metric">1,420</span>
                  <span className="text-xs font-bold text-primary flex items-center">
                    ↑ +48
                  </span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container text-primary">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Monthly Growth</span>
                <span className="font-semibold text-on-surface">96.2% Retention</span>
              </div>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '96.2%' }} />
              </div>
            </div>
          </div>

          {/* Metric 2: Live Occupancy */}
          <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Current Occupancy
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container/20 text-secondary text-[10px] font-bold uppercase">
                    <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-ping" />
                    Optimal
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-on-surface font-stat-metric">142</span>
                  <span className="text-xs text-on-surface-variant">/ 210 Cap</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container text-secondary">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Headcount Velocity</span>
                <span className="font-semibold text-secondary">67.6% Safe Load</span>
              </div>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: '67.6%' }} />
              </div>
            </div>
          </div>

          {/* Metric 3: Compliance & Health */}
          <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Facility Compliance
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-tertiary-container/25 text-tertiary text-[10px] font-bold">
                    Action Req.
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-on-surface font-stat-metric">
                    3 <span className="text-sm text-outline font-normal">of 4</span>
                  </span>
                  <span className="text-xs font-semibold text-tertiary">Review Active</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container text-tertiary">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Audit Cycle</span>
                <span className="font-semibold text-on-surface">Q4 Institutional</span>
              </div>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full mt-1.5 overflow-hidden flex gap-0.5">
                <div className="bg-primary h-full w-1/4 rounded-xs" />
                <div className="bg-primary h-full w-1/4 rounded-xs" />
                <div className="bg-primary h-full w-1/4 rounded-xs" />
                <div className="bg-tertiary h-full w-1/4 rounded-xs animate-pulse" />
              </div>
            </div>
          </div>

          {/* Metric 4: Daily Revenue */}
          <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Daily Turnstile Revenue
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-primary font-stat-metric">$4,850</span>
                  <span className="text-xs text-on-surface-variant">Today</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container text-primary">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>18 Subscriptions</span>
                <span className="font-semibold text-on-surface">6 PT Sessions booked</span>
              </div>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '82%' }} />
              </div>
            </div>
          </div>
        </section>

        {/* Two-Column Master Layout (65% / 35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0">
          {/* Left Column (8 cols): Active Member Directory & Turnstile Feed */}
          <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 shadow-sm min-w-0">
              {/* Header & Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <h2 className="text-lg font-bold text-on-surface font-display">
                      Active Member Directory & Turnstile Feed
                    </h2>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Live telemetry from turnstile scanner bank A & B
                  </p>
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by ID, Name, Locker..."
                    className="w-full bg-surface-container text-on-surface placeholder:text-outline text-xs pl-9 pr-3 py-2 rounded-lg border border-outline-variant/40 focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    activeFilter === 'all'
                      ? 'bg-primary text-on-primary-container shadow-xs'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  All ({MEMBERS_DATA.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('vip')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    activeFilter === 'vip'
                      ? 'bg-primary text-on-primary-container shadow-xs'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  VIP Platinum (2)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('standard')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    activeFilter === 'standard'
                      ? 'bg-primary text-on-primary-container shadow-xs'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Standard Pass (2)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('trial')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    activeFilter === 'trial'
                      ? 'bg-primary text-on-primary-container shadow-xs'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Free Trial (1)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('flagged')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    activeFilter === 'flagged'
                      ? 'bg-error text-on-error shadow-xs'
                      : 'bg-error-container/30 text-error hover:bg-error-container/40'
                  }`}
                >
                  Flagged (1)
                </button>
              </div>

              {/* Responsive Data Table */}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-on-surface-variant text-[11px] uppercase bg-surface-container/60">
                      <th className="py-3 px-4 rounded-l-lg font-bold">Member</th>
                      <th className="py-3 px-3 font-bold">Membership Tier</th>
                      <th className="py-3 px-3 font-bold">Check-In Time</th>
                      <th className="py-3 px-3 font-bold">Locker</th>
                      <th className="py-3 px-3 font-bold">Access Status</th>
                      <th className="py-3 px-4 rounded-r-lg text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {filteredMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-surface-container/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/50 flex items-center justify-center font-bold text-on-surface text-xs">
                              {m.initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-on-surface">{m.name}</span>
                              <span className="text-[10px] text-outline font-mono">{m.id}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                              m.tierCategory === 'vip'
                                ? 'bg-primary/15 text-primary'
                                : m.tierCategory === 'trial'
                                ? 'bg-secondary-container/20 text-secondary'
                                : m.tierCategory === 'flagged'
                                ? 'bg-error-container/30 text-error'
                                : 'bg-surface-container-high text-on-surface'
                            }`}
                          >
                            {m.tier}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-on-surface font-mono text-[11px]">
                          {m.checkInTime}
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-mono text-[10px]">
                            {m.locker}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              m.passStatus === 'Verified'
                                ? 'bg-primary/10 text-primary'
                                : m.passStatus === 'Waiver Req.'
                                ? 'bg-tertiary-container/20 text-tertiary'
                                : 'bg-error/15 text-error'
                            }`}
                          >
                            {m.passStatus === 'Verified' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : null}
                            {m.passStatus}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                          >
                            •••
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Table Strip */}
              <div className="mt-4 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-on-surface-variant border-t border-outline-variant/20">
                <span>Showing {filteredMembers.length} of {MEMBERS_DATA.length} on floor</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high text-xs font-semibold"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold"
                  >
                    View All Roster
                  </button>
                </div>
              </div>
            </div>

            {/* Multi-Site Branch Load & Capacity */}
            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 shadow-sm min-w-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-on-surface font-display">
                    Multi-Site Capacity & Load Balancing
                  </h3>
                  <p className="text-xs text-on-surface-variant">Real-time turnstile load distribution</p>
                </div>
                <span className="text-[10px] text-outline font-mono">Synchronized 12s ago</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface">Downtown Flagship</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <div className="my-2">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-on-surface-variant">Capacity</span>
                      <span className="font-bold text-on-surface">142 / 210 (67.6%)</span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: '67.6%' }} />
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface">Westside CrossFit</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/20 text-secondary font-bold">
                      HIGH
                    </span>
                  </div>
                  <div className="my-2">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-on-surface-variant">Capacity</span>
                      <span className="font-bold text-on-surface">184 / 200 (92%)</span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                      <div className="bg-secondary h-full rounded-full" style={{ width: '92%' }} />
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface">Uptown Spa Club</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-tertiary-container/20 text-tertiary font-bold">
                      AUDIT
                    </span>
                  </div>
                  <div className="my-2">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-on-surface-variant">Capacity</span>
                      <span className="font-bold text-on-surface">68 / 150 (45%)</span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                      <div className="bg-tertiary h-full rounded-full" style={{ width: '45%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Document Verification Queue & Gym Showcase */}
          <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
            {/* Document Queue */}
            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 shadow-sm min-w-0">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-tertiary" />
                  <h3 className="text-base font-bold text-on-surface font-display">
                    Platform Compliance
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary text-[10px] font-bold">
                  1 In Review
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mb-4">
                Upload institutional documents required by GymPulse HQ to keep turnstiles and merchant gateways active.
              </p>

              {/* Progress Bar */}
              <div className="bg-surface-container p-3 rounded-xl mb-4 border border-outline-variant/30">
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-2 font-medium">
                  <span className="text-primary font-bold">1. Uploaded</span>
                  <span className="text-tertiary font-bold">2. Under Review</span>
                  <span className="text-outline">3. Cleared</span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden flex">
                  <div className="bg-primary w-1/2 h-full" />
                  <div className="bg-tertiary w-1/4 h-full animate-pulse" />
                  <div className="bg-surface-variant w-1/4 h-full" />
                </div>
              </div>

              {/* Documents List */}
              <div className="flex flex-col gap-2.5">
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-tertiary text-lg">📄</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-on-surface truncate">
                        Liability_Coverage_2025.pdf
                      </span>
                      <span className="text-[10px] text-outline">Submitted 2h ago • 8.4 MB</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-tertiary-container/20 text-tertiary text-[10px] font-bold shrink-0">
                    HQ Reviewing
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-primary text-lg">✅</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-on-surface truncate">
                        Trainer_AED_Cert_Marcus.pdf
                      </span>
                      <span className="text-[10px] text-outline">Verified Oct 21 • 2.1 MB</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                    Approved
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="mt-4 w-full py-2.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-dashed border-outline-variant hover:border-primary transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer"
              >
                <UploadCloud className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-on-surface">Submit Verification Document</span>
                <span className="text-[10px] text-outline">PDF, PNG, JPG (Up to 25 MB)</span>
              </button>
            </div>

            {/* Gym Showcase Card */}
            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 shadow-sm min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-on-surface font-display">
                  Downtown Campus Showcase
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-secondary-container/20 text-secondary text-[10px] font-bold">
                  Public Live
                </span>
              </div>
              <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 mb-3">
                <div className="text-sm font-bold text-on-surface">Downtown Flagship Campus</div>
                <p className="text-xs text-secondary mt-0.5">8,200 sq. ft. • 4 Training Zones</p>
                <div className="mt-3 text-xs text-on-surface-variant space-y-1">
                  <div>🕒 05:00 AM – 11:00 PM Daily</div>
                  <div>📍 410 Grand Ave, Suite 100, Dubai, UAE</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px]">Sauna Suite</span>
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px]">Olympic Barbells</span>
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px]">Cryo Recovery</span>
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px]">Protein Bar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
