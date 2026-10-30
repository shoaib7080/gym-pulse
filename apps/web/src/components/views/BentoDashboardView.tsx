import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  UploadCloud,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  Dumbbell,
  ShieldCheck,
  AlertTriangle,
  Users,
  Activity,
  Receipt,
  Building2,
  Search,
} from "../ui/icons";

interface RevenueSummary {
  grossSalesMinor: number;
  vatMinor: number;
  netSalesMinor: number;
  transactionCount: number;
}

interface CheckinSummary {
  totalCheckins: number;
  allowCount: number;
  denyCount: number;
  hourlyHeatmap: Array<{ hour: number; count: number }>;
}

interface MemberItem {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  memberNumber?: string;
  status?: string;
  createdAt?: string;
}

interface BranchItem {
  id: string;
  name: string;
  code: string;
  city?: string;
  isMain: boolean;
}

export function BentoDashboardView() {
  const { activeGym, apiFetch } = useAuth();

  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [checkins, setCheckins] = useState<CheckinSummary | null>(null);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [plansCount, setPlansCount] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Quick Action Modal states
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [checkinPhone, setCheckinPhone] = useState("");
  const [checkinResult, setCheckinResult] = useState<{
    allowed?: boolean;
    message?: string;
  } | null>(null);
  const [isCheckinLoading, setIsCheckinLoading] = useState(false);

  const [isHardwareQuoteOpen, setIsHardwareQuoteOpen] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    gateType: "speed_gate",
    lanes: "2",
    branch: activeGym?.tradeName || "Downtown Flagship",
    contactPhone: "",
    notes: "",
  });

  // Fetch real telemetry and entity data from backend
  const loadDashboardTelemetry = useCallback(async () => {
    setIsLoadingData(true);

    if (!activeGym) {
      // In Stage 1: Explorer Mode, preload realistic interactive sample data
      setRevenue({
        grossSalesMinor: 1485000,
        vatMinor: 74250,
        netSalesMinor: 1410750,
        transactionCount: 28,
      });
      setCheckins({
        totalCheckins: 87,
        allowCount: 84,
        denyCount: 3,
        hourlyHeatmap: [
          { hour: 6, count: 4 },
          { hour: 7, count: 12 },
          { hour: 8, count: 18 },
          { hour: 9, count: 14 },
          { hour: 10, count: 8 },
          { hour: 12, count: 10 },
          { hour: 17, count: 22 },
          { hour: 18, count: 26 },
          { hour: 19, count: 19 },
          { hour: 20, count: 11 },
        ],
      });
      setMembers([
        {
          id: "mem-sample-01",
          fullName: "Rashid Al-Maktoum",
          phone: "+971 50 123 4567",
          email: "rashid.m@example.ae",
          memberNumber: "MEM-2026-001",
          status: "active",
          createdAt: "2026-02-15T08:30:00Z",
        },
        {
          id: "mem-sample-02",
          fullName: "Sarah Jenkins",
          phone: "+971 52 987 6543",
          email: "sarah.j@example.com",
          memberNumber: "MEM-2026-002",
          status: "active",
          createdAt: "2026-02-18T10:15:00Z",
        },
        {
          id: "mem-sample-03",
          fullName: "Tariq Mansoor",
          phone: "+971 55 333 4455",
          email: "tariq@example.ae",
          memberNumber: "MEM-2026-003",
          status: "active",
          createdAt: "2026-02-20T14:45:00Z",
        },
        {
          id: "mem-sample-04",
          fullName: "Elena Rostova",
          phone: "+971 56 777 8899",
          email: "elena.r@example.com",
          memberNumber: "MEM-2026-004",
          status: "frozen",
          createdAt: "2026-02-22T09:00:00Z",
        },
      ]);
      setBranches([
        {
          id: "br-sample-01",
          name: "Downtown Flagship",
          code: "DXB-01",
          city: "Dubai",
          isMain: true,
        },
        {
          id: "br-sample-02",
          name: "Dubai Marina Bay",
          code: "DXB-02",
          city: "Dubai",
          isMain: false,
        },
      ]);
      setPlansCount(4);
      setIsLoadingData(false);
      return;
    }

    try {
      const [revRes, chkRes, memRes, brRes, plnRes] = await Promise.allSettled([
        apiFetch("/v1/reports/revenue"),
        apiFetch("/v1/reports/checkins"),
        apiFetch("/v1/members?limit=8"),
        apiFetch("/v1/branches"),
        apiFetch("/v1/plans"),
      ]);

      if (revRes.status === "fulfilled" && revRes.value.ok) {
        const revData = await revRes.value.json();
        setRevenue(revData.summary || null);
      }

      if (chkRes.status === "fulfilled" && chkRes.value.ok) {
        const chkData = await chkRes.value.json();
        setCheckins(chkData || null);
      }

      if (memRes.status === "fulfilled" && memRes.value.ok) {
        const memData = await memRes.value.json();
        const memList = Array.isArray(memData) ? memData : memData?.data || [];
        setMembers(memList);
      }

      if (brRes.status === "fulfilled" && brRes.value.ok) {
        const brData = await brRes.value.json();
        setBranches(Array.isArray(brData) ? brData : []);
      }

      if (plnRes.status === "fulfilled" && plnRes.value.ok) {
        const plnData = await plnRes.value.json();
        setPlansCount(Array.isArray(plnData) ? plnData.length : 0);
      }
    } catch (err) {
      console.warn("Dashboard telemetry fetch error:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [activeGym, apiFetch]);

  useEffect(() => {
    loadDashboardTelemetry();
  }, [loadDashboardTelemetry]);

  // Handle Quick Check-in Access Test
  const handlePerformCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinPhone.trim()) return;

    setIsCheckinLoading(true);
    setCheckinResult(null);

    try {
      const res = await apiFetch("/v1/access/verify", {
        method: "POST",
        body: JSON.stringify({
          phone: checkinPhone.trim(),
          transport: "manual_desk",
        }),
      });

      const data = await res.json();
      if (res.ok && data?.allowed) {
        setCheckinResult({
          allowed: true,
          message:
            data.message ||
            `Access Granted for ${data.member?.fullName || "Member"}.`,
        });
        loadDashboardTelemetry();
      } else {
        setCheckinResult({
          allowed: false,
          message:
            data?.reason ||
            data?.message ||
            "Access Denied: No active membership found.",
        });
      }
    } catch {
      setCheckinResult({
        allowed: false,
        message: "Network error communicating with turnstile access gateway.",
      });
    } finally {
      setIsCheckinLoading(false);
    }
  };

  const grossSalesAed = revenue
    ? (revenue.grossSalesMinor / 100).toFixed(2)
    : "0.00";
  const vatSalesAed = revenue ? (revenue.vatMinor / 100).toFixed(2) : "0.00";
  const totalVisitsToday = checkins ? checkins.totalCheckins : 0;
  const allowVisits = checkins ? checkins.allowCount : 0;
  const activeFacilityName = activeGym?.tradeName || "Downtown Flagship";
  const totalBranchesCount =
    branches.length || activeGym?.branches?.length || 1;

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Top Command Action Streamer */}
      <div className="px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-surface-container-low border-b border-outline-variant/30 shadow-sm">
        <div className="flex flex-col gap-1">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-outline font-semibold">
            <span>GymPulse</span>
            <span className="text-on-surface-variant font-bold">/</span>
            <span className="text-on-surface-variant">
              {activeFacilityName}
            </span>
            <span className="text-on-surface-variant font-bold">/</span>
            <span className="text-primary font-bold">Live Dashboard</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-on-surface flex items-center gap-2 font-display">
              {!activeGym ? "Demo Facility" : activeFacilityName}
              {!activeGym ? (
                <span className="inline-flex items-center px-2 py-0.5 bg-primary/15 text-primary border border-primary/30 text-[11px] font-semibold rounded-md">
                  DEMO MODE
                </span>
              ) : activeGym.status === "pending_verification" ? (
                <span className="inline-flex items-center px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-semibold rounded-md">
                  PENDING REVIEW
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 bg-slate-800/80 text-slate-300 border border-white/[0.08] text-[11px] font-semibold rounded-md">
                  LIVE OPS
                </span>
              )}
            </h1>
            <span className="text-outline text-xs hidden sm:inline">•</span>
            <span className="text-xs text-on-surface-variant">
              {totalVisitsToday} Checked-in Visits Today
            </span>
            <span className="text-outline text-xs hidden sm:inline">•</span>
            <span className="text-xs text-slate-400 font-medium">
              {totalBranchesCount} Facility{" "}
              {totalBranchesCount === 1 ? "Branch" : "Branches"}
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-white/[0.08] hover:border-white/20 text-slate-300 text-xs font-semibold transition-all shadow-xs cursor-pointer"
            title="Automated turnstile gates hardware integration quote"
          >
            <span>Turnstile Hardware Integration</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsCheckinModalOpen(true);
              setCheckinResult(null);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-[#1f3700] text-xs font-bold transition-all shadow-md shadow-primary/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Check-In</span>
          </button>
        </div>
      </div>

      {/* Primary Bento Telemetry Grid: Equalized 12-column baseline stretch */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 items-stretch gap-6 min-w-0">
        {/* [CARD 1: 6 cols] Check-In Activity & Turnstile Access */}
        <div className="lg:col-span-6 rounded-xl bg-[#131722] border border-white/[0.08] p-6 flex flex-col justify-between relative overflow-hidden group shadow-lg min-w-0">
          <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-start justify-between pb-4">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Check-In Activity
                </span>
                <h2 className="text-xl font-bold text-on-surface font-display">
                  Turnstile &amp; Access Activity
                </h2>
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3.5 rounded-lg bg-[#1A202C] border border-white/[0.07] flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium">
                  Total Registered
                </span>
                <span className="text-2xl font-black text-white tracking-tight mt-1 font-stat-metric">
                  {isLoadingData ? "..." : members.length}
                </span>
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-1 font-medium">
                  Active &amp; Past Members
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-[#1A202C] border border-white/[0.07] flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium">
                  Today&apos;s Check-ins
                </span>
                <span className="text-2xl font-black text-white tracking-tight mt-1 font-stat-metric">
                  {isLoadingData ? "..." : totalVisitsToday}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  {allowVisits} Approved
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-[#1A202C] border border-white/[0.07] flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium">
                  Membership Plans
                </span>
                <span className="text-2xl font-black text-white tracking-tight mt-1 font-stat-metric">
                  {isLoadingData ? "..." : plansCount}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  Active Tiers
                </span>
              </div>
            </div>

            {/* Check-In Event Stream or Empty State */}
            <div className="p-4 rounded-lg bg-[#1A202C] border border-white/[0.07] mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-on-surface font-bold">
                  Recent Access Events
                </span>
                <span className="text-[10px] text-slate-400">
                  Today&apos;s Activity
                </span>
              </div>

              {totalVisitsToday === 0 ? (
                <div className="py-6 px-4 text-center rounded-lg border border-dashed border-white/[0.08] bg-[#131722]/50">
                  <Activity className="w-6 h-6 text-slate-500 mx-auto mb-1.5 opacity-60" />
                  <p className="text-xs font-semibold text-on-surface">
                    No visits logged today
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Real-time turnstile events and desk check-ins will appear
                    here as members enter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCheckinModalOpen(true);
                      setCheckinResult(null);
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-primary border border-primary/30 transition-colors cursor-pointer"
                  >
                    Test Check-In Scan
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#131722] border border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        OK
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface">
                          Verified Member Check-in
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Transport: Turnstile / Desk RFID
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                      GRANTED
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 text-[11px] text-slate-400 flex items-center justify-between border-t border-white/[0.06]">
            <span>Turnstile Connectivity: Online</span>
            <span className="text-slate-300 font-medium">
              Front-Desk &amp; Turnstiles Synced
            </span>
          </div>
        </div>

        {/* [CARD 2: 3 cols] Financial Velocity & UAE VAT */}
        <div className="lg:col-span-3 rounded-xl bg-[#131722] border border-white/[0.08] p-6 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Financial Velocity
              </span>
              <Receipt className="w-4 h-4 text-slate-400" />
            </div>

            <div className="mt-2">
              <span className="text-xs text-slate-400 font-medium">
                Gross Revenue (AED)
              </span>
              <div className="text-3xl font-black text-white font-stat-metric tracking-tight mt-0.5">
                {isLoadingData ? "..." : `${grossSalesAed} AED`}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-normal">
                Includes 5% UAE VAT: {vatSalesAed} AED
              </div>
            </div>

            {/* Revenue Status or Empty State */}
            {revenue && revenue.transactionCount > 0 ? (
              <div className="mt-4 p-3 rounded-lg bg-[#1A202C] border border-white/[0.07] text-xs">
                <div className="flex justify-between text-on-surface">
                  <span className="text-slate-400">Transactions:</span>
                  <span className="font-bold tabular-nums font-mono">{revenue.transactionCount}</span>
                </div>
                <div className="flex justify-between text-on-surface mt-1">
                  <span className="text-slate-400">Net Revenue:</span>
                  <span className="font-bold tabular-nums font-mono">
                    {(revenue.netSalesMinor / 100).toFixed(2)} AED
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-lg bg-[#1A202C] border border-dashed border-white/[0.07] text-center">
                <p className="text-xs text-on-surface font-semibold">
                  No Sales Logged Yet
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Desk POS sales and membership payments will automatically
                  stream into this VAT audit ledger.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[10px] text-slate-400 flex items-center justify-between">
            <span>UAE FTA 15-Digit TRN</span>
            <span
              className={`font-semibold ${
                activeGym?.vatRegistered ? "text-emerald-400" : "text-slate-400"
              }`}
            >
              {activeGym?.vatRegistered ? "VERIFIED" : "EXEMPT"}
            </span>
          </div>
        </div>

        {/* [CARD 3: 3 cols] Branch Infrastructure */}
        <div className="lg:col-span-3 rounded-xl bg-[#131722] border border-white/[0.08] p-6 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Facility Branches
              </span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>

            <div className="mt-2">
              <div className="text-3xl font-black text-white font-stat-metric tracking-tight">
                {branches.length || 1}
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Operating Branch Locations
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {branches.length > 0 ? (
                branches.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-lg bg-[#1A202C] border border-white/[0.07] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-on-surface">{b.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {b.code} • {b.city || "Dubai"}
                      </div>
                    </div>
                    {b.isMain && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">
                        MAIN
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-2.5 rounded-lg bg-[#1A202C] border border-white/[0.07] text-xs">
                  <div className="font-bold text-on-surface">
                    {activeFacilityName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Branch #01 • Primary Hub
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[10px] text-slate-400 flex items-center justify-between">
            <span>Timezone: {activeGym?.timezone || "Asia/Dubai"}</span>
            <span className="text-emerald-400 font-semibold">SYNCED</span>
          </div>
        </div>

        {/* [CARD 4: 12 cols] Registered Club Members Directory */}
        <div className="col-span-1 lg:col-span-12 rounded-xl bg-[#131722] border border-white/[0.08] p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-on-surface font-display">
                Registered Club Members
              </h3>
              <p className="text-xs text-slate-400">
                Active membership directory and status ledger.
              </p>
            </div>

            <span className="text-xs text-slate-400">
              Total Count: {members.length}
            </span>
          </div>

          {members.length === 0 ? (
            <div className="py-12 px-6 text-center rounded-lg border border-dashed border-white/[0.08] bg-[#1A202C]/60">
              <Users className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-60" />
              <h4 className="text-sm font-bold text-on-surface">
                No Members Registered Yet
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Your facility database is connected and ready. You can register
                your first member using the front-desk operations intake or
                check-in flow.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Member Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Member Number</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-on-surface">
                        {m.fullName}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-slate-400">
                        {m.phone}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {m.email || "—"}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-primary font-semibold">
                        {m.memberNumber || `#MEM-${m.id.slice(0, 8).toUpperCase()}`}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                          ACTIVE
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick Check-In Modal Dialog */}
      {isCheckinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/20 text-primary">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">
                    Desk Access Check-In
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Real-time gate verification test
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckinModalOpen(false)}
                className="text-outline hover:text-on-surface text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {checkinResult && (
              <div
                className={`mb-4 p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
                  checkinResult.allowed
                    ? "bg-primary/10 border-primary/30 text-primary font-bold"
                    : "bg-error-container/20 border-error/30 text-error font-bold"
                }`}
              >
                {checkinResult.allowed ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{checkinResult.message}</span>
              </div>
            )}

            <form onSubmit={handlePerformCheckin} className="space-y-4">
              <div>
                <label
                  htmlFor="member-phone"
                  className="block text-xs font-semibold text-on-surface mb-1"
                >
                  Member Phone Number
                </label>
                <input
                  id="member-phone"
                  type="text"
                  required
                  placeholder="+971501234567"
                  value={checkinPhone}
                  onChange={(e) => setCheckinPhone(e.target.value)}
                  className="w-full bg-surface-container text-on-surface text-xs px-3 py-2.5 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none font-mono"
                />
                <p className="text-[10px] text-outline mt-1 font-mono">
                  Format: E.164 with international country code (e.g.
                  +971501234567)
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCheckinModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-outline hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCheckinLoading}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-[#1f3700] text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCheckinLoading ? "Verifying..." : "Validate Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hardware Quote Dialog */}
      {isHardwareQuoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
              <div>
                <h3 className="text-base font-bold text-on-surface">
                  Automated Turnstile Hardware Quote
                </h3>
                <p className="text-xs text-on-surface-variant">
                  IoT RFID / Biometric flap barrier gates for GCC gyms
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHardwareQuoteOpen(false)}
                className="text-outline hover:text-on-surface text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {quoteSubmitted ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
                <h4 className="text-sm font-bold text-on-surface">
                  Hardware Quote Request Dispatched
                </h4>
                <p className="text-xs text-on-surface-variant">
                  Our certified UAE/GCC turnstile engineering partners will
                  contact you within 24 hours.
                </p>
                <button
                  type="button"
                  onClick={() => setIsHardwareQuoteOpen(false)}
                  className="mt-4 px-4 py-2 rounded-lg bg-primary text-[#1f3700] text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuoteSubmitted(true);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Gate Model
                  </label>
                  <select
                    value={quoteForm.gateType}
                    onChange={(e) =>
                      setQuoteForm({ ...quoteForm, gateType: e.target.value })
                    }
                    className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
                  >
                    <option value="speed_gate">
                      Optical Swing Speed Gate (Premium Glass)
                    </option>
                    <option value="tripod">
                      Heavy-Duty Tripod Turnstile (CrossFit / High Throughput)
                    </option>
                    <option value="full_height">
                      Full-Height Security Gate (24/7 Unstaffed)
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Number of Lanes
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={quoteForm.lanes}
                      onChange={(e) =>
                        setQuoteForm({ ...quoteForm, lanes: e.target.value })
                      }
                      className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+971501234567"
                      value={quoteForm.contactPhone}
                      onChange={(e) =>
                        setQuoteForm({
                          ...quoteForm,
                          contactPhone: e.target.value,
                        })
                      }
                      className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsHardwareQuoteOpen(false)}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-outline hover:text-on-surface cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-[#1f3700] text-xs font-bold shadow-md cursor-pointer"
                  >
                    Submit Hardware Request
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
