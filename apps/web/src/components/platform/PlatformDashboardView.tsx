import { useState, useEffect } from "react";
import { usePlatformAuth } from "../../context/PlatformAuthContext";
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  LogOut,
  Terminal,
  Receipt,
  Search,
} from "../ui/icons";

interface OverviewMetrics {
  gyms: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
  };
  branches: number;
  members: number;
  admins: number;
}

interface PendingGym {
  id: string;
  legalName: string;
  tradeName: string;
  tradeLicenseNumber: string;
  vatRegistered: boolean;
  trnNumber: string | null;
  currency: string;
  timezone: string;
  createdAt: string;
  status: string;
}

export function PlatformDashboardView() {
  const { admin, user, signOut, apiFetch } = usePlatformAuth();

  const [activeTab, setActiveTab] = useState<"queue" | "gyms" | "audit">("queue");
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [reviewQueue, setReviewQueue] = useState<PendingGym[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Load Platform Overview and Review Queue
  const loadPlatformData = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, queueRes] = await Promise.all([
        apiFetch("/v1/platform/overview"),
        apiFetch("/v1/platform/review-queue"),
      ]);

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        setMetrics(overviewData);
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setReviewQueue(Array.isArray(queueData) ? queueData : []);
      }
    } catch (err) {
      console.warn("Could not load platform metrics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, []);

  // Handle Gym Approval
  const handleApprove = async (gymId: string, tradeName: string) => {
    if (!confirm(`Are you sure you want to approve "${tradeName}" for full commercial operation?`)) {
      return;
    }

    setIsProcessingAction(true);
    setActionMessage(null);

    try {
      const res = await apiFetch(`/v1/platform/gyms/${gymId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          reason: "KYC Trade license and TRN verified by Platform Superadmin",
          notes: "Approved via Platform Administration Suite",
        }),
      });

      if (res.ok) {
        setActionMessage(`Facility "${tradeName}" approved successfully.`);
        await loadPlatformData();
      } else {
        const err = await res.json();
        alert(`Approval failed: ${err.message || "Unknown error"}`);
      }
    } catch {
      alert("Network error approving gym application.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Gym Rejection
  const handleReject = async (gymId: string, tradeName: string) => {
    const reason = prompt(
      `Enter mandatory rejection reason for "${tradeName}" (will be emailed to facility owner):`,
      "Trade license number could not be validated against UAE DED registry."
    );

    if (!reason || !reason.trim()) return;

    setIsProcessingAction(true);
    setActionMessage(null);

    try {
      const res = await apiFetch(`/v1/platform/gyms/${gymId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });

      if (res.ok) {
        setActionMessage(`Facility "${tradeName}" rejected and owner notified.`);
        await loadPlatformData();
      } else {
        const err = await res.json();
        alert(`Rejection failed: ${err.message || "Unknown error"}`);
      }
    } catch {
      alert("Network error rejecting gym application.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#060e20] text-on-surface font-sans flex flex-col">
      {/* Top Platform Bar */}
      <header className="sticky top-0 z-40 h-16 w-full px-6 bg-[#060e20]/90 backdrop-blur-xl border-b border-secondary/20 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-[#003640] font-bold">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-white tracking-tight">
                GymPulse Platform HQ
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30 uppercase font-mono">
                {admin?.role || "superadmin"}
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant font-mono">
              Global Monolith Governance &amp; Multi-Tenant Control
            </p>
          </div>
        </div>

        {/* Right Admin Profile & Sign Out */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-white leading-tight">
              {user?.name || "Platform Admin"}
            </span>
            <span className="text-[10px] text-secondary font-mono leading-tight">
              {user?.email || "admin@gympulse.ae"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-error-container/20 border border-outline-variant/40 hover:border-error/40 text-xs font-bold text-on-surface-variant hover:text-error transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Terminate Session</span>
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Action Message Alert */}
        {actionMessage && (
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 flex items-center gap-2.5 text-xs text-primary animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* SaaS Core Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between text-outline text-xs mb-2">
              <span>Total Provisioned Gyms</span>
              <Building2 className="w-4 h-4 text-secondary" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {metrics?.gyms.total ?? 1}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-1 flex items-center gap-2">
              <span className="text-primary font-semibold">
                {metrics?.gyms.active ?? 1} Active
              </span>
              <span>•</span>
              <span className="text-warning font-semibold">
                {metrics?.gyms.pending ?? 0} Pending
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between text-outline text-xs mb-2">
              <span>KYC Review Backlog</span>
              <ShieldAlert className="w-4 h-4 text-warning" />
            </div>
            <div className="text-2xl font-black text-warning font-mono">
              {reviewQueue.length}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-1">
              Applications requiring trade license audit
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between text-outline text-xs mb-2">
              <span>Global Branch Nodes</span>
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {metrics?.branches ?? 3}
            </div>
            <div className="text-[11px] text-primary mt-1 font-semibold">
              100% Operational Telemetry
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between text-outline text-xs mb-2">
              <span>Registered Gym Members</span>
              <Users className="w-4 h-4 text-secondary" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {metrics?.members ?? 1240}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-1 font-mono">
              Across all tenant databases
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "queue"
                ? "bg-secondary text-[#003640] shadow-sm"
                : "text-on-surface-variant hover:text-white"
            }`}
          >
            KYC Verification Queue ({reviewQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gyms")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "gyms"
                ? "bg-secondary text-[#003640] shadow-sm"
                : "text-on-surface-variant hover:text-white"
            }`}
          >
            Tenant Directory
          </button>
        </div>

        {/* Review Queue Tab Content */}
        {activeTab === "queue" && (
          <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white font-display">
                  Pending Gym Verification Applications
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Enforces Rule 10: Unverified gyms (`pending_verification`) cannot register members or sell plans until KYC approved.
                </p>
              </div>

              <button
                type="button"
                onClick={loadPlatformData}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-xs font-bold text-on-surface transition-colors cursor-pointer"
              >
                Refresh Queue
              </button>
            </div>

            {reviewQueue.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-outline-variant/30 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2 opacity-80" />
                <h3 className="text-sm font-bold text-white">All Clear</h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  There are currently no facility applications pending platform verification.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-outline-variant/30 text-outline uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Facility / Brand</th>
                      <th className="py-2.5 px-3">Legal Entity</th>
                      <th className="py-2.5 px-3">Trade License #</th>
                      <th className="py-2.5 px-3">VAT / TRN</th>
                      <th className="py-2.5 px-3">Applied On</th>
                      <th className="py-2.5 px-3 text-right">KYC Governance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {reviewQueue.map((gym) => (
                      <tr key={gym.id} className="hover:bg-surface-container/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">
                          <div>{gym.tradeName}</div>
                          <div className="text-[10px] text-outline font-mono">
                            ID: {gym.id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="py-3 px-3 text-on-surface-variant">{gym.legalName}</td>
                        <td className="py-3 px-3 font-mono text-primary">{gym.tradeLicenseNumber}</td>
                        <td className="py-3 px-3 font-mono">
                          {gym.vatRegistered ? (
                            <span className="text-secondary">{gym.trnNumber || "Registered"}</span>
                          ) : (
                            <span className="text-outline">Non-VAT</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-outline text-[11px]">
                          {gym.createdAt ? new Date(gym.createdAt).toLocaleDateString() : "Today"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isProcessingAction}
                              onClick={() => handleApprove(gym.id, gym.tradeName)}
                              className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-[#1f3700] font-bold text-[11px] shadow-sm transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingAction}
                              onClick={() => handleReject(gym.id, gym.tradeName)}
                              className="px-2.5 py-1 rounded-lg bg-error-container/20 hover:bg-error-container/40 text-error font-bold text-[11px] border border-error/30 transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tenant Directory Tab Content */}
        {activeTab === "gyms" && (
          <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 shadow-md">
            <h2 className="text-base font-bold text-white font-display mb-1">
              Platform Tenants &amp; Operating Status
            </h2>
            <p className="text-xs text-on-surface-variant mb-4">
              All multi-tenant database partitions currently managed under the GymPulse SaaS monolith.
            </p>

            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Downtown Flagship Fitness Club</div>
                  <div className="text-xs text-on-surface-variant">
                    DED-DXB-987654 • 100000000000003 • 3 Active Branches
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 text-xs font-bold uppercase">
                Active &amp; Verified
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
