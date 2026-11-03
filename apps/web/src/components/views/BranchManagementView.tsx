import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ArrowRight,
  X,
  Activity,
  ShieldCheck,
  Zap,
} from '../ui/icons';

interface BranchAddress {
  street?: string;
  city?: string;
  emirate?: string;
  country?: string;
  postalCode?: string;
}

interface BranchItem {
  id: string;
  gymId: string;
  name: string;
  address: BranchAddress;
  isActive: boolean;
  createdAt?: string;
  isMain?: boolean;
}

export function BranchManagementView() {
  const { activeGym, userRole, apiFetch, refreshGyms } = useAuth();
  const isOwnerOrManager = userRole === 'owner' || userRole === 'manager';
  const isGymActive = activeGym?.status === 'active';

  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Branch limit exceeded state
  const [branchLimitInfo, setBranchLimitInfo] = useState<{
    currentCount: number;
    maxAllowed: number;
  } | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);

  // Create Form State
  const [newName, setNewName] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newCity, setNewCity] = useState('Dubai');
  const [newEmirate, setNewEmirate] = useState('Dubai');
  const [newCountry, setNewCountry] = useState('United Arab Emirates');
  const [newPostalCode, setNewPostalCode] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editCity, setEditCity] = useState('Dubai');
  const [editEmirate, setEditEmirate] = useState('Dubai');
  const [editCountry, setEditCountry] = useState('United Arab Emirates');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Fetch branches from API
  // Fetch branches from API
  const fetchBranches = useCallback(async () => {
    setIsLoading(true);

    try {
      const res = await apiFetch('/v1/branches');
      if (res.ok) {
        const data = await res.json();
        const list: BranchItem[] = Array.isArray(data) ? data : [];
        setBranches(list);
      } else {
        setBranches([]);
      }
    } catch (err) {
      console.warn('Failed to fetch branches:', err);
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Handle Create Branch (POST /v1/branches)
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setBranchLimitInfo(null);

    if (!newName.trim() || newName.trim().length < 2) {
      setActionError('Branch name must be at least 2 characters.');
      return;
    }

    // Allow active gyms OR pending_verification gyms (up to sandbox limit of 2 branches)
    if (!isGymActive && activeGym?.status !== 'pending_verification') {
      setActionError(
        'Creating additional branches requires an active or pending verification gym.'
      );
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await apiFetch('/v1/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          address: {
            street: newStreet.trim() || undefined,
            city: newCity.trim() || 'Dubai',
            emirate: newEmirate.trim() || 'Dubai',
            country: newCountry.trim() || 'United Arab Emirates',
            postalCode: newPostalCode.trim() || undefined,
          },
          isActive: newIsActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccess(`Branch "${newName.trim()}" created successfully!`);
        setIsCreateModalOpen(false);
        setNewName('');
        setNewStreet('');
        setNewPostalCode('');
        setNewIsActive(true);
        await fetchBranches();
        if (refreshGyms) await refreshGyms();
      } else if (data?.code === 'BRANCH_LIMIT_EXCEEDED' || data?.code === 'SUBSCRIPTION_LIMIT_REACHED') {
        // Close the modal and show the upgrade banner
        setIsCreateModalOpen(false);
        setBranchLimitInfo({
          currentCount: data.current_usage ?? data.currentCount ?? branches.length,
          maxAllowed: data.max_allowed ?? data.maxAllowed ?? 2,
        });
      } else {
        setActionError(data?.message || 'Failed to create branch.');
      }
    } catch {
      setActionError('Network error creating branch.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (b: BranchItem) => {
    setEditingBranch(b);
    setEditName(b.name);
    setEditStreet(b.address?.street || '');
    setEditCity(b.address?.city || 'Dubai');
    setEditEmirate(b.address?.emirate || 'Dubai');
    setEditCountry(b.address?.country || 'United Arab Emirates');
    setEditPostalCode(b.address?.postalCode || '');
    setEditIsActive(b.isActive !== false);
    setActionError(null);
  };

  // Handle Update Branch (PATCH /v1/branches/:id)
  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    setActionError(null);
    setActionSuccess(null);

    if (!editName.trim() || editName.trim().length < 2) {
      setActionError('Branch name must be at least 2 characters.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const res = await apiFetch(`/v1/branches/${editingBranch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          address: {
            street: editStreet.trim() || undefined,
            city: editCity.trim() || 'Dubai',
            emirate: editEmirate.trim() || 'Dubai',
            country: editCountry.trim() || 'United Arab Emirates',
            postalCode: editPostalCode.trim() || undefined,
          },
          isActive: editIsActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccess(`Branch "${editName.trim()}" updated successfully!`);
        setEditingBranch(null);
        await fetchBranches();
        if (refreshGyms) await refreshGyms();
      } else {
        setActionError(data?.message || 'Failed to update branch.');
      }
    } catch {
      setActionError('Network error updating branch.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Filtered branches
  const filteredBranches = branches.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      (b.address?.city && b.address.city.toLowerCase().includes(q)) ||
      (b.address?.emirate && b.address.emirate.toLowerCase().includes(q)) ||
      b.id.toLowerCase().includes(q)
    );
  });

  const activeBranchesCount = branches.filter((b) => b.isActive).length;
  const inactiveBranchesCount = branches.length - activeBranchesCount;

  return (
    <div className="flex flex-col w-full pb-16 font-sans">
      {/* Top Header */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131722] border-b border-[#2A3241] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            <span>{activeGym?.tradeName || 'GymPulse'}</span>
            <span className="text-slate-600">/</span>
            <span className="text-[#D4FF00] font-bold">Facility Infrastructure</span>
          </div>
          <h1 className="text-xl font-bold text-white font-display mt-0.5 flex items-center gap-2">
            <span>Branch Locations &amp; Facilities</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-[#1E2430] border border-[#2A3241] text-slate-300">
              {branches.length} {branches.length === 1 ? 'Node' : 'Nodes'}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {isOwnerOrManager && (
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(true);
                setActionError(null);
                setActionSuccess(null);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] text-xs font-bold transition-all cursor-pointer shadow-sm shadow-[#D4FF00]/15"
            >
              <Plus className="w-4 h-4 text-[#121800]" />
              <span>+ Create New Branch</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Branch Limit Exceeded — Upgrade Alert */}
        {branchLimitInfo && (
          <div className="p-5 rounded-xl bg-gradient-to-r from-amber-950/50 via-amber-950/30 to-[#1E2430] border border-amber-500/40 shadow-lg shadow-amber-500/5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div className="space-y-2">
                  <div>
                    <h3 className="font-bold text-sm text-amber-200">
                      Branch Limit Reached
                    </h3>
                    <p className="text-xs text-amber-200/80 mt-1 leading-relaxed max-w-lg">
                      You&apos;re currently using <strong className="text-white">{branchLimitInfo.currentCount}</strong> out
                      of <strong className="text-white">{branchLimitInfo.maxAllowed}</strong> branches
                      allowed on your plan. To add more locations, upgrade your membership.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        // Navigate directly to subscription/upgrade page
                        window.location.hash = '#/settings?tab=subscription';
                        window.dispatchEvent(
                          new CustomEvent('gympulse:navigate', {
                            detail: { nav: 'settings', tab: 'subscription' },
                          })
                        );
                        setBranchLimitInfo(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-[#1a1000] text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-500/20"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Upgrade Membership</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-amber-300/60 font-mono">
                      {branchLimitInfo.currentCount}/{branchLimitInfo.maxAllowed} branches used
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBranchLimitInfo(null)}
                className="text-amber-400/60 hover:text-amber-200 transition-colors p-1 shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Verification Warning if Gym Pending */}
        {!isGymActive && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3 text-xs text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-300">
                Facility Verification Notice (Current Status: {activeGym?.status || 'pending_verification'})
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                Secondary branch provisioning is gated by UAE KYC compliance rules. Complete your Trade License and TRN verification in the Compliance tab to unlock multi-branch scaling.
              </p>
            </div>
          </div>
        )}

        {/* Action Alerts */}
        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-200 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-medium text-sm text-white">{actionSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionSuccess(null)}
              className="text-emerald-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center justify-between gap-3 text-xs text-red-200 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span className="font-semibold text-sm text-red-200">{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Telemetry Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#1E2430] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total Locations</span>
              <Building2 className="w-4 h-4 text-[#D4FF00]" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading ? '...' : branches.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Multi-branch network
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#1E2430] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Active Facilities</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading ? '...' : activeBranchesCount}
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5 font-medium">
              Accepting check-ins
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#1E2430] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Inactive / Paused</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading ? '...' : inactiveBranchesCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Gates offline
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#1E2430] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Operating Territory</span>
              <ShieldCheck className="w-4 h-4 text-slate-300" />
            </div>
            <div className="text-xl font-bold text-white font-display mt-0.5 truncate">
              {branches[0]?.address?.country || 'UAE'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              UAE VAT 5% Zone
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by branch name, city, emirate..."
              className="w-full bg-[#1E2430] text-white placeholder:text-slate-400 text-xs pl-10 pr-4 py-2.5 rounded-lg border border-[#2A3241] focus:border-[#D4FF00] focus:outline-none transition-colors"
            />
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Showing {filteredBranches.length} of {branches.length} branches
          </div>
        </div>

        {/* Branches Grid */}
        {isLoading ? (
          <div className="p-16 rounded-xl bg-[#1E2430] border border-[#2A3241] text-center text-slate-400">
            <Clock className="w-6 h-6 animate-spin mx-auto text-[#D4FF00] mb-2" />
            <span className="text-xs">Loading facility network...</span>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="p-16 rounded-xl bg-[#1E2430] border border-[#2A3241] text-center text-slate-400 space-y-2">
            <Building2 className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
            <div className="text-sm font-bold text-white">No Branches Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery.trim()
                ? `No branches match "${searchQuery}". Try clearing the search filter.`
                : 'No branch locations configured yet. Click "+ Create New Branch" to add your first facility.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBranches.map((branch, idx) => {
              const isMain = idx === 0 || branch.isMain;
              const addr = branch.address || {};
              const fullAddressStr = [addr.street, addr.city, addr.emirate, addr.country]
                .filter(Boolean)
                .join(', ');

              return (
                <div
                  key={branch.id}
                  className="rounded-xl bg-[#1E2430] border border-[#2A3241] p-5 shadow-xs flex flex-col justify-between hover:border-slate-600 transition-colors"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#2A3241]/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#131722] border border-[#2A3241] flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-[#D4FF00]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-white font-display">
                              {branch.name}
                            </h3>
                            {isMain && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#D4FF00]/15 text-[#D4FF00] border border-[#D4FF00]/30 uppercase">
                                Main Hub
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            ID: {branch.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          branch.isActive
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                            : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                        }`}
                      >
                        {branch.isActive ? 'ACTIVE NODE' : 'PAUSED'}
                      </span>
                    </div>

                    {/* Address & City Details */}
                    <div className="py-4 space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400 shrink-0 font-medium w-16">Location:</span>
                        <span className="text-slate-200">
                          {fullAddressStr || 'Dubai, United Arab Emirates'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 shrink-0 font-medium w-16">Territory:</span>
                        <span className="text-slate-300 font-semibold">
                          {addr.emirate || 'Dubai'}, {addr.country || 'UAE'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 shrink-0 font-medium w-16">Security:</span>
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Tenant-Scoped Turnstile Gateway</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-[#2A3241]/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {branch.createdAt ? new Date(branch.createdAt).toLocaleDateString() : 'Active'}
                    </span>

                    {isOwnerOrManager && (
                      <button
                        type="button"
                        onClick={() => openEditModal(branch)}
                        className="px-3 py-1.5 rounded-lg bg-[#131722] hover:bg-[#2A3241] border border-[#2A3241] text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
                      >
                        Edit Location
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Modal 1: Create New Branch                                    */}
      {/* ------------------------------------------------------------- */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-xl bg-[#1E2430] border border-[#2A3241] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#D4FF00]" />
                <h3 className="font-bold text-sm text-white">Create New Facility Branch</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Provision a new physical facility branch for <strong className="text-white">{activeGym?.tradeName}</strong>. Members and turnstile scanners can be assigned to this branch location.
            </p>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Branch Commercial Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dubai Marina Health Club"
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={newStreet}
                  onChange={(e) => setNewStreet(e.target.value)}
                  placeholder="e.g. Al Marsa Street, Tower 2, Ground Floor"
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Emirate</label>
                  <select
                    value={newEmirate}
                    onChange={(e) => setNewEmirate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none cursor-pointer"
                  >
                    <option value="Dubai">Dubai</option>
                    <option value="Abu Dhabi">Abu Dhabi</option>
                    <option value="Sharjah">Sharjah</option>
                    <option value="Ajman">Ajman</option>
                    <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                    <option value="Fujairah">Fujairah</option>
                    <option value="Umm Al Quwain">Umm Al Quwain</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
                  <input
                    type="text"
                    required
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Postal / Makani Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newPostalCode}
                    onChange={(e) => setNewPostalCode(e.target.value)}
                    placeholder="e.g. 12345"
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="createIsActive"
                  checked={newIsActive}
                  onChange={(e) => setNewIsActive(e.target.checked)}
                  className="rounded border-[#2A3241] bg-[#131722] text-[#D4FF00] focus:ring-[#D4FF00] cursor-pointer"
                />
                <label htmlFor="createIsActive" className="text-xs text-slate-300 cursor-pointer">
                  Activate branch immediately for commercial access &amp; check-ins
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2.5 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] text-xs font-bold transition-all cursor-pointer shadow-sm shadow-[#D4FF00]/15"
                >
                  {isSubmittingCreate ? 'Provisioning...' : 'Save & Provision Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 2: Edit Branch Details                                  */}
      {/* ------------------------------------------------------------- */}
      {editingBranch && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-xl bg-[#1E2430] border border-[#2A3241] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#D4FF00]" />
                <h3 className="font-bold text-sm text-white">Edit Facility Location</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBranch(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Branch Commercial Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={editStreet}
                  onChange={(e) => setEditStreet(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Emirate</label>
                  <select
                    value={editEmirate}
                    onChange={(e) => setEditEmirate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none cursor-pointer"
                  >
                    <option value="Dubai">Dubai</option>
                    <option value="Abu Dhabi">Abu Dhabi</option>
                    <option value="Sharjah">Sharjah</option>
                    <option value="Ajman">Ajman</option>
                    <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                    <option value="Fujairah">Fujairah</option>
                    <option value="Umm Al Quwain">Umm Al Quwain</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
                  <input
                    type="text"
                    required
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Postal / Makani Code
                  </label>
                  <input
                    type="text"
                    value={editPostalCode}
                    onChange={(e) => setEditPostalCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-xs text-white focus:border-[#D4FF00] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded border-[#2A3241] bg-[#131722] text-[#D4FF00] focus:ring-[#D4FF00] cursor-pointer"
                />
                <label htmlFor="editIsActive" className="text-xs text-slate-300 cursor-pointer">
                  Branch is operational and open for check-ins
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] text-xs font-bold transition-all cursor-pointer shadow-sm shadow-[#D4FF00]/15"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Update Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
