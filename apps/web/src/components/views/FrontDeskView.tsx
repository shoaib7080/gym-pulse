import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Users,
  Building2,
  Lock,
  KeyRound,
  X,
  CreditCard,
  ArrowRight,
  Dumbbell,
} from '../ui/icons';

interface MemberEntity {
  id: string;
  memberNumber: string;
  status: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  homeBranchId?: string | null;
  createdAt?: string;
  user?: {
    id: string;
    fullName: string;
    phone: string;
    email?: string | null;
  };
  homeBranch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  memberships?: Array<{
    id: string;
    planId: string;
    status: 'active' | 'frozen' | 'expired' | 'cancelled' | 'pending';
    startDate: string;
    endDate: string;
    daysRemaining?: number;
    planTitle?: string;
    freezeEndDate?: string | null;
    activeFreezeId?: string | null;
  }>;
}

interface PlanEntity {
  id: string;
  name: string;
  priceMinor: number;
  intervalUnit: string;
  intervalCount: number;
  graceDays?: number;
  isActive: boolean;
}

interface StaffMember {
  id: string;
  userId: string;
  role: 'owner' | 'manager' | 'front_desk' | 'trainer';
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
}

interface CheckInLogItem {
  id: string;
  memberId: string | null;
  membershipId: string | null;
  branchId: string;
  result: 'allowed' | 'denied' | 'override_allowed';
  denyReason?: string | null;
  method: string;
  createdAt: string;
  member?: {
    fullName: string;
    memberNumber: string;
  };
  membership?: {
    planTitle?: string;
  };
}

export function FrontDeskView() {
  const { activeGym, userRole, user, apiFetch } = useAuth();
  const currency = activeGym?.currency || 'AED';

  // Branch Selection
  const branches = activeGym?.branches || [];
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return branches.length > 0 ? branches[0].id : '';
  });

  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  // Cashier shift state
  const [activeShift, setActiveShift] = useState<{ id: string; status: string } | null>(null);

  // Search & Navigation state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberEntity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected Member Snapshot
  const [selectedMember, setSelectedMember] = useState<MemberEntity | null>(null);
  const [isLoadingMember, setIsLoadingMember] = useState(false);

  // Recent Attendance History Feed
  const [attendanceFeed, setAttendanceFeed] = useState<CheckInLogItem[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  // Active Alert Notification
  const [tapSuccessMessage, setTapSuccessMessage] = useState<string | null>(null);
  const [tapErrorMessage, setTapErrorMessage] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Available Plans for Renewals
  const [plans, setPlans] = useState<PlanEntity[]>([]);

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isEarlyLiftModalOpen, setIsEarlyLiftModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);

  // Early Freeze Lift State
  const [managersList, setManagersList] = useState<StaffMember[]>([]);
  const [selectedApproverId, setSelectedApproverId] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [liftReason, setLiftReason] = useState('early_return_authorized');
  const [isSubmittingLift, setIsSubmittingLift] = useState(false);
  const [liftError, setLiftError] = useState<string | null>(null);
  const [pinLockoutSeconds, setPinLockoutSeconds] = useState<number | null>(null);

  // Quick Renewal State
  const [renewPlanId, setRenewPlanId] = useState('');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<'cash' | 'card_pos' | 'bank_transfer'>('card_pos');
  const [isSubmittingRenew, setIsSubmittingRenew] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string | null>(null);

  // Freeze Request State
  const [freezeStartDate, setFreezeStartDate] = useState('');
  const [freezeEndDate, setFreezeEndDate] = useState('');
  const [freezeReasonCode, setFreezeReasonCode] = useState<'medical' | 'travel' | 'relocation' | 'religious_observance' | 'other'>('travel');
  const [freezeReasonNote, setFreezeReasonNote] = useState('');
  const [isSubmittingFreeze, setIsSubmittingFreeze] = useState(false);
  const [freezeError, setFreezeError] = useState<string | null>(null);

  // New Member Form State
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('+971');
  const [newEmail, setNewEmail] = useState('');
  const [newGender, setNewGender] = useState<'male' | 'female' | 'other'>('male');
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [newMemberError, setNewMemberError] = useState<string | null>(null);

  // 1. Initial Load: Shift status, Plans, Eligible Managers, Attendance Feed
  const fetchShift = useCallback(async () => {
    try {
      const res = await apiFetch('/v1/shifts/current');
      if (res.ok) {
        const data = await res.json();
        setActiveShift(data?.id ? data : null);
      }
    } catch {
      setActiveShift(null);
    }
  }, [apiFetch]);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await apiFetch('/v1/plans');
      if (res.ok) {
        const data = await res.json();
        const list: PlanEntity[] = Array.isArray(data) ? data : data?.data || [];
        const active = list.filter((p) => p.isActive);
        setPlans(active);
        if (active.length > 0 && !renewPlanId) {
          setRenewPlanId(active[0].id);
        }
      }
    } catch {
      setPlans([]);
    }
  }, [apiFetch, renewPlanId]);

  const fetchAttendanceFeed = useCallback(async () => {
    try {
      setIsLoadingFeed(true);
      const query = selectedBranchId ? `?branchId=${selectedBranchId}&limit=25` : '?limit=25';
      const res = await apiFetch(`/v1/attendance/history${query}`);
      if (res.ok) {
        const data = await res.json();
        setAttendanceFeed(Array.isArray(data?.items) ? data.items : []);
      }
    } catch {
      setAttendanceFeed([]);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [apiFetch, selectedBranchId]);

  const fetchManagers = useCallback(async () => {
    try {
      const res = await apiFetch('/v1/gyms/staff');
      if (res.ok) {
        const data = await res.json();
        const staffList: StaffMember[] = Array.isArray(data) ? data : [];
        const eligible = staffList.filter((s) => s.role === 'owner' || s.role === 'manager');
        setManagersList(eligible);
        if (eligible.length > 0) {
          const currentStaff = eligible.find((s) => s.userId === user?.id);
          setSelectedApproverId(currentStaff ? currentStaff.userId : eligible[0].userId);
        }
      }
    } catch {
      setManagersList([]);
    }
  }, [apiFetch, user?.id]);

  useEffect(() => {
    fetchShift();
    fetchPlans();
    fetchAttendanceFeed();
    fetchManagers();
  }, [fetchShift, fetchPlans, fetchAttendanceFeed, fetchManagers]);

  // 2. Member Search Debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHighlightedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch(`/v1/members?search=${encodeURIComponent(searchQuery.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          const items: MemberEntity[] = Array.isArray(data?.items) ? data.items : [];
          setSearchResults(items);
          setHighlightedIndex(items.length > 0 ? 0 : -1);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, apiFetch]);

  // 3. Load Full Member Details
  const loadMemberDetails = useCallback(async (memberId: string) => {
    setIsLoadingMember(true);
    setTapSuccessMessage(null);
    setTapErrorMessage(null);
    try {
      const res = await apiFetch(`/v1/members/${memberId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedMember(data);
        setSearchQuery('');
        setSearchResults([]);
        setIsSearchFocused(false);
      }
    } catch (err) {
      console.warn('Failed to load member profile:', err);
    } finally {
      setIsLoadingMember(false);
    }
  }, [apiFetch]);

  // Pin Lockout Countdown Timer
  useEffect(() => {
    if (pinLockoutSeconds === null || pinLockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setPinLockoutSeconds((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [pinLockoutSeconds]);

  // Resolve Active or Primary Membership
  const currentMembership = selectedMember?.memberships?.[0] || null;
  const membershipStatus = currentMembership?.status || 'none';
  const isFrozen = membershipStatus === 'frozen';
  const isExpired = membershipStatus === 'expired';
  const isActive = membershipStatus === 'active';

  // 4. Action: Check In Member (POST /v1/attendance/tap)
  const handleCheckIn = useCallback(async () => {
    if (!selectedMember || isCheckingIn) return;

    setIsCheckingIn(true);
    setTapSuccessMessage(null);
    setTapErrorMessage(null);

    try {
      const res = await apiFetch('/v1/attendance/tap', {
        method: 'POST',
        body: JSON.stringify({
          memberId: selectedMember.id,
          branchId: selectedBranchId || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTapSuccessMessage(
          `Entry Granted! ${selectedMember.user?.fullName || 'Member'} checked in. Streak: ${data.streak?.currentStreak || 1} visits this month.`
        );
        // Refresh attendance log
        fetchAttendanceFeed();
      } else {
        const errorReason = data?.reasons?.[0] || data?.code || data?.message || 'Access Denied';
        if (data?.code === 'DUPLICATE_TAP') {
          setTapErrorMessage(`Duplicate tap prevented: Attendance was already recorded recently.`);
        } else if (data?.code === 'MEMBERSHIP_FROZEN') {
          setTapErrorMessage(`Check-in blocked: Membership is frozen. Early unfreeze required.`);
        } else if (data?.code === 'MEMBERSHIP_NOT_ELIGIBLE') {
          setTapErrorMessage(`Access Denied: Membership is ${membershipStatus.toUpperCase()}. Please renew.`);
        } else {
          setTapErrorMessage(`Access Denied: ${errorReason}`);
        }
        fetchAttendanceFeed();
      }
    } catch {
      setTapErrorMessage('Network or server error verifying member check-in.');
    } finally {
      setIsCheckingIn(false);
    }
  }, [selectedMember, isCheckingIn, apiFetch, selectedBranchId, fetchAttendanceFeed, membershipStatus]);

  // 5. Action: Early Freeze Lift (POST /v1/freezes/:id/lift)
  const handleEarlyLift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMembership) return;

    setLiftError(null);
    setIsSubmittingLift(true);

    try {
      // Find active freeze ID
      const freezeId = currentMembership.activeFreezeId;
      if (!freezeId) {
        // Fallback: fetch active freeze for membership
        const freezeRes = await apiFetch(`/v1/freezes?membershipId=${currentMembership.id}&status=active`);
        const freezeData = await freezeRes.json();
        const activeFreeze = freezeData?.items?.[0];
        if (!activeFreeze) {
          setLiftError('No active freeze record found for this membership.');
          setIsSubmittingLift(false);
          return;
        }
      }

      const targetFreezeId = currentMembership.activeFreezeId;
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: activeGym?.timezone || 'Asia/Dubai' }).format(new Date());

      const res = await apiFetch(`/v1/freezes/${targetFreezeId}/lift`, {
        method: 'POST',
        body: JSON.stringify({
          liftedOnDate: todayStr,
          approverUserId: selectedApproverId || undefined,
          managerPin: managerPin || undefined,
          reason: liftReason || 'early_return_authorized',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsEarlyLiftModalOpen(false);
        setManagerPin('');
        setTapSuccessMessage('Freeze successfully lifted early! Membership is now active.');
        // Reload fresh member state
        await loadMemberDetails(selectedMember!.id);
      } else if (res.status === 423 || data.code === 'PIN_LOCKED') {
        setPinLockoutSeconds(15 * 60);
        setLiftError('Security Lockout: Manager PIN is locked due to too many failed attempts. Try again in 15 minutes.');
      } else {
        setLiftError(data.message || 'Failed to lift freeze. Check Manager PIN and permissions.');
      }
    } catch {
      setLiftError('Network error executing early freeze lift.');
    } finally {
      setIsSubmittingLift(false);
    }
  };

  // 6. Action: Quick Membership Renewal (POST /v1/sales/memberships)
  const handleRenewSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !renewPlanId) return;

    setRenewError(null);
    setIsSubmittingRenew(true);

    if (['cash', 'card_pos'].includes(renewPaymentMethod) && !activeShift) {
      setRenewError('Cash and POS Card sales require an open cashier shift. Please open a shift first.');
      setIsSubmittingRenew(false);
      return;
    }

    try {
      const idempotencyKey = `desk-sale-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const res = await apiFetch('/v1/sales/memberships', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          memberId: selectedMember.id,
          planId: renewPlanId,
          branchId: selectedBranchId || branches[0]?.id,
          method: renewPaymentMethod,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setLastInvoiceNumber(data.invoice?.invoiceNumber || data.invoiceNumber || 'INV-SUCCESS');
        setIsRenewModalOpen(false);
        setTapSuccessMessage(`Membership activated successfully! Invoice ${data.invoice?.invoiceNumber || ''} issued.`);
        await loadMemberDetails(selectedMember.id);
      } else {
        setRenewError(data.message || 'Sale checkout failed.');
      }
    } catch {
      setRenewError('Network error processing membership sale.');
    } finally {
      setIsSubmittingRenew(false);
    }
  };

  // 7. Action: Request Membership Freeze (POST /v1/memberships/:id/freezes)
  const handleRequestFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMembership) return;

    setFreezeError(null);
    setIsSubmittingFreeze(true);

    if (!freezeStartDate || !freezeEndDate) {
      setFreezeError('Both freeze start date and end date are required.');
      setIsSubmittingFreeze(false);
      return;
    }

    try {
      const res = await apiFetch(`/v1/memberships/${currentMembership.id}/freezes`, {
        method: 'POST',
        body: JSON.stringify({
          startDate: freezeStartDate,
          endDate: freezeEndDate,
          reasonCode: freezeReasonCode,
          reasonNote: freezeReasonNote.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsFreezeModalOpen(false);
        setFreezeStartDate('');
        setFreezeEndDate('');
        setFreezeReasonNote('');
        setTapSuccessMessage('Freeze request submitted successfully!');
        await loadMemberDetails(selectedMember!.id);
      } else {
        setFreezeError(data.message || 'Failed to submit freeze request.');
      }
    } catch {
      setFreezeError('Network error requesting membership freeze.');
    } finally {
      setIsSubmittingFreeze(false);
    }
  };

  // 8. Action: Quick Register Walk-in Member (POST /v1/members)
  const handleRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewMemberError(null);
    setIsSubmittingMember(true);

    if (!newFullName.trim() || !newPhone.trim()) {
      setNewMemberError('Full name and phone (+971...) are required.');
      setIsSubmittingMember(false);
      return;
    }

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
        setIsRegisterModalOpen(false);
        setNewFullName('');
        setNewPhone('+971');
        setNewEmail('');
        // Immediately load the newly created member into the snapshot card!
        await loadMemberDetails(data.id);
        setTapSuccessMessage(`Member "${data.user?.fullName || 'Walk-in'}" registered successfully!`);
      } else {
        setNewMemberError(data.message || 'Failed to create member record.');
      }
    } catch {
      setNewMemberError('Network error registering new member.');
    } finally {
      setIsSubmittingMember(false);
    }
  };

  // 9. Keyboard Shortcuts Listener (Kiosk fast navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input/textarea except Enter in search
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (isEarlyLiftModalOpen || isRenewModalOpen || isFreezeModalOpen || isRegisterModalOpen) {
          setIsEarlyLiftModalOpen(false);
          setIsRenewModalOpen(false);
          setIsFreezeModalOpen(false);
          setIsRegisterModalOpen(false);
        } else if (searchResults.length > 0) {
          setSearchResults([]);
        } else if (selectedMember) {
          setSelectedMember(null);
        }
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (selectedMember) setIsRenewModalOpen(true);
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (selectedMember && isFrozen) setIsEarlyLiftModalOpen(true);
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (selectedMember && isActive) setIsFreezeModalOpen(true);
        return;
      }

      // Enter for check-in when snapshot card is open and modal not open
      if (e.key === 'Enter' && !isInput && selectedMember && (isActive || !isFrozen)) {
        e.preventDefault();
        handleCheckIn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isEarlyLiftModalOpen,
    isRenewModalOpen,
    isFreezeModalOpen,
    isRegisterModalOpen,
    searchResults,
    selectedMember,
    isFrozen,
    isActive,
    handleCheckIn,
  ]);

  // Search results keyboard navigation
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
        loadMemberDetails(searchResults[highlightedIndex].id);
      }
    }
  };

  const selectedPlanDetails = plans.find((p) => p.id === renewPlanId);

  return (
    <div className="flex flex-col w-full pb-16 font-sans">
      {/* Top Front Desk Header Bar */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131722] border-b border-[#2A3241] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            <span>Reception Operations</span>
            <span className="text-slate-600">/</span>
            <span className="text-[#D4FF00] font-bold">Front-Desk Kiosk (/desk)</span>
          </div>
          <h1 className="text-xl font-bold text-white font-display mt-0.5">
            Turnstile Access &amp; Member Snapshot
          </h1>
        </div>

        {/* Right Header Controls: Branch Scope & Cashier Shift Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Branch Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1E2430] border border-[#2A3241] text-xs text-white">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              {branches.length > 0 ? (
                branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#1E2430] text-white">
                    {b.name} ({b.code})
                  </option>
                ))
              ) : (
                <option value="" className="bg-[#1E2430] text-white">
                  Main Facility Branch
                </option>
              )}
            </select>
          </div>

          {/* Cashier Shift Status */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
              activeShift
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span>{activeShift ? 'Shift Active' : 'No Open Shift'}</span>
          </div>

          {/* Walk-in Register Button */}
          <button
            type="button"
            onClick={() => {
              setIsRegisterModalOpen(true);
              setNewMemberError(null);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1E2430] hover:bg-[#2A3241] border border-[#2A3241] text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#D4FF00]" />
            <span>+ Walk-In Register</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Real-Time Command Search Bar */}
        <div className="relative w-full">
          <div className="relative flex items-center w-full">
            <Search className="w-5 h-5 absolute left-4 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search member by Name, Phone (+971...), or Member Number (#MEM-XXXX)... [Ctrl+K]"
              className="w-full bg-[#1E2430] text-white placeholder:text-slate-400 text-sm pl-12 pr-28 py-3.5 rounded-xl border border-[#2A3241] focus:border-[#D4FF00] focus:ring-1 focus:ring-[#D4FF00] focus:outline-none transition-all shadow-sm"
            />
            <div className="absolute right-4 flex items-center gap-1.5 pointer-events-none">
              <kbd className="px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-[#131722] border border-[#2A3241] rounded">
                Ctrl+K
              </kbd>
              <kbd className="px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-[#131722] border border-[#2A3241] rounded">
                Enter ↵
              </kbd>
            </div>
          </div>

          {/* Search Results Dropdown */}
          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1E2430] border border-[#2A3241] rounded-xl shadow-2xl z-40 overflow-hidden divide-y divide-[#2A3241]/60 animate-in fade-in duration-100">
              <div className="px-4 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-[#131722]/80 flex justify-between">
                <span>Matching Member Directory</span>
                <span>Use ↑ ↓ to navigate • Enter to select</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {searchResults.map((mem, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <button
                      key={mem.id}
                      type="button"
                      onClick={() => loadMemberDetails(mem.id)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors cursor-pointer ${
                        isHighlighted ? 'bg-[#2A3241] text-white' : 'hover:bg-[#2A3241]/50 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-[#2A3241] flex items-center justify-center font-bold text-xs text-white shrink-0">
                          {mem.user?.fullName ? mem.user.fullName.slice(0, 2).toUpperCase() : 'GP'}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-white">
                            {mem.user?.fullName || 'Gym Member'}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <span className="font-mono text-slate-300">{mem.memberNumber}</span>
                            <span>•</span>
                            <span>{mem.user?.phone || 'No phone'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            mem.status === 'active'
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                              : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                          }`}
                        >
                          {mem.status.toUpperCase()}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isSearchFocused && searchQuery.trim() && searchResults.length === 0 && !isSearching && (
            <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-[#1E2430] border border-[#2A3241] rounded-xl text-center text-xs text-slate-400 shadow-xl z-40">
              No members found matching &quot;{searchQuery}&quot;. Press &quot;+ Walk-In Register&quot; to enroll a new member.
            </div>
          )}
        </div>

        {/* Status Alerts */}
        {tapSuccessMessage && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-200 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-medium text-sm text-white">{tapSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setTapSuccessMessage(null)}
              className="text-emerald-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {tapErrorMessage && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center justify-between gap-3 text-xs text-red-200 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span className="font-semibold text-sm text-red-200">{tapErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setTapErrorMessage(null)}
              className="text-red-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Grid: Member Snapshot Card (2/3) + Real-time Attendance Feed (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Member Snapshot Card */}
          <div className="lg:col-span-8 space-y-4">
            {isLoadingMember ? (
              <div className="rounded-xl bg-[#1E2430] border border-[#2A3241] p-12 text-center text-slate-400">
                <Clock className="w-8 h-8 animate-spin mx-auto text-[#D4FF00] mb-3" />
                <p className="text-sm font-semibold text-white">Loading Member Snapshot...</p>
                <p className="text-xs text-slate-400 mt-1 font-mono">Fetching membership eligibility &amp; freeze status</p>
              </div>
            ) : selectedMember ? (
              <div className="rounded-xl bg-[#1E2430] border border-[#2A3241] overflow-hidden shadow-sm">
                {/* Snapshot Header */}
                <div className="p-6 bg-[#131722] border-b border-[#2A3241] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl text-white shrink-0 border ${
                        isActive
                          ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                          : isFrozen
                          ? 'bg-amber-950 border-amber-500/50 text-amber-300'
                          : isExpired
                          ? 'bg-red-950 border-red-500/50 text-red-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {selectedMember.user?.fullName
                        ? selectedMember.user.fullName
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                        : 'GP'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-white font-display">
                          {selectedMember.user?.fullName || 'Gym Member'}
                        </h2>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#1E2430] border border-[#2A3241] text-slate-300 font-bold">
                          {selectedMember.memberNumber}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                        <span>{selectedMember.user?.phone || 'No phone'}</span>
                        <span>•</span>
                        <span>{selectedMember.user?.email || 'No email registered'}</span>
                        <span>•</span>
                        <span className="text-slate-300">
                          {selectedMember.homeBranch?.name || 'Main Branch'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Clear selection button */}
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-[#1E2430] hover:bg-[#2A3241] border border-[#2A3241] text-xs text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Clear [Esc]</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Status & Plan Body */}
                <div className="p-6 space-y-6">
                  {/* Status Banner */}
                  {isActive && (
                    <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-emerald-300">
                            Clear for Turnstile Entry (ACTIVE)
                          </div>
                          <div className="text-xs text-emerald-200/80 mt-0.5">
                            Subscription verified with zero outstanding freeze or billing disputes.
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                        ENTRY OK
                      </span>
                    </div>
                  )}

                  {isFrozen && (
                    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Lock className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-amber-300">
                            Membership is FROZEN
                          </div>
                          <div className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                            Turnstile entry blocked. Early return requires Manager step-up PIN verification.
                            {currentMembership?.freezeEndDate && (
                              <span className="font-semibold block mt-1">
                                Scheduled End Date: {currentMembership.freezeEndDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEarlyLiftModalOpen(true);
                          setLiftError(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
                      >
                        [Alt+L] Lift Freeze
                      </button>
                    </div>
                  )}

                  {isExpired && (
                    <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-red-300">
                            Membership EXPIRED
                          </div>
                          <div className="text-xs text-red-200/90 mt-1 leading-relaxed">
                            Access end date passed ({currentMembership?.endDate || 'Term Ended'}). Standard tap is blocked.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRenewModalOpen(true);
                          setRenewError(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#D4FF00] hover:bg-[#bcf000] text-[#121800] text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
                      >
                        [Alt+P] Renew Plan
                      </button>
                    </div>
                  )}

                  {/* Plan & Financial Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241]">
                      <div className="text-xs text-slate-400 font-medium">Active Plan Tier</div>
                      <div className="text-base font-bold text-white mt-1 truncate">
                        {currentMembership?.planTitle || 'No Active Plan'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Status: <span className="font-semibold text-slate-200 uppercase">{membershipStatus}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241]">
                      <div className="text-xs text-slate-400 font-medium">Valid Term Dates</div>
                      <div className="text-sm font-semibold text-white mt-1 font-mono">
                        {currentMembership
                          ? `${currentMembership.startDate} → ${currentMembership.endDate}`
                          : 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Inclusive UAE Calendar Term
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241]">
                      <div className="text-xs text-slate-400 font-medium">Outstanding Balance</div>
                      <div className="text-base font-bold text-white mt-1 font-stat-metric">
                        0.00 <span className="text-xs font-normal text-slate-400">{currency}</span>
                      </div>
                      <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Good Standing</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Bar (The Core Kiosk Actions) */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    {/* Primary Button: Check In (Volt Lime #D4FF00) */}
                    <button
                      type="button"
                      disabled={isCheckingIn || isFrozen}
                      onClick={handleCheckIn}
                      className={`w-full sm:flex-1 py-3 px-6 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                        isFrozen
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          : 'bg-[#D4FF00] hover:bg-[#c2ed00] active:scale-[0.99] text-[#121800] shadow-[#D4FF00]/15'
                      }`}
                    >
                      {isCheckingIn ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          <span>Verifying Access...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-[#121800]" />
                          <span>Check In Member</span>
                          <kbd className="px-1.5 py-0.5 text-[10px] bg-[#121800]/20 text-[#121800] font-sans rounded ml-1">
                            Enter ↵
                          </kbd>
                        </>
                      )}
                    </button>

                    {/* Secondary Action: Renew / Collect Payment */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRenewModalOpen(true);
                        setRenewError(null);
                      }}
                      className="w-full sm:w-auto px-4 py-3 rounded-lg bg-[#1E2430] hover:bg-[#2A3241] border border-[#2A3241] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4 text-slate-300" />
                      <span>Renew / Pay</span>
                      <kbd className="px-1.5 py-0.5 text-[10px] bg-[#131722] text-slate-400 border border-[#2A3241] rounded">
                        Alt+P
                      </kbd>
                    </button>

                    {/* Secondary Action: Freeze Request */}
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsFreezeModalOpen(true);
                          setFreezeError(null);
                        }}
                        className="w-full sm:w-auto px-4 py-3 rounded-lg bg-[#1E2430] hover:bg-[#2A3241] border border-[#2A3241] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Lock className="w-4 h-4 text-slate-300" />
                        <span>Request Freeze</span>
                        <kbd className="px-1.5 py-0.5 text-[10px] bg-[#131722] text-slate-400 border border-[#2A3241] rounded">
                          Alt+F
                        </kbd>
                      </button>
                    )}

                    {/* Early Lift Button if Frozen */}
                    {isFrozen && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEarlyLiftModalOpen(true);
                          setLiftError(null);
                        }}
                        className="w-full sm:w-auto px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Early Lift (PIN)</span>
                        <kbd className="px-1.5 py-0.5 text-[10px] bg-black/20 text-slate-950 rounded">
                          Alt+L
                        </kbd>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty Kiosk State */
              <div className="rounded-xl bg-[#1E2430] border border-[#2A3241] p-12 text-center shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-[#2A3241] flex items-center justify-center mx-auto mb-4 text-[#D4FF00]">
                  <Dumbbell className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white font-display">
                  Front Desk Ready for Check-In
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  Search member above with Name, Phone (+971...), or Member Number (#MEM-XXXX) to load eligibility snapshot.
                </p>

                {/* Hotkeys Cheat Sheet */}
                <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-left">
                  <div className="p-3 rounded-lg bg-[#131722] border border-[#2A3241]">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Search</span>
                    <span className="font-mono text-xs font-bold text-white block mt-0.5">Ctrl + K</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#131722] border border-[#2A3241]">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Check In</span>
                    <span className="font-mono text-xs font-bold text-[#D4FF00] block mt-0.5">Enter ↵</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#131722] border border-[#2A3241]">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Early Lift</span>
                    <span className="font-mono text-xs font-bold text-amber-400 block mt-0.5">Alt + L</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#131722] border border-[#2A3241]">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Renew / Pay</span>
                    <span className="font-mono text-xs font-bold text-white block mt-0.5">Alt + P</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Shift Attendance Feed */}
          <div className="lg:col-span-4">
            <div className="rounded-xl bg-[#1E2430] border border-[#2A3241] overflow-hidden shadow-xs">
              <div className="px-4 py-3 bg-[#131722] border-b border-[#2A3241] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#D4FF00]" />
                  <h3 className="font-bold text-xs text-white uppercase tracking-wider">
                    Recent Check-In Log
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={fetchAttendanceFeed}
                  className="text-[10px] text-slate-400 hover:text-white font-medium cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              <div className="divide-y divide-[#2A3241]/60 max-h-[560px] overflow-y-auto">
                {isLoadingFeed && attendanceFeed.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-500" />
                    <span>Syncing attendance telemetry...</span>
                  </div>
                ) : attendanceFeed.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No check-in activity recorded yet for this facility shift.
                  </div>
                ) : (
                  attendanceFeed.map((log) => {
                    const isAllowed = log.result === 'allowed' || log.result === 'override_allowed';
                    const timeStr = new Intl.DateTimeFormat('en-US', {
                      timeZone: activeGym?.timezone || 'Asia/Dubai',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    }).format(new Date(log.createdAt));

                    return (
                      <div
                        key={log.id}
                        onClick={() => {
                          if (log.memberId) loadMemberDetails(log.memberId);
                        }}
                        className="p-3.5 hover:bg-[#2A3241]/40 transition-colors flex items-start justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              isAllowed
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-950/60 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {isAllowed ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-white group-hover:text-[#D4FF00] transition-colors">
                              {log.member?.fullName || 'Turnstile Access'}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {isAllowed ? (
                                <span className="text-emerald-400 font-medium">Access Granted</span>
                              ) : (
                                <span className="text-red-400 font-medium">{log.denyReason || 'Denied'}</span>
                              )}
                              {log.member?.memberNumber && (
                                <span className="font-mono text-slate-400 ml-1.5">
                                  #{log.member.memberNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-[10px] text-slate-400">{timeStr}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Modal 1: Early Freeze Lift with Manager PIN Step-Up           */}
      {/* ------------------------------------------------------------- */}
      {isEarlyLiftModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-xl bg-[#1E2430] border border-[#2A3241] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Manager PIN Step-Up Authorization</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEarlyLiftModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Early freeze lift returns the member to active status before the scheduled end date. Requires a verified Manager or Owner PIN.
            </p>

            {pinLockoutSeconds !== null && (
              <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-500/50 flex items-center gap-2 text-xs text-red-200">
                <Lock className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <span className="font-bold text-red-300">PIN Locked:</span> 5 failed attempts reached. Please wait{' '}
                  <span className="font-mono font-bold">{Math.floor(pinLockoutSeconds / 60)}m {pinLockoutSeconds % 60}s</span> before retrying.
                </div>
              </div>
            )}

            {liftError && pinLockoutSeconds === null && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-300">
                {liftError}
              </div>
            )}

            <form onSubmit={handleEarlyLift} className="space-y-4">
              {/* Approver Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Authorizing Manager / Owner
                </label>
                <select
                  value={selectedApproverId}
                  onChange={(e) => setSelectedApproverId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none cursor-pointer"
                >
                  {managersList.length > 0 ? (
                    managersList.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user?.fullName || m.role.toUpperCase()} ({m.role})
                      </option>
                    ))
                  ) : (
                    <option value={user?.id || ''}>
                      {user?.name || 'Current Staff'} ({userRole})
                    </option>
                  )}
                </select>
              </div>

              {/* Manager PIN Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Manager Security PIN (4–8 digits)
                </label>
                <input
                  type="password"
                  autoFocus
                  maxLength={8}
                  disabled={pinLockoutSeconds !== null}
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#131722] border border-[#2A3241] text-white text-center font-mono text-lg tracking-[0.5em] focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Return Authorization Reason
                </label>
                <input
                  type="text"
                  value={liftReason}
                  onChange={(e) => setLiftReason(e.target.value)}
                  placeholder="early_return_authorized"
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEarlyLiftModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLift || !managerPin || pinLockoutSeconds !== null}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  {isSubmittingLift ? 'Verifying PIN...' : 'Authorize & Lift Freeze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 2: Quick Renewal / Payment Checkout                    */}
      {/* ------------------------------------------------------------- */}
      {isRenewModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-xl bg-[#1E2430] border border-[#2A3241] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#D4FF00]" />
                <h3 className="font-bold text-sm text-white">Membership Renewal &amp; Checkout</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRenewModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renewError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-300">
                {renewError}
              </div>
            )}

            {!activeShift && ['cash', 'card_pos'].includes(renewPaymentMethod) && (
              <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-500/40 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>No open cashier shift. Cash/POS sales will require an open shift.</span>
              </div>
            )}

            <form onSubmit={handleRenewSale} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Membership Plan
                </label>
                <select
                  value={renewPlanId}
                  onChange={(e) => setRenewPlanId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none cursor-pointer"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {(p.priceMinor / 100).toFixed(2)} {currency} ({p.intervalCount} {p.intervalUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRenewPaymentMethod('card_pos')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      renewPaymentMethod === 'card_pos'
                        ? 'bg-slate-800 border-[#D4FF00] text-white'
                        : 'bg-[#131722] border-[#2A3241] text-slate-400 hover:text-white'
                    }`}
                  >
                    Card POS
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenewPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      renewPaymentMethod === 'cash'
                        ? 'bg-slate-800 border-[#D4FF00] text-white'
                        : 'bg-[#131722] border-[#2A3241] text-slate-400 hover:text-white'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenewPaymentMethod('bank_transfer')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      renewPaymentMethod === 'bank_transfer'
                        ? 'bg-slate-800 border-[#D4FF00] text-white'
                        : 'bg-[#131722] border-[#2A3241] text-slate-400 hover:text-white'
                    }`}
                  >
                    Bank Transfer
                  </button>
                </div>
              </div>

              {/* Price Calculation Summary */}
              {selectedPlanDetails && (
                <div className="p-3.5 rounded-lg bg-[#131722] border border-[#2A3241] space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Base Plan Price:</span>
                    <span>{((selectedPlanDetails.priceMinor / 100) / 1.05).toFixed(2)} {currency}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>UAE VAT (5% inclusive):</span>
                    <span>{((selectedPlanDetails.priceMinor / 100) - ((selectedPlanDetails.priceMinor / 100) / 1.05)).toFixed(2)} {currency}</span>
                  </div>
                  <div className="pt-1.5 border-t border-[#2A3241] flex justify-between font-bold text-sm text-white">
                    <span>Total Amount Payable:</span>
                    <span className="font-stat-metric text-[#D4FF00]">
                      {(selectedPlanDetails.priceMinor / 100).toFixed(2)} {currency}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRenew}
                  className="px-5 py-2.5 rounded-lg bg-[#D4FF00] hover:bg-[#bcf000] text-[#121800] text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  {isSubmittingRenew ? 'Processing...' : 'Complete Sale & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 3: Request Freeze                                        */}
      {/* ------------------------------------------------------------- */}
      {isFreezeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-xl bg-[#1E2430] border border-[#2A3241] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241]">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Request Membership Freeze</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFreezeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {freezeError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-300">
                {freezeError}
              </div>
            )}

            <form onSubmit={handleRequestFreeze} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={freezeStartDate}
                    onChange={(e) => setFreezeStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={freezeEndDate}
                    onChange={(e) => setFreezeEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason Code</label>
                <select
                  value={freezeReasonCode}
                  onChange={(e) => setFreezeReasonCode(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none cursor-pointer"
                >
                  <option value="travel">Travel / Relocation</option>
                  <option value="medical">Medical / Injury</option>
                  <option value="religious_observance">Religious Observance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason Note (Optional)</label>
                <input
                  type="text"
                  maxLength={500}
                  value={freezeReasonNote}
                  onChange={(e) => setFreezeReasonNote(e.target.value)}
                  placeholder="Medical note or travel itinerary summary"
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFreezeModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFreeze}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  {isSubmittingFreeze ? 'Submitting...' : 'Submit Freeze Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 4: Quick Walk-in Member Registration                     */}
      {/* ------------------------------------------------------------- */}
      {isRegisterModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-xl bg-[#1E2430] border border-[#2A3241] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241]">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D4FF00]" />
                <h3 className="font-bold text-sm text-white">Enroll Walk-In Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newMemberError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-300">
                {newMemberError}
              </div>
            )}

            <form onSubmit={handleRegisterMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Rashid Al-Maktoum"
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (E.164)</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+971501234567"
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white font-mono focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="member@example.ae"
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Gender</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none cursor-pointer"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Home Branch</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMember}
                  className="px-5 py-2.5 rounded-lg bg-[#D4FF00] hover:bg-[#bcf000] text-[#121800] text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  {isSubmittingMember ? 'Creating...' : 'Enroll Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
