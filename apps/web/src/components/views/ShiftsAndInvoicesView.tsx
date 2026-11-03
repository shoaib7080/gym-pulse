import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  DollarSign,
  Building2,
  X,
  ArrowRight,
  ShieldCheck,
  Activity,
  Users,
} from '../ui/icons';

interface ShiftItem {
  id: string;
  gymId: string;
  branchId: string;
  openedBy: string;
  openedAt: string;
  closedBy?: string | null;
  closedAt?: string | null;
  status: 'open' | 'closed';
  openingCashMinor: number;
  expectedCashMinor?: number | null;
  actualCashMinor?: number | null;
  cashSalesMinor?: number | null;
  varianceMinor?: number | null;
  varianceReason?: string | null;
  isVarianceApproved?: boolean;
  branchName?: string;
  openedByName?: string;
}

interface InvoiceItem {
  id: string;
  gymId: string;
  paymentId?: string | null;
  docType: 'tax_invoice' | 'simplified_tax_invoice' | 'credit_note' | 'receipt';
  series: string;
  number: number;
  invoiceNumber: string;
  issuedOn: string;
  currency: string;
  createdAt: string;
  supplier: {
    name?: string;
    trn?: string;
  };
  buyer: {
    name?: string;
    phone?: string;
    email?: string;
  };
  totals: {
    totalMinor: number;
    baseMinor: number;
    vatMinor: number;
    vatRateBps: number;
    currency: string;
  };
  lines?: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }>;
}

interface BranchOption {
  id: string;
  name: string;
}

export function ShiftsAndInvoicesView() {
  const { activeGym, user, userRole, apiFetch } = useAuth();
  const isOwnerOrManager = userRole === 'owner' || userRole === 'manager';
  const currency = activeGym?.currency || 'AED';

  // Sub-tabs: 'shifts' or 'invoices'
  const [activeTab, setActiveTab] = useState<'shifts' | 'invoices'>('shifts');

  // Shifts state
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [currentShift, setCurrentShift] = useState<ShiftItem | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);

  // Invoices state
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);

  // Modals
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isApproveVarianceModalOpen, setIsApproveVarianceModalOpen] = useState(false);
  const [selectedShiftForApproval, setSelectedShiftForApproval] = useState<ShiftItem | null>(null);

  // Form states - Open Shift
  const [openBranchId, setOpenBranchId] = useState('');
  const [openCashFloat, setOpenCashFloat] = useState('200.00');
  const [isSubmittingOpen, setIsSubmittingOpen] = useState(false);

  // Form states - Close Shift
  const [closingCashCount, setClosingCashCount] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);

  // Form states - Approve Variance
  const [managerPin, setManagerPin] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Banners
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  // Fetch branches
  const fetchBranches = useCallback(async () => {
    try {
      const res = await apiFetch('/v1/branches');
      if (res.ok) {
        const data = await res.json();
        const list: BranchOption[] = Array.isArray(data) ? data : [];
        setBranches(list);
        if (list.length > 0 && !openBranchId) {
          setOpenBranchId(list[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, [apiFetch, openBranchId]);

  // Fetch shifts (current active shift + past shifts)
  const fetchShiftsData = useCallback(async () => {
    setIsLoadingShifts(true);
    try {
      const [currentRes, listRes] = await Promise.allSettled([
        apiFetch('/v1/shifts/current'),
        apiFetch('/v1/shifts?limit=50'),
      ]);

      if (currentRes.status === 'fulfilled' && currentRes.value.ok) {
        const cData = await currentRes.value.json();
        setCurrentShift(cData?.id ? cData : null);
      } else {
        setCurrentShift(null);
      }

      if (listRes.status === 'fulfilled' && listRes.value.ok) {
        const lData = await listRes.value.json();
        const rawList: ShiftItem[] = Array.isArray(lData) ? lData : [];
        setShifts(rawList);
      } else {
        setShifts([]);
      }
    } catch (err) {
      console.warn('Failed to load shifts:', err);
    } finally {
      setIsLoadingShifts(false);
    }
  }, [apiFetch]);

  // Fetch invoices
  const fetchInvoicesData = useCallback(async () => {
    setIsLoadingInvoices(true);
    try {
      const res = await apiFetch('/v1/payments/invoices?limit=100');
      if (res.ok) {
        const data = await res.json();
        const list: InvoiceItem[] = Array.isArray(data) ? data : [];
        setInvoices(list);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.warn('Failed to load invoices:', err);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (activeTab === 'shifts') {
      fetchShiftsData();
    } else {
      fetchInvoicesData();
    }
  }, [activeTab, fetchShiftsData, fetchInvoicesData]);

  // Open Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError(null);
    setAlertSuccess(null);

    const openingCash = Math.round(parseFloat(openCashFloat || '0') * 100);
    if (isNaN(openingCash) || openingCash < 0) {
      setAlertError('Please enter a valid opening cash float.');
      return;
    }

    setIsSubmittingOpen(true);
    try {
      const res = await apiFetch('/v1/shifts/open', {
        method: 'POST',
        body: JSON.stringify({
          branchId: openBranchId || branches[0]?.id,
          openingCashMinor: openingCash,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAlertSuccess('Shift opened successfully! Cash drawer is now ready for operations.');
        setIsOpenShiftModalOpen(false);
        await fetchShiftsData();
      } else {
        setAlertError(data?.message || 'Failed to open shift.');
      }
    } catch {
      setAlertError('Network error while opening shift.');
    } finally {
      setIsSubmittingOpen(false);
    }
  };

  // Close Shift & Reconcile
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    setAlertError(null);
    setAlertSuccess(null);

    const actualCount = Math.round(parseFloat(closingCashCount || '0') * 100);
    if (isNaN(actualCount) || actualCount < 0) {
      setAlertError('Please enter the counted cash amount in drawer.');
      return;
    }

    setIsSubmittingClose(true);
    try {
      const res = await apiFetch(`/v1/shifts/${currentShift.id}/close`, {
        method: 'POST',
        body: JSON.stringify({
          actualCashMinor: actualCount,
          varianceReason: varianceReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const diffMinor = data.varianceMinor || 0;
        const diffAed = (diffMinor / 100).toFixed(2);
        if (diffMinor === 0) {
          setAlertSuccess('Shift closed with perfect zero variance! Drawer reconciled.');
        } else {
          setAlertSuccess(`Shift closed. Drawer variance: ${diffAed} ${currency} recorded for review.`);
        }
        setIsCloseShiftModalOpen(false);
        setClosingCashCount('');
        setVarianceReason('');
        await fetchShiftsData();
      } else {
        setAlertError(data?.message || 'Failed to close shift.');
      }
    } catch {
      setAlertError('Network error while closing shift.');
    } finally {
      setIsSubmittingClose(false);
    }
  };

  // Approve Shift Variance
  const handleApproveVariance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftForApproval) return;
    setAlertError(null);
    setAlertSuccess(null);

    if (!managerPin || managerPin.length < 4) {
      setAlertError('Please enter your 4-digit manager PIN to approve this closeout.');
      return;
    }

    setIsSubmittingApproval(true);
    try {
      const res = await apiFetch(`/v1/shifts/${selectedShiftForApproval.id}/approve`, {
        method: 'POST',
        headers: {
          'x-manager-pin': managerPin,
        },
        body: JSON.stringify({
          approved: true,
          notes: 'Variance verified by manager on duty.',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAlertSuccess('Shift variance approved and sealed in audit log.');
        setIsApproveVarianceModalOpen(false);
        setSelectedShiftForApproval(null);
        setManagerPin('');
        await fetchShiftsData();
      } else {
        setAlertError(data?.message || 'Failed to approve variance.');
      }
    } catch {
      setAlertError('Network error while approving shift variance.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    const q = invoiceSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.buyer?.name && inv.buyer.name.toLowerCase().includes(q)) ||
      (inv.buyer?.phone && inv.buyer.phone.toLowerCase().includes(q)) ||
      inv.docType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col w-full pb-16 font-sans">
      {/* Top Header */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131722] border-b border-[#2A3241] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            <span>{activeGym?.tradeName || 'GymPulse'}</span>
            <span className="text-slate-600">/</span>
            <span className="text-[#D4FF00] font-bold">Financial Records &amp; Register</span>
          </div>
          <h1 className="text-xl font-bold text-white font-display mt-0.5 flex items-center gap-2">
            <span>Shifts, Cash &amp; Invoices</span>
            {currentShift ? (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Shift Open
              </span>
            ) : (
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-[#1E2430] border border-[#2A3241] text-slate-400">
                Register Closed
              </span>
            )}
          </h1>
        </div>

        {/* Tab Switcher & Quick Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg bg-[#1A202C] border border-[#2A3241] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('shifts')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'shifts'
                  ? 'bg-[#1E2430] text-white border border-[#2A3241]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cashier Shifts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-[#1E2430] text-white border border-[#2A3241]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tax Invoices &amp; Receipts
            </button>
          </div>

          {activeTab === 'shifts' && (
            currentShift ? (
              <button
                type="button"
                onClick={() => {
                  setIsCloseShiftModalOpen(true);
                  setAlertError(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer"
              >
                End Current Shift
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsOpenShiftModalOpen(true);
                  setAlertError(null);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] text-xs font-bold transition-all cursor-pointer shadow-sm shadow-[#D4FF00]/15"
              >
                <span>Start New Shift</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="p-6 space-y-6 max-w-7xl">
        {/* Alerts */}
        {alertError && (
          <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-500/30 flex items-center justify-between gap-2 text-xs text-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{alertError}</span>
            </div>
            <button type="button" onClick={() => setAlertError(null)} className="text-red-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {alertSuccess && (
          <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{alertSuccess}</span>
            </div>
            <button type="button" onClick={() => setAlertSuccess(null)} className="text-emerald-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 1: Cashier Shifts */}
        {activeTab === 'shifts' && (
          <div className="space-y-6">
            {/* Active Shift Card */}
            {currentShift ? (
              <div className="p-5 rounded-xl bg-[#1A202C] border border-[#2A3241] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Current Register Session</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#1E2430] border border-[#2A3241] font-mono text-slate-300">
                        {currentShift.branchName || 'Main Facility'}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-white mt-0.5">
                      Started at {new Date(currentShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Opening Cash Float: <span className="font-mono text-white font-semibold">{(currentShift.openingCashMinor / 100).toFixed(2)} {currency}</span>
                      {currentShift.cashSalesMinor !== undefined && currentShift.cashSalesMinor !== null && (
                        <> • Cash Sales Recorded: <span className="font-mono text-white font-semibold">{(currentShift.cashSalesMinor / 100).toFixed(2)} {currency}</span></>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCloseShiftModalOpen(true);
                      setAlertError(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    Count Cash &amp; Close Register
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#1A202C]/60 border border-dashed border-[#2A3241] flex flex-col items-center justify-center text-center gap-2">
                <Clock className="w-8 h-8 text-slate-500 mb-1" />
                <h3 className="text-sm font-bold text-white">No Register Shift Open Right Now</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Starting a shift records your opening cash float and keeps track of all front-desk payments and transactions until you close.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpenShiftModalOpen(true);
                    setAlertError(null);
                  }}
                  className="mt-2 px-4 py-2 rounded-lg bg-[#D4FF00] text-[#121800] text-xs font-bold cursor-pointer hover:bg-[#c2ed00]"
                >
                  + Start Register Shift
                </button>
              </div>
            )}

            {/* Shift History Table */}
            <div className="rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-[#2A3241] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Recent Register Shifts</h2>
                  <p className="text-xs text-slate-400">Past register closeouts, counted cash, and variance records.</p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {shifts.length} {shifts.length === 1 ? 'Shift' : 'Shifts'}
                </span>
              </div>

              {isLoadingShifts ? (
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Clock className="w-5 h-5 animate-spin text-[#D4FF00]" />
                  <span>Loading shifts...</span>
                </div>
              ) : shifts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No past shift records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#2A3241] text-slate-400 uppercase text-[10px] tracking-wider bg-[#1A202C]/60">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Shift Date &amp; Time</th>
                        <th className="py-3 px-4 font-semibold">Cashier</th>
                        <th className="py-3 px-4 font-semibold font-mono">Opening Cash</th>
                        <th className="py-3 px-4 font-semibold font-mono">Counted Cash</th>
                        <th className="py-3 px-4 font-semibold font-mono">Difference</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A3241]/60">
                      {shifts.map((s) => {
                        const isOpen = s.status === 'open';
                        const diffMinor = s.varianceMinor || 0;
                        const hasVariance = diffMinor !== 0;

                        return (
                          <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4 font-medium text-white">
                              <div>{new Date(s.openedAt).toLocaleDateString()}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {s.closedAt ? ` – ${new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">
                              {s.openedByName || 'Front Desk Staff'}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-300">
                              {(s.openingCashMinor / 100).toFixed(2)} {currency}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-white font-semibold">
                              {s.actualCashMinor !== null && s.actualCashMinor !== undefined
                                ? `${(s.actualCashMinor / 100).toFixed(2)} ${currency}`
                                : '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono">
                              {isOpen ? (
                                <span className="text-slate-400">In progress</span>
                              ) : !hasVariance ? (
                                <span className="text-emerald-400 font-bold">Exact Match (0.00)</span>
                              ) : (
                                <span className={`font-bold ${diffMinor < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                  {diffMinor > 0 ? `+${(diffMinor / 100).toFixed(2)}` : (diffMinor / 100).toFixed(2)} {currency}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isOpen
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : hasVariance && !s.isVarianceApproved
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : 'bg-slate-700/40 text-slate-300 border border-slate-600/30'
                                }`}
                              >
                                {isOpen ? 'In Progress' : hasVariance && !s.isVarianceApproved ? 'Needs Review' : 'Reconciled'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {!isOpen && hasVariance && !s.isVarianceApproved && isOwnerOrManager && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedShiftForApproval(s);
                                    setIsApproveVarianceModalOpen(true);
                                    setAlertError(null);
                                  }}
                                  className="px-2.5 py-1 rounded bg-[#1E2430] hover:bg-[#D4FF00] text-slate-200 hover:text-[#121800] border border-[#2A3241] font-bold text-[11px] transition-colors cursor-pointer"
                                >
                                  Approve Variance
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Invoices & Receipts */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            {/* Search and Summary */}
            <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Search invoice number (e.g. INV-000001), buyer name, phone..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>UAE VAT Compliant 5% Sequential Invoicing</span>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-[#2A3241] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Tax Invoices &amp; Receipts Ledger</h2>
                  <p className="text-xs text-slate-400">Complete records of all member purchases, renewals, and credit notes.</p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {filteredInvoices.length} of {invoices.length} Records
                </span>
              </div>

              {isLoadingInvoices ? (
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Clock className="w-5 h-5 animate-spin text-[#D4FF00]" />
                  <span>Loading invoices...</span>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                  <Receipt className="w-8 h-8 text-slate-600 mb-1" />
                  <span className="font-semibold text-slate-300">No invoices found</span>
                  <span className="text-[11px] text-slate-400">Invoices are automatically created when you sell or renew plans.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#2A3241] text-slate-400 uppercase text-[10px] tracking-wider bg-[#1A202C]/60">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Invoice Number</th>
                        <th className="py-3 px-4 font-semibold">Date</th>
                        <th className="py-3 px-4 font-semibold">Billed To (Member)</th>
                        <th className="py-3 px-4 font-semibold">Type</th>
                        <th className="py-3 px-4 font-semibold font-mono text-right">Tax (5% VAT)</th>
                        <th className="py-3 px-4 font-semibold font-mono text-right">Total Amount</th>
                        <th className="py-3 px-4 font-semibold text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A3241]/60">
                      {filteredInvoices.map((inv) => {
                        const isCreditNote = inv.docType === 'credit_note';
                        const totalAed = ((inv.totals?.totalMinor || 0) / 100).toFixed(2);
                        const vatAed = ((inv.totals?.vatMinor || 0) / 100).toFixed(2);

                        return (
                          <tr
                            key={inv.id}
                            onClick={() => setSelectedInvoice(inv)}
                            className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-white group-hover:text-[#D4FF00] transition-colors">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">
                              {inv.issuedOn || new Date(inv.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-white">{inv.buyer?.name || 'Walk-in Member'}</div>
                              {inv.buyer?.phone && (
                                <div className="text-[10px] text-slate-400 font-mono">{inv.buyer.phone}</div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isCreditNote
                                    ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                }`}
                              >
                                {isCreditNote ? 'Credit Note / Refund' : 'Tax Invoice'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-right text-slate-400">
                              {vatAed} {inv.currency || currency}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-right font-bold text-white">
                              <span className={isCreditNote ? 'text-red-400' : 'text-white'}>
                                {totalAed} {inv.currency || currency}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedInvoice(inv)}
                                className="px-2.5 py-1 rounded bg-[#1E2430] hover:bg-[#D4FF00] text-slate-200 hover:text-[#121800] border border-[#2A3241] font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                View Receipt
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Open Shift */}
      {isOpenShiftModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-xl bg-[#131722] border border-[#2A3241] shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241] mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Start New Register Shift</h3>
                <p className="text-xs text-slate-400">Open cash drawer and record opening cash float.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Facility Branch</label>
                <select
                  value={openBranchId}
                  onChange={(e) => setOpenBranchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
                >
                  {branches.length > 0 ? (
                    branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Primary Hub</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Opening Cash Float ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openCashFloat}
                  onChange={(e) => setOpenCashFloat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white font-mono focus:outline-none focus:border-[#D4FF00]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Starting petty cash in the cash drawer for change.</p>
              </div>

              <div className="pt-3 border-t border-[#2A3241] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1E2430] text-slate-300 hover:text-white border border-[#2A3241] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOpen}
                  className="px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingOpen ? 'Opening...' : 'Start Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Close Shift & Count Cash */}
      {isCloseShiftModalOpen && currentShift && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-xl bg-[#131722] border border-[#2A3241] shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241] mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Count Cash &amp; Close Register</h3>
                <p className="text-xs text-slate-400">Reconcile final cash in drawer at shift end.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-1 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Opening Float:</span>
                  <span>{(currentShift.openingCashMinor / 100).toFixed(2)} {currency}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Recorded Cash Sales:</span>
                  <span>{((currentShift.cashSalesMinor || 0) / 100).toFixed(2)} {currency}</span>
                </div>
                <div className="pt-1.5 border-t border-[#2A3241] flex justify-between font-bold text-white">
                  <span>Expected in Drawer:</span>
                  <span className="text-[#D4FF00]">
                    {((currentShift.openingCashMinor + (currentShift.cashSalesMinor || 0)) / 100).toFixed(2)} {currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Total Counted Cash in Drawer *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={closingCashCount}
                  onChange={(e) => setClosingCashCount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white font-mono text-sm focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Variance Note (If cash does not match)</label>
                <input
                  type="text"
                  placeholder="e.g. Small coin discrepancy"
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              <div className="pt-3 border-t border-[#2A3241] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1E2430] text-slate-300 hover:text-white border border-[#2A3241] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClose}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingClose ? 'Reconciling...' : 'Confirm & Close Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Approve Variance (Manager Step-Up) */}
      {isApproveVarianceModalOpen && selectedShiftForApproval && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-xl bg-[#131722] border border-[#2A3241] shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241] mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Approve Cash Variance</h3>
                <p className="text-xs text-slate-400">Shift closeout difference review.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsApproveVarianceModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApproveVariance} className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Shift Date:</span>
                  <span className="text-white">{new Date(selectedShiftForApproval.openedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Discrepancy:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {((selectedShiftForApproval.varianceMinor || 0) / 100).toFixed(2)} {currency}
                  </span>
                </div>
                {selectedShiftForApproval.varianceReason && (
                  <div className="text-[11px] text-slate-300 pt-1">
                    Staff note: "{selectedShiftForApproval.varianceReason}"
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Enter Manager PIN to Seal Approval</label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  placeholder="••••"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white text-center font-mono text-lg tracking-widest focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              <div className="pt-3 border-t border-[#2A3241] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApproveVarianceModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1E2430] text-slate-300 hover:text-white border border-[#2A3241] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApproval}
                  className="px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingApproval ? 'Verifying...' : 'Approve & Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Invoice / Receipt Preview */}
      {selectedInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[#131722] border border-[#2A3241] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241] mb-4">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Official Receipt</div>
                <h3 className="text-base font-bold text-white font-mono">{selectedInvoice.invoiceNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Header Box */}
              <div className="p-3.5 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-white">{selectedInvoice.supplier?.name || activeGym?.tradeName || 'GymPulse Facility'}</div>
                    <div className="text-[11px] text-slate-400">TRN: {selectedInvoice.supplier?.trn || activeGym?.trnNumber || '100987654300003'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-[10px] uppercase font-semibold">Date of Issue</div>
                    <div className="font-mono text-white">{selectedInvoice.issuedOn || new Date(selectedInvoice.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#2A3241]/60 flex justify-between items-start">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Billed To</div>
                    <div className="font-bold text-white">{selectedInvoice.buyer?.name || 'Walk-in Member'}</div>
                    {selectedInvoice.buyer?.phone && (
                      <div className="text-[10px] text-slate-400 font-mono">{selectedInvoice.buyer.phone}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedInvoice.docType === 'credit_note'
                          ? 'bg-red-500/15 text-red-300'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {selectedInvoice.docType === 'credit_note' ? 'CREDIT NOTE' : 'SIMPLIFIED TAX INVOICE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Line items if available */}
              {selectedInvoice.lines && selectedInvoice.lines.length > 0 && (
                <div className="rounded-lg bg-[#1A202C] border border-[#2A3241] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1E2430] text-slate-400 uppercase text-[10px] border-b border-[#2A3241]">
                      <tr>
                        <th className="p-2.5">Item Description</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A3241]">
                      {selectedInvoice.lines.map((l, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 text-white font-medium">{l.description}</td>
                          <td className="p-2.5 text-center text-slate-300">{l.quantity}</td>
                          <td className="p-2.5 text-right font-mono text-white">
                            {((l.totalMinor || 0) / 100).toFixed(2)} {selectedInvoice.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals Breakdown */}
              <div className="p-3.5 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Net Amount (Before Tax):</span>
                  <span>{((selectedInvoice.totals?.baseMinor || 0) / 100).toFixed(2)} {selectedInvoice.currency}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>UAE 5% VAT:</span>
                  <span>{((selectedInvoice.totals?.vatMinor || 0) / 100).toFixed(2)} {selectedInvoice.currency}</span>
                </div>
                <div className="pt-2 border-t border-[#2A3241] flex justify-between font-bold text-white text-sm">
                  <span>Total Paid:</span>
                  <span className="text-[#D4FF00]">
                    {((selectedInvoice.totals?.totalMinor || 0) / 100).toFixed(2)} {selectedInvoice.currency}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#2A3241] flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  Peppol-ready electronic record • Stored cryptographically
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 rounded-lg bg-[#1E2430] text-slate-300 hover:text-white font-semibold cursor-pointer border border-[#2A3241]"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
