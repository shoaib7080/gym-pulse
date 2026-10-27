import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Users,
} from '../ui/icons';

interface AuditDoc {
  docType: string;
  uploadDate: string;
  fileName: string;
  fileHash: string;
  reviewer: string;
  state: 'Pending Review' | 'Approved & Sealed' | 'Re-upload Needed';
}

const AUDIT_DOCS: AuditDoc[] = [
  {
    docType: 'General Commercial Liability (2025)',
    uploadDate: 'Today, 10:14 AM',
    fileName: 'GCL-Flagship-2025-v2.pdf',
    fileHash: 'SHA256: 8f4c...91b2',
    reviewer: 'Platform Admin Team (Queue 4)',
    state: 'Pending Review',
  },
  {
    docType: 'Fire Safety & AED Certification',
    uploadDate: 'Jan 15, 2026',
    fileName: 'AED-CityCompliance-Cert.pdf',
    fileHash: 'SHA256: 3a9e...771e',
    reviewer: 'Chief Compliance Officer',
    state: 'Approved & Sealed',
  },
  {
    docType: 'Staff CPR & First Aid Collective Ledger',
    uploadDate: 'Jan 08, 2026',
    fileName: 'CPR-StaffRoster-Q1.pdf',
    fileHash: 'SHA256: 11bb...dd40',
    reviewer: 'Platform Admin Team (Auditor #09)',
    state: 'Re-upload Needed',
  },
];

export function ComplianceView() {
  return (
    <div className="flex flex-col w-full pb-12 p-6 gap-6 min-w-0">
      {/* Top Stage Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-low border border-outline-variant/30 p-6 shadow-lg rounded-2xl relative overflow-hidden min-w-0">
        <div className="flex flex-col gap-1 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-primary font-bold">
              Facility Operations Suite
            </span>
            <span className="text-outline">•</span>
            <div className="flex items-center gap-1 text-on-surface-variant text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span>Last sync: Just now</span>
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-on-surface tracking-tight font-display">
            Downtown Flagship Admin Console
          </h1>
          <p className="text-xs text-on-surface-variant max-w-xl">
            Real-time telemetry, entry credential enforcement, automated risk mitigation, and enterprise compliance ledger for Branch #01.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 flex-wrap">
          <button
            type="button"
            className="flex items-center gap-2 bg-surface-container-high hover:bg-surface-bright text-on-surface px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-secondary" />
            <span>Upload Verification Doc</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-on-primary-container px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <span>+ Register New Member</span>
          </button>
        </div>
      </div>

      {/* Top Section: 3 Comprehensive Focus Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Card A: Membership Velocity & Churn Control */}
        <div className="bg-surface-container-low border border-outline-variant/30 p-6 rounded-2xl flex flex-col justify-between shadow-md min-w-0">
          <div>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-outline">
                  Retention Telemetry
                </span>
                <h2 className="text-base font-bold text-on-surface font-display">
                  Membership Velocity & Churn
                </h2>
              </div>
              <div className="p-2 rounded-xl bg-surface-container text-primary">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="my-4 flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-black text-on-surface font-stat-metric">1,420</span>
                <span className="text-xs text-outline ml-1">Total Active</span>
              </div>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                ↑ +34 this week
              </span>
            </div>

            {/* Micro Telemetry Bar */}
            <div className="flex items-center gap-1 h-3 w-full mb-4 bg-surface-container rounded-full p-0.5 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: '78%' }} title="Active (78%)" />
              <div className="h-full bg-tertiary-container rounded-full" style={{ width: '14%' }} title="Grace (14%)" />
              <div className="h-full bg-error rounded-full" style={{ width: '8%' }} title="At Risk (8%)" />
            </div>

            {/* Churn Breakdown */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-container/60 rounded-xl border border-outline-variant/20">
              <div>
                <span className="text-[10px] text-outline uppercase font-semibold">Grace Period</span>
                <div className="text-sm font-bold text-tertiary mt-0.5">6 Members</div>
              </div>
              <div>
                <span className="text-[10px] text-outline uppercase font-semibold">Pending Cancel</span>
                <div className="text-sm font-bold text-error mt-0.5">2 Requests</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="w-full mt-4 py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-bright text-secondary text-xs font-semibold transition-colors cursor-pointer"
          >
            Deploy Retention Offer (2 at-risk)
          </button>
        </div>

        {/* Card B: Platform Verification & Compliance Center */}
        <div className="bg-surface-container-low border border-outline-variant/30 p-6 rounded-2xl flex flex-col justify-between shadow-md min-w-0">
          <div>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-outline">
                  Legal & Sanctions
                </span>
                <h2 className="text-base font-bold text-on-surface font-display">
                  Compliance Center
                </h2>
              </div>
              <div className="p-2 rounded-xl bg-surface-container text-tertiary">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="my-3 bg-surface-container p-3 rounded-xl border border-outline-variant/30">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-tertiary font-bold uppercase text-[10px]">Routine Review Active</span>
                <span className="text-outline text-[10px]">Q2 Cycle</span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Annual liability policies and commercial permits are under routine review by Platform Admin.
              </p>
            </div>

            <div className="flex flex-col gap-1 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface font-semibold">Requirements Cleared</span>
                <span className="text-primary font-bold">3 of 4 Complete</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '75%' }} />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="w-full py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface text-xs font-semibold transition-colors flex items-center justify-between"
          >
            <span>Submit Supplemental Doc</span>
            <span className="text-[10px] text-outline font-mono">PDF/PNG</span>
          </button>
        </div>

        {/* Card C: Facility Status & Gym Profile */}
        <div className="bg-surface-container-low border border-outline-variant/30 p-6 rounded-2xl flex flex-col justify-between shadow-md min-w-0">
          <div>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-outline">
                  Marketplace Showcase
                </span>
                <h2 className="text-base font-bold text-on-surface font-display">
                  Facility Status & Profile
                </h2>
              </div>
              <div className="p-2 rounded-xl bg-surface-container text-secondary">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="my-3 flex items-center justify-between bg-surface-container p-4 rounded-xl border border-outline-variant/30">
              <div className="flex flex-col">
                <span className="text-3xl font-black text-primary font-stat-metric">92%</span>
                <span className="text-xs font-bold text-on-surface">Profile Completeness</span>
                <span className="text-[10px] text-outline">Boosts SEO ranking +24%</span>
              </div>

              {/* Radial Completion Indicator */}
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-surface-container-highest"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="text-primary"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray="92, 100"
                    strokeLinecap="round"
                    strokeWidth="3"
                  />
                </svg>
                <span className="text-primary text-xs font-bold absolute">✨</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="py-1.5 px-2 bg-surface-container hover:bg-surface-bright text-on-surface rounded-lg text-[11px] font-semibold text-center transition-colors truncate"
            >
              Amenities
            </button>
            <button
              type="button"
              className="py-1.5 px-2 bg-surface-container hover:bg-surface-bright text-on-surface rounded-lg text-[11px] font-semibold text-center transition-colors truncate"
            >
              Trainer Bios
            </button>
            <button
              type="button"
              className="py-1.5 px-2 bg-surface-container hover:bg-surface-bright text-on-surface rounded-lg text-[11px] font-semibold text-center transition-colors truncate"
            >
              Hours
            </button>
          </div>
        </div>
      </section>

      {/* Platform Admin Verification Queue & History */}
      <section className="bg-surface-container-low border border-outline-variant/30 p-6 rounded-2xl shadow-lg flex flex-col gap-4 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface font-display">
                Platform Admin Verification Queue & History
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-outline text-[10px]">
                Audited
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Archived compliance filings, municipal health permits, and trainer insurance certificates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-outline">Showing 3 of 18 records</span>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface text-xs font-semibold transition-colors"
            >
              View Audit Vault
            </button>
          </div>
        </div>

        {/* Verification Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container text-outline text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 rounded-l-lg font-bold">Document Type</th>
                <th className="py-3 px-4 font-bold">Upload Date</th>
                <th className="py-3 px-4 font-bold">File Hash / Name</th>
                <th className="py-3 px-4 font-bold">Assigned Reviewer</th>
                <th className="py-3 px-4 font-bold">Verification State</th>
                <th className="py-3 px-4 rounded-r-lg text-right font-bold">Audit Trail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {AUDIT_DOCS.map((doc, idx) => (
                <tr key={idx} className="hover:bg-surface-container/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-on-surface">
                    {doc.docType}
                  </td>
                  <td className="py-3.5 px-4 text-on-surface-variant font-mono">
                    {doc.uploadDate}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-mono text-xs text-on-surface">{doc.fileName}</div>
                    <div className="font-mono text-[10px] text-outline">{doc.fileHash}</div>
                  </td>
                  <td className="py-3.5 px-4 text-on-surface-variant">
                    {doc.reviewer}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        doc.state === 'Approved & Sealed'
                          ? 'bg-primary/15 text-primary'
                          : doc.state === 'Pending Review'
                          ? 'bg-tertiary-container/20 text-tertiary'
                          : 'bg-error/15 text-error'
                      }`}
                    >
                      {doc.state === 'Approved & Sealed' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {doc.state}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-bright text-secondary text-xs font-semibold transition-colors cursor-pointer"
                    >
                      View Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
