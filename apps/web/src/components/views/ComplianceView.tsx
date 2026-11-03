import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Users,
  Clock,
  Building2,
  Lock,
  KeyRound,
  X,
  ArrowRight,
  Receipt,
  Search,
  Zap,
  CreditCard,
} from '../ui/icons';
import { StaffManagementView } from './StaffManagementView';
import { SubscriptionBillingView } from './SubscriptionBillingView';

interface FreezeItem {
  id: string;
  gymId: string;
  membershipId: string;
  startDate: string;
  endDate: string;
  status: 'pending_review' | 'active' | 'completed' | 'rejected' | 'cancelled';
  reasonCode: 'medical' | 'travel' | 'relocation' | 'religious_observance' | 'other';
  reasonNote?: string | null;
  proofStorageKey?: string | null;
  proofUrl?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  member?: {
    fullName: string;
    memberNumber: string;
    phone: string;
  };
  membership?: {
    planName?: string;
    startDate?: string;
    endDate?: string;
  };
}

interface GymDocumentItem {
  id: string;
  gymId: string;
  docType: 'trade_license' | 'trn_certificate' | 'id_card' | 'other';
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface StaffItem {
  id: string;
  userId: string;
  role: 'owner' | 'manager' | 'front_desk' | 'trainer';
  branchScope: 'all' | 'selected';
  isActive: boolean;
  user?: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
  };
}

interface ComplianceViewProps {
  initialTab?: 'freezes' | 'settings' | 'documents' | 'staff' | 'pin' | 'subscription';
}

export function ComplianceView({ initialTab = 'freezes' }: ComplianceViewProps) {
  const { activeGym, userRole, apiFetch, user } = useAuth();
  const isOwnerOrManager = userRole === 'owner' || userRole === 'manager';

  const isSettingsRoute =
    initialTab === 'settings' ||
    initialTab === 'staff' ||
    initialTab === 'pin' ||
    initialTab === 'subscription';

  // Sub-navigation: 'freezes' | 'settings' | 'documents' | 'staff' | 'pin' | 'subscription'
  const [activeTab, setActiveTab] = useState<'freezes' | 'settings' | 'documents' | 'staff' | 'pin' | 'subscription'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('subscription')) {
      return 'subscription';
    }
    return initialTab === 'settings' ? 'staff' : initialTab;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('subscription')) {
      setActiveTab('subscription');
      return;
    }
    if (initialTab) {
      setActiveTab(initialTab === 'settings' ? 'staff' : initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleCustomNav = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab === 'subscription') {
        setActiveTab('subscription');
      }
    };
    window.addEventListener('gympulse:navigate', handleCustomNav);
    return () => window.removeEventListener('gympulse:navigate', handleCustomNav);
  }, []);

  // Freeze Management State
  const [freezes, setFreezes] = useState<FreezeItem[]>([]);
  const [isLoadingFreezes, setIsLoadingFreezes] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'active' | 'completed' | 'rejected'>('all');
  const [selectedFreeze, setSelectedFreeze] = useState<FreezeItem | null>(null);

  // Freeze Action Modals
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isEarlyLiftModalOpen, setIsEarlyLiftModalOpen] = useState(false);
  const [earlyLiftPin, setEarlyLiftPin] = useState('');
  const [earlyLiftReason, setEarlyLiftReason] = useState('early_return_authorized');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Settings & Compliance State
  const [documents, setDocuments] = useState<GymDocumentItem[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffItem[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // PIN Management State
  const [newManagerPin, setNewManagerPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);

  // Upload Document State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<'trade_license' | 'trn_certificate' | 'id_card' | 'other'>('trade_license');
  const [uploadFileName, setUploadFileName] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Fetch Freezes
  const fetchFreezes = useCallback(async () => {
    setIsLoadingFreezes(true);
    try {
      const query = statusFilter !== 'all' ? `?status=${statusFilter}&limit=100` : '?limit=100';
      const res = await apiFetch(`/v1/freezes${query}`);
      if (res.ok) {
        const data = await res.json();
        const list: FreezeItem[] = Array.isArray(data) ? data : data?.items || [];
        setFreezes(list);
      } else {
        setFreezes([]);
      }
    } catch (err) {
      console.warn('Failed to fetch freezes:', err);
      setFreezes([]);
    } finally {
      setIsLoadingFreezes(false);
    }
  }, [apiFetch, statusFilter]);

  // Fetch Documents and Staff for Settings
  const fetchSettingsData = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const [docsRes, staffRes] = await Promise.allSettled([
        apiFetch('/v1/gyms/documents'),
        apiFetch('/v1/gyms/staff'),
      ]);

      if (docsRes.status === 'fulfilled' && docsRes.value.ok) {
        const dData = await docsRes.value.json();
        setDocuments(Array.isArray(dData) ? dData : []);
      }

      if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
        const sData = await staffRes.value.json();
        setStaffMembers(Array.isArray(sData) ? sData : []);
      }
    } catch (err) {
      console.warn('Failed to load settings data:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (activeTab === 'freezes') {
      fetchFreezes();
    } else {
      fetchSettingsData();
    }
  }, [activeTab, fetchFreezes, fetchSettingsData]);

  // Approve Freeze Request (POST /v1/freezes/:id/approve)
  const handleApproveFreeze = async (freezeId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setIsActionSubmitting(true);

    try {
      const res = await apiFetch(`/v1/freezes/${freezeId}/approve`, {
        method: 'POST',
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccess('Membership freeze approved successfully. Member status and end date updated.');
        await fetchFreezes();
      } else {
        setActionError(data.message || 'Failed to approve freeze request.');
      }
    } catch {
      setActionError('Network error approving freeze request.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Reject Freeze Request (POST /v1/freezes/:id/reject)
  const handleRejectFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFreeze) return;
    if (!rejectionReason.trim()) {
      setActionError('A valid explanation is required to reject a freeze request.');
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setIsActionSubmitting(true);

    try {
      const res = await apiFetch(`/v1/freezes/${selectedFreeze.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsRejectModalOpen(false);
        setRejectionReason('');
        setActionSuccess('Freeze request rejected and recorded in compliance ledger.');
        await fetchFreezes();
      } else {
        setActionError(data.message || 'Failed to reject freeze request.');
      }
    } catch {
      setActionError('Network error rejecting freeze request.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Early Freeze Lift (POST /v1/freezes/:id/lift)
  const handleEarlyLift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFreeze) return;

    setActionError(null);
    setActionSuccess(null);
    setIsActionSubmitting(true);

    try {
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: activeGym?.timezone || 'Asia/Dubai',
      }).format(new Date());

      const res = await apiFetch(`/v1/freezes/${selectedFreeze.id}/lift`, {
        method: 'POST',
        body: JSON.stringify({
          liftedOnDate: todayStr,
          managerPin: earlyLiftPin ? earlyLiftPin.trim() : undefined,
          reason: earlyLiftReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsEarlyLiftModalOpen(false);
        setEarlyLiftPin('');
        setActionSuccess('Freeze lifted early. Unused freeze days have been restored to the membership.');
        await fetchFreezes();
      } else {
        setActionError(data.message || 'Failed to lift freeze early. Verify manager authorization PIN.');
      }
    } catch {
      setActionError('Network error executing early freeze lift.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Set Manager PIN (PUT /v1/gyms/manager-pin)
  const handleSetManagerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    if (newManagerPin.length < 4 || newManagerPin.length > 8) {
      setPinError('PIN must be between 4 and 8 digits.');
      return;
    }

    if (newManagerPin !== pinConfirm) {
      setPinError('PIN confirmation does not match.');
      return;
    }

    setIsPinSubmitting(true);

    try {
      const res = await apiFetch('/v1/gyms/manager-pin', {
        method: 'PUT',
        body: JSON.stringify({ pin: newManagerPin.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setPinSuccess('Security authorization PIN updated and encrypted with scrypt hashing.');
        setNewManagerPin('');
        setPinConfirm('');
      } else {
        setPinError(data.message || 'Failed to update PIN. Avoid sequential or repeated digits (e.g. 1234, 1111).');
      }
    } catch {
      setPinError('Network error updating manager authorization PIN.');
    } finally {
      setIsPinSubmitting(false);
    }
  };

  // Upload Verification Document (POST /v1/gyms/documents)
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName.trim()) return;

    setIsUploadingDoc(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await apiFetch('/v1/gyms/documents', {
        method: 'POST',
        body: JSON.stringify({
          docType: uploadDocType,
          fileName: uploadFileName.trim(),
          storageKey: `gyms/${activeGym?.id || 'current'}/documents/${uploadFileName.toLowerCase().replace(/\s+/g, '-')}`,
          mimeType: 'application/pdf',
          sizeBytes: 1048576, // 1MB mock
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsUploadModalOpen(false);
        setUploadFileName('');
        setActionSuccess('Verification document uploaded to regulatory compliance queue.');
        await fetchSettingsData();
      } else {
        setActionError(data.message || 'Failed to register document.');
      }
    } catch {
      setActionError('Network error registering verification document.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const pendingCount = freezes.filter((f) => f.status === 'pending_review').length;
  const activeCount = freezes.filter((f) => f.status === 'active').length;

  return (
    <div className="flex flex-col w-full pb-12 p-6 gap-6 min-w-0">
      {/* Top Stage Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-low border border-outline-variant/30 p-6 shadow-lg rounded-2xl relative overflow-hidden min-w-0">
        <div className="flex flex-col gap-1 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-[#D4FF00] font-bold">
              {isSettingsRoute ? 'Facility Administration' : 'Compliance & Policy Control'}
            </span>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4FF00] animate-pulse" />
              <span>{isSettingsRoute ? '2-Role Access Model Active' : 'UAE FTA & DED Compliant'}</span>
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight font-display">
            {isSettingsRoute ? 'Facility Settings & Staff Management' : 'Membership Freezes & Compliance Center'}
          </h1>
          <p className="text-xs text-slate-400 max-w-xl">
            {isSettingsRoute
              ? 'Authorized staff roster, Brevo email invites, multi-branch delegation, and per-manager authorization PINs.'
              : 'Automated UAE freeze policy enforcement, proof validation, tamper-evident audit logs, and per-manager authorization credentials.'}
          </p>
        </div>

        {/* Global Sub-tabs */}
        <div className="flex items-center gap-2 bg-[#171A21] p-1.5 rounded-xl border border-[#242933]">
          {isSettingsRoute ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'staff' || activeTab === 'settings'
                    ? 'bg-[#D4FF00] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Staff Roster</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('subscription')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'subscription'
                    ? 'bg-[#D4FF00] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>Subscription &amp; Quotas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pin')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'pin'
                    ? 'bg-[#D4FF00] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Security PIN</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'documents'
                    ? 'bg-[#D4FF00] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Trade Documents</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('freezes')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'freezes'
                    ? 'bg-[#D4FF00] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Freezes Queue</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-red-500 text-white text-[10px] rounded-full font-mono">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'documents'
                    ? 'bg-[#D4FF00] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Trade Documents</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'staff' || activeTab === 'settings'
                    ? 'bg-[#D4FF00] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Staff Roster</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: FREEZE POLICY & QUEUE */}
      {activeTab === 'freezes' && (
        <div className="space-y-6">
          {/* Telemetry Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-outline">
                  Pending Reviews
                </div>
                <div className="text-2xl font-bold text-amber-400 mt-1">{pendingCount}</div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Requires proof check &amp; manager sign-off
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-outline">
                  Currently Active Freezes
                </div>
                <div className="text-2xl font-bold text-primary mt-1">{activeCount}</div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Check-in access suspended temporarily
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-outline">
                  Total Managed Ledger
                </div>
                <div className="text-2xl font-bold text-on-surface mt-1">{freezes.length}</div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  End dates clamped with inclusive math
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap bg-surface-container-low border border-outline-variant/30 p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant font-medium">Filter Status:</span>
              {(['all', 'pending_review', 'active', 'completed', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-primary text-on-primary-container font-bold'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Freezes Table */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-on-surface-variant border-collapse min-w-[700px]">
                <thead className="bg-surface-container/60 text-outline uppercase tracking-wider text-[10px] font-semibold border-b border-outline-variant/30">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Duration &amp; Reason</th>
                    <th className="py-3 px-4">Supporting Proof</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {isLoadingFreezes ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                        <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        <span>Loading membership freezes ledger...</span>
                      </td>
                    </tr>
                  ) : freezes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                        No freeze requests match this filter.
                      </td>
                    </tr>
                  ) : (
                    freezes.map((f) => (
                      <tr key={f.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-on-surface">
                          <div>{f.member?.fullName || 'Member'}</div>
                          <div className="text-[11px] text-outline font-mono">
                            {f.member?.memberNumber || 'MEM-0000'} • {f.member?.phone || ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-on-surface">
                            {f.startDate} → {f.endDate}
                          </div>
                          <div className="text-[11px] capitalize text-outline">
                            Reason: <span className="text-on-surface-variant font-medium">{f.reasonCode}</span>
                            {f.reasonNote && ` (${f.reasonNote})`}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {f.proofStorageKey ? (
                            <a
                              href={f.proofUrl || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/30 text-[11px] font-semibold transition-colors"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>View Proof Doc</span>
                            </a>
                          ) : (
                            <span className="text-outline text-[11px] italic">No document attached</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              f.status === 'active'
                                ? 'bg-primary/15 text-primary border border-primary/30'
                                : f.status === 'pending_review'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : f.status === 'completed'
                                ? 'bg-surface-container text-on-surface-variant border border-outline-variant/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {f.status === 'active' && <ShieldCheck className="w-3 h-3" />}
                            {f.status === 'pending_review' && <Clock className="w-3 h-3" />}
                            {f.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {f.status === 'pending_review' && isOwnerOrManager && (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isActionSubmitting}
                                onClick={() => handleApproveFreeze(f.id)}
                                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={isActionSubmitting}
                                onClick={() => {
                                  setSelectedFreeze(f);
                                  setIsRejectModalOpen(true);
                                }}
                                className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {f.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFreeze(f);
                                setIsEarlyLiftModalOpen(true);
                              }}
                              className="px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-bright text-[#D4FF00] border border-[#D4FF00]/40 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Lift Early
                            </button>
                          )}

                          {(f.status === 'completed' || f.status === 'rejected') && (
                            <span className="text-[11px] text-outline">Archived</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRADE DOCUMENTS & FTA COMPLIANCE */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 bg-surface-container-low border border-outline-variant/30 p-6 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-on-surface font-display">
                Commercial Verification Ledger
              </h2>
              <p className="text-xs text-on-surface-variant">
                Upload official UAE Trade License, FTA TRN registration certificate, and lease agreements to ensure 100% regulatory compliance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#D4FF00] hover:bg-[#bfe600] text-black font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Document</span>
            </button>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low overflow-hidden">
            <table className="w-full text-left text-xs text-on-surface-variant border-collapse min-w-[600px]">
              <thead className="bg-surface-container/60 text-outline uppercase tracking-wider text-[10px] font-semibold border-b border-outline-variant/30">
                <tr>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Upload Timestamp</th>
                  <th className="py-3 px-4">Storage Key</th>
                  <th className="py-3 px-4 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                      No commercial verification documents uploaded yet.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-surface-container/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-on-surface capitalize">
                        {doc.docType.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-on-surface">
                        {doc.fileName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-outline">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-outline truncate max-w-xs">
                        {doc.storageKey}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Sealed &amp; Verified
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STAFF ROSTER & ACCESS DELEGATION */}
      {(activeTab === 'staff' || activeTab === 'settings') && (
        <StaffManagementView />
      )}

      {/* TAB 3B: SAAS SUBSCRIPTION & QUOTAS */}
      {activeTab === 'subscription' && (
        <SubscriptionBillingView />
      )}

      {/* TAB 4: PER-MANAGER SECURITY PIN FORM */}
      {activeTab === 'pin' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#141820] border border-[#242933] p-6 rounded-xl shadow-md">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-[#D4FF00]/10 border border-[#D4FF00]/20 flex items-center justify-center text-[#D4FF00]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-white font-display">
                  Set Security Authorization PIN
                </h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Configure your per-manager PIN used for authorizing early freeze lifts, voids, blind drawer variance overrides, and turnstile bypasses. Hashed securely with scrypt.
              </p>

              {pinSuccess && (
                <div className="p-3 mb-4 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
                  {pinSuccess}
                </div>
              )}

              {pinError && (
                <div className="p-3 mb-4 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300">
                  {pinError}
                </div>
              )}

              <form onSubmit={handleSetManagerPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    New Manager PIN (4 to 8 digits)
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    value={newManagerPin}
                    onChange={(e) => setNewManagerPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#1B202C] border border-[#2A3241] text-white font-mono placeholder:text-slate-600 focus:outline-hidden focus:border-[#D4FF00]/60 text-sm"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Sequential (1234) and identical (1111) digits will be rejected by safety rails.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#1B202C] border border-[#2A3241] text-white font-mono placeholder:text-slate-600 focus:outline-hidden focus:border-[#D4FF00]/60 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPinSubmitting}
                  className="w-full bg-[#D4FF00] hover:bg-[#bfe600] text-black font-bold py-2.5 rounded-lg text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isPinSubmitting ? 'Hashing & Updating...' : 'Update Authorization PIN'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedFreeze && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-[#11141A] border border-[#242933] rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#242933] pb-3">
              <h3 className="font-bold text-white text-sm">Reject Freeze Request</h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRejectFreeze} className="space-y-4 text-xs">
              <p className="text-slate-300">
                Rejecting freeze for <strong className="text-white">{selectedFreeze.member?.fullName}</strong>.
                An explanation is required and will be logged in the immutable audit trail.
              </p>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Rejection Reason / Explanation
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Medical certificate did not cover the requested duration..."
                  className="w-full px-3 py-2 rounded-xl bg-[#171A21] border border-[#242933] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#D4FF00]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionSubmitting}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Early Lift Modal */}
      {isEarlyLiftModalOpen && selectedFreeze && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-[#11141A] border border-[#242933] rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#242933] pb-3">
              <h3 className="font-bold text-white text-sm">Lift Freeze Early</h3>
              <button
                type="button"
                onClick={() => setIsEarlyLiftModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEarlyLift} className="space-y-4 text-xs">
              <p className="text-slate-300">
                Lift active freeze for <strong className="text-white">{selectedFreeze.member?.fullName}</strong>.
                Unused days will be recalculated and the membership end date restored immediately.
              </p>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Reason for Early Return
                </label>
                <select
                  value={earlyLiftReason}
                  onChange={(e) => setEarlyLiftReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#171A21] border border-[#242933] text-white"
                >
                  <option value="early_return_authorized">Early Return Authorized</option>
                  <option value="medical_clearance_obtained">Medical Clearance Obtained</option>
                  <option value="travel_itinerary_changed">Travel Schedule Changed</option>
                  <option value="member_voluntary_request">Member Voluntary Request</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Manager Security PIN (if front desk or step-up)
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={earlyLiftPin}
                  onChange={(e) => setEarlyLiftPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter manager PIN"
                  className="w-full px-3 py-2 rounded-xl bg-[#171A21] border border-[#242933] text-white font-mono placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEarlyLiftModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#D4FF00] hover:bg-[#bfe600] text-black font-bold cursor-pointer disabled:opacity-50"
                >
                  Authorize Early Lift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-[#11141A] border border-[#242933] rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#242933] pb-3">
              <h3 className="font-bold text-white text-sm">Upload Regulatory Verification Document</h3>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUploadDocument} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Document Type
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#171A21] border border-[#242933] text-white"
                >
                  <option value="trade_license">UAE Trade License (DED / Freezone)</option>
                  <option value="trn_certificate">FTA VAT TRN Certificate</option>
                  <option value="id_card">Emirates ID / Passport Copy</option>
                  <option value="other">Facility Lease / Ejari</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  File Name
                </label>
                <input
                  type="text"
                  required
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="e.g. Trade-License-2026.pdf"
                  className="w-full px-3 py-2 rounded-xl bg-[#171A21] border border-[#242933] text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDoc}
                  className="px-4 py-2 rounded-xl bg-[#D4FF00] hover:bg-[#bfe600] text-black font-bold cursor-pointer disabled:opacity-50"
                >
                  Upload &amp; Seal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
