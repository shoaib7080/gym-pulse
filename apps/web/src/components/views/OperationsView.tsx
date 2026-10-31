import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Activity,
  ShieldCheck,
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  Plus,
  AlertTriangle,
  Building2,
  ArrowRight,
} from '../ui/icons';

interface MemberEntity {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  memberNumber?: string;
  gender?: string | null;
  status?: string;
  createdAt?: string;
}

interface BranchEntity {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
}

interface PlanEntity {
  id: string;
  name: string;
  priceMinor: number;
  intervalUnit: string;
  intervalCount: number;
  isActive: boolean;
}

interface CashierShift {
  id: string;
  status: 'open' | 'closed';
  branchId: string;
  openedAt: string;
}

export function OperationsView() {
  const { activeGym, userRole, apiFetch } = useAuth();

  const [members, setMembers] = useState<MemberEntity[]>([]);
  const [branches, setBranches] = useState<BranchEntity[]>([]);
  const [plans, setPlans] = useState<PlanEntity[]>([]);
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);

  // New Member form state
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGender, setNewGender] = useState<'male' | 'female' | 'other'>('male');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  // Atomic Sale Checkout form state
  const [selectedMember, setSelectedMember] = useState<MemberEntity | null>(null);
  const [salePlanId, setSalePlanId] = useState('');
  const [saleBranchId, setSaleBranchId] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState<'cash' | 'card_pos' | 'bank_transfer' | 'card_manual'>('card_pos');
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState('');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<{
    invoiceNumber: string;
    totalMinor: number;
    currency: string;
  } | null>(null);

  // Void Payment form state
  const [voidPaymentId, setVoidPaymentId] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);
  const [lastCreditNote, setLastCreditNote] = useState<{
    creditNoteNumber: string;
    amountMinor: number;
    currency: string;
  } | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isGymActive = activeGym?.status === 'active';
  const isOwner = userRole === 'owner';
  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager';
  const currency = activeGym?.currency || 'AED';

  // Fetch operations data (members, branches, plans, active shift)
  const fetchOperationsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParam = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery.trim())}` : '';
      const [memRes, brRes, plnRes, shiftRes] = await Promise.allSettled([
        apiFetch(`/v1/members${queryParam}`),
        apiFetch('/v1/branches'),
        apiFetch('/v1/plans'),
        apiFetch('/v1/shifts/current'),
      ]);

      if (memRes.status === 'fulfilled' && memRes.value.ok) {
        const data = await memRes.value.json();
        const list: MemberEntity[] = Array.isArray(data) ? data : data?.data || [];
        setMembers(list);
      } else {
        setMembers([]);
      }

      if (brRes.status === 'fulfilled' && brRes.value.ok) {
        const brData = await brRes.value.json();
        const brList: BranchEntity[] = Array.isArray(brData) ? brData : [];
        setBranches(brList);
        if (brList.length > 0 && !selectedBranchId) {
          setSelectedBranchId(brList[0].id);
          setSaleBranchId(brList[0].id);
        }
      }

      if (plnRes.status === 'fulfilled' && plnRes.value.ok) {
        const plnData = await plnRes.value.json();
        const plnList: PlanEntity[] = Array.isArray(plnData) ? plnData : [];
        setPlans(plnList.filter((p) => p.isActive));
        if (plnList.length > 0 && !salePlanId) {
          setSalePlanId(plnList[0].id);
        }
      }

      if (shiftRes.status === 'fulfilled' && shiftRes.value.ok) {
        const shiftData = await shiftRes.value.json();
        setActiveShift(shiftData?.id ? shiftData : null);
      }
    } catch (err) {
      console.warn('Failed to fetch operations data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, searchQuery, selectedBranchId, salePlanId]);

  useEffect(() => {
    fetchOperationsData();
  }, [fetchOperationsData]);

  // Selected plan calculation
  const selectedPlan = plans.find((p) => p.id === salePlanId) || null;
  const rawPriceMinor = selectedPlan?.priceMinor || 0;
  let finalPriceMinor = rawPriceMinor;
  if (discountType === 'percentage' && discountValue > 0) {
    const discountAmount = Math.round((rawPriceMinor * discountValue) / 100);
    finalPriceMinor = Math.max(1, rawPriceMinor - discountAmount);
  } else if (discountType === 'fixed' && discountValue > 0) {
    finalPriceMinor = Math.max(1, rawPriceMinor - Math.round(discountValue * 100));
  }

  // Handle Member Registration
  const handleRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!newFullName.trim() || !newPhone.trim()) {
      setActionError('Full name and phone number in E.164 format (+971...) are required.');
      return;
    }

    setIsSubmittingMember(true);
    try {
      const res = await apiFetch('/v1/members', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newFullName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim() || undefined,
          gender: newGender,
          homeBranchId: selectedBranchId || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccess(`Member "${newFullName}" registered successfully!`);
        setNewFullName('');
        setNewPhone('');
        setNewEmail('');
        setIsAddModalOpen(false);
        fetchOperationsData();
      } else {
        setActionError(data?.message || 'Failed to create member record.');
      }
    } catch {
      setActionError('Network error registering new member.');
    } finally {
      setIsSubmittingMember(false);
    }
  };

  // Handle Atomic Membership Sale
  const handleSellMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setLastInvoice(null);

    if (!selectedMember) {
      setActionError('Please select an active member.');
      return;
    }

    if (!salePlanId) {
      setActionError('Please select a membership plan.');
      return;
    }

    // Cash and POS card sales require an open shift
    if (['cash', 'card_pos'].includes(salePaymentMethod) && !activeShift) {
      setActionError('Cash and POS Card sales require an open cashier shift. Please open a shift first.');
      return;
    }

    setIsSubmittingSale(true);
    try {
      const payload: Record<string, unknown> = {
        memberId: selectedMember.id,
        planId: salePlanId,
        branchId: saleBranchId || undefined,
        paymentMethod: salePaymentMethod,
      };

      if (discountType !== 'none' && discountValue > 0) {
        payload.discount = {
          type: discountType,
          value: discountValue,
          reason: discountReason || 'Front desk management discount',
        };
      }

      const res = await apiFetch('/v1/sales/memberships', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setLastInvoice({
          invoiceNumber: data.invoice?.invoiceNumber || 'INV-PROCESSED',
          totalMinor: data.payment?.amountMinor || finalPriceMinor,
          currency: data.payment?.currency || currency,
        });
        setActionSuccess(`Membership sale processed! Tax Invoice ${data.invoice?.invoiceNumber || ''} generated.`);
        setIsSaleModalOpen(false);
        fetchOperationsData();
      } else {
        setActionError(data?.message || 'Failed to process membership sale.');
      }
    } catch {
      setActionError('Network error executing atomic membership sale.');
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Handle Void Payment (Owner only)
  const handleVoidPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setLastCreditNote(null);

    if (!voidPaymentId.trim()) {
      setActionError('Payment ID is required to execute a void.');
      return;
    }

    if (!voidReason.trim()) {
      setActionError('Reason for void is required.');
      return;
    }

    setIsSubmittingVoid(true);
    try {
      const res = await apiFetch(`/v1/payments/${voidPaymentId.trim()}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setLastCreditNote({
          creditNoteNumber: data.creditNote?.number || data.creditNoteNumber || 'CN-ISSUED',
          amountMinor: data.refundAmountMinor || data.amountMinor || 0,
          currency: data.currency || currency,
        });
        setActionSuccess(`Payment voided successfully. Credit Note issued.`);
        setVoidPaymentId('');
        setVoidReason('');
        setIsVoidModalOpen(false);
        fetchOperationsData();
      } else {
        setActionError(data?.message || 'Failed to void payment.');
      }
    } catch {
      setActionError('Network error during payment void execution.');
    } finally {
      setIsSubmittingVoid(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-12 font-sans">
      {/* Top Header */}
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low border-b border-outline-variant/30 shadow-sm">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-outline font-semibold">
            <span>Operations</span>
            <span className="text-on-surface-variant font-bold">/</span>
            <span className="text-primary font-bold">Front-Desk &amp; Sales</span>
          </div>
          <h1 className="text-xl font-bold text-on-surface font-display mt-0.5">
            Member Registry &amp; Atomic Checkout
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setIsVoidModalOpen(true);
                setActionError(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-bold transition-all cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Void Sale (Owner)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsAddModalOpen(true);
              setActionError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-[#1f3700] text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Member</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Verification Status Warning Rail */}
        {!isGymActive && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3 text-xs text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-300">
                Facility Verification Required (Current Status: {activeGym?.status || 'pending_verification'})
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                Adding branches, registering members, creating plans, selling memberships, and processing payments require an active, verified gym. Please upload your Trade License in Compliance to complete verification.
              </p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {actionSuccess && (
          <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between gap-2.5 text-xs text-primary animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            {lastInvoice && (
              <span className="font-mono font-bold bg-primary/20 px-2 py-0.5 rounded text-[11px]">
                {lastInvoice.invoiceNumber} • {(lastInvoice.totalMinor / 100).toFixed(2)} {lastInvoice.currency}
              </span>
            )}
            {lastCreditNote && (
              <span className="font-mono font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-[11px]">
                {lastCreditNote.creditNoteNumber} • Refund: {(lastCreditNote.amountMinor / 100).toFixed(2)} {lastCreditNote.currency}
              </span>
            )}
          </div>
        )}

        {/* Telemetry Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#131722] border border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total Members</span>
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading ? '...' : members.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Active Facility Roster
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Active Plans</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading ? '...' : plans.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Available for Checkout
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Branch Facilities</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading ? '...' : branches.length || 1}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Scoped Locations
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Cashier Shift</span>
              <Receipt className="w-4 h-4 text-primary" />
            </div>
            <div className={`text-base font-bold mt-1 ${activeShift ? 'text-emerald-400' : 'text-amber-400'}`}>
              {activeShift ? 'Shift Active (Open)' : 'No Shift Open'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {activeShift ? 'Ready for Cash & POS' : 'Shift required for Cash'}
            </div>
          </div>
        </div>

        {/* Search & Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#131722] border border-white/[0.08] shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, phone, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1A202C] text-on-surface placeholder:text-outline text-xs pl-9 pr-3 py-2 rounded-lg border border-white/[0.07] focus:border-primary focus:outline-none font-sans"
            />
          </div>

          <button
            type="button"
            onClick={fetchOperationsData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-lg bg-[#1A202C] hover:bg-[#232a3b] border border-white/[0.08] text-xs font-bold text-on-surface transition-colors cursor-pointer"
          >
            Refresh Roster
          </button>
        </div>

        {/* Member Roster Table */}
        <div className="rounded-xl bg-[#131722] border border-white/[0.08] p-6 shadow-md">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-outline font-mono">
              Loading member records from tenant database...
            </div>
          ) : members.length === 0 ? (
            <div className="py-16 px-6 text-center rounded-xl border border-dashed border-outline-variant/30 bg-surface-container/30">
              <Users className="w-12 h-12 text-outline mx-auto mb-3 opacity-50" />
              <h3 className="text-base font-bold text-on-surface">No Members Found</h3>
              <p className="text-xs text-on-surface-variant mt-1 max-w-md mx-auto">
                {searchQuery.trim()
                  ? `No members match the query "${searchQuery}". Clear your search to see all records.`
                  : 'There are currently no members registered in this facility partition. Click the button below to register your first member.'}
              </p>
              {!searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active text-[#1f3700] text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
                >
                  + Register First Member
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-outline-variant/30 text-outline uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Member Name</th>
                    <th className="py-2.5 px-3">Phone Number</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Member Number</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-on-surface">
                        <div>{m.fullName}</div>
                        <div className="text-[10px] text-outline font-mono">ID: {m.id.slice(0, 8)}...</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-outline">{m.phone}</td>
                      <td className="py-3 px-3 text-on-surface-variant">{m.email || '—'}</td>
                      <td className="py-3 px-3 font-mono text-primary">{m.memberNumber || m.id.slice(0, 8)}</td>
                      <td className="py-3 px-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                          {m.status ? m.status.toUpperCase() : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(m);
                            setIsSaleModalOpen(true);
                            setActionError(null);
                          }}
                          className="px-2.5 py-1 rounded bg-primary/20 hover:bg-primary text-primary hover:text-black font-bold text-[11px] transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Sell Membership</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Register Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
              <div>
                <h3 className="text-base font-bold text-on-surface">Register New Club Member</h3>
                <p className="text-xs text-on-surface-variant">Front-desk intake into facility database</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-outline hover:text-on-surface text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-lg bg-error-container/20 border border-error/40 flex items-start gap-2.5 text-xs text-error">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterMember} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elena Rostova"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Phone Number (E.164) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+971501234567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none font-mono"
                />
                <p className="text-[10px] text-outline mt-1 font-mono">
                  Must include country prefix (e.g. +971 for UAE)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="member@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Gender</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value as 'male' | 'female' | 'other')}
                    className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Home Branch</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
                  >
                    {branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Downtown Flagship</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-outline hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMember}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-[#1f3700] text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingMember ? 'Creating...' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Atomic Membership Sale Modal */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
              <div>
                <h3 className="text-base font-bold text-on-surface">Atomic Membership Checkout</h3>
                <p className="text-xs text-on-surface-variant">Server-priced sale &amp; Tax Invoice generation</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSaleModalOpen(false)}
                className="text-outline hover:text-on-surface text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-lg bg-error-container/20 border border-error/40 flex items-start gap-2.5 text-xs text-error">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSellMembership} className="space-y-4">
              <div className="p-3 rounded-lg bg-surface-container flex items-center justify-between text-xs">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-mono">Customer Member</div>
                  <div className="font-bold text-on-surface text-sm">{selectedMember?.fullName}</div>
                  <div className="font-mono text-outline text-[11px]">{selectedMember?.phone}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono bg-primary/20 text-primary px-2 py-0.5 rounded font-bold">
                    {selectedMember?.id.slice(0, 8)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Select Membership Plan *
                </label>
                <select
                  required
                  value={salePlanId}
                  onChange={(e) => setSalePlanId(e.target.value)}
                  className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {(p.priceMinor / 100).toFixed(2)} {currency} ({p.intervalCount} {p.intervalUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Fulfillment Branch
                  </label>
                  <select
                    value={saleBranchId}
                    onChange={(e) => setSaleBranchId(e.target.value)}
                    className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={salePaymentMethod}
                    onChange={(e) => setSalePaymentMethod(e.target.value as any)}
                    className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
                  >
                    <option value="card_pos">POS Card Terminal</option>
                    <option value="cash">Cash (Requires Open Shift)</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card_manual">Manual Card Entry</option>
                  </select>
                </div>
              </div>

              {/* Discount Section (Enabled for Owner & Manager only) */}
              <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface">Management Discount</span>
                  {!isManagerOrOwner && (
                    <span className="text-[10px] text-amber-400 font-mono">(Owner/Manager clearance required)</span>
                  )}
                </div>

                {isManagerOrOwner ? (
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={discountType}
                      onChange={(e) => {
                        setDiscountType(e.target.value as any);
                        if (e.target.value === 'none') setDiscountValue(0);
                      }}
                      className="bg-surface-container text-on-surface text-xs px-2 py-1.5 rounded border border-outline-variant/50"
                    >
                      <option value="none">No Discount</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>

                    <input
                      type="number"
                      min="0"
                      max={discountType === 'percentage' ? 99 : Math.floor(rawPriceMinor / 100)}
                      disabled={discountType === 'none'}
                      placeholder={discountType === 'percentage' ? 'e.g. 15%' : `e.g. 50 ${currency}`}
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      className="bg-surface-container text-on-surface text-xs px-2 py-1.5 rounded border border-outline-variant/50"
                    />

                    <input
                      type="text"
                      disabled={discountType === 'none'}
                      placeholder="Discount reason"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      className="bg-surface-container text-on-surface text-xs px-2 py-1.5 rounded border border-outline-variant/50"
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-outline">
                    Standard catalog pricing applies. Discretionary discounts must be authorized by an active shift manager or owner.
                  </p>
                )}
              </div>

              {/* Server-Side Pricing Breakdown */}
              <div className="p-3 rounded-lg bg-surface-container-high border border-outline-variant/50 space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Catalog Plan Price:</span>
                  <span className="font-mono">{(rawPriceMinor / 100).toFixed(2)} {currency}</span>
                </div>
                {discountType !== 'none' && discountValue > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Discount Applied:</span>
                    <span className="font-mono">
                      - {((rawPriceMinor - finalPriceMinor) / 100).toFixed(2)} {currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-on-surface pt-1 border-t border-outline-variant/30">
                  <span>Total Amount Due:</span>
                  <span className="font-mono text-primary">
                    {(finalPriceMinor / 100).toFixed(2)} {currency}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaleModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-outline hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSale || !isGymActive}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-[#1f3700] text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSale ? 'Processing Sale...' : `Confirm Sale (${(finalPriceMinor / 100).toFixed(2)} ${currency})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Payment Modal (Owner Only) */}
      {isVoidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-xl bg-surface-container-low border border-red-500/40 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
              <div>
                <h3 className="text-base font-bold text-red-400">Void Payment Sale (Owner Rail)</h3>
                <p className="text-xs text-on-surface-variant">Issue sequential Credit Note &amp; reverse membership</p>
              </div>
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="text-outline hover:text-on-surface text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-lg bg-error-container/20 border border-error/40 flex items-start gap-2.5 text-xs text-error">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-200 mb-4 space-y-1">
              <div className="font-bold">Owner Authorization Required</div>
              <p className="text-[11px] text-red-300">
                Voids are only permitted while the cashier shift is still open. A gapless Credit Note (CN) will be permanently recorded in the cryptographic audit trail.
              </p>
            </div>

            <form onSubmit={handleVoidPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Payment Transaction UUID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8f14e45f-..."
                  value={voidPaymentId}
                  onChange={(e) => setVoidPaymentId(e.target.value)}
                  className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-red-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Reason for Void *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer requested immediate refund at front desk"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full bg-surface-container text-on-surface text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-red-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-outline hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVoid}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingVoid ? 'Processing Void...' : 'Execute Void & Issue CN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
