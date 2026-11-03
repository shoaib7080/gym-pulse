import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  X,
  Mail,
  RefreshCw,
  Lock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  KeyRound,
} from '../ui/icons';

export interface AssignedBranch {
  id: string;
  name: string;
}

export interface StaffMember {
  id: string;
  userId: string;
  role: 'owner' | 'staff' | 'manager' | 'front_desk';
  branchScope: 'all' | 'selected';
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  user: {
    id?: string;
    fullName: string;
    email: string;
    phone?: string | null;
    status?: string;
  };
  assignedBranches?: AssignedBranch[];
}

interface BranchItem {
  id: string;
  name: string;
  city?: string;
  isMain?: boolean;
}

export function StaffManagementView() {
  const { activeGym, userRole, apiFetch, user } = useAuth();
  const isOwner = userRole === 'owner';

  // State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [branchesList, setBranchesList] = useState<BranchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'staff'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');

  // Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'staff' | 'owner'>('staff');
  const [inviteBranchScope, setInviteBranchScope] = useState<'all' | 'selected'>('all');
  const [inviteSelectedBranches, setInviteSelectedBranches] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  // Status Toggle Modal State
  const [statusModalTarget, setStatusModalTarget] = useState<StaffMember | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Password Reset Modal State
  const [resetModalTarget, setResetModalTarget] = useState<StaffMember | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Fetch staff and branches
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes, branchesRes] = await Promise.all([
        apiFetch('/v1/gyms/staff'),
        apiFetch('/v1/branches'),
      ]);

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaffList(Array.isArray(staffData) ? staffData : []);
      }

      if (branchesRes.ok) {
        const branchesData = await branchesRes.json();
        setBranchesList(Array.isArray(branchesData) ? branchesData : []);
      }
    } catch (err: any) {
      console.warn('Failed to load staff management data:', err);
      setErrorMessage(err.message || 'Failed to load staff roster.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Invite Staff Submit
  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    if (inviteBranchScope === 'selected' && inviteSelectedBranches.length === 0) {
      setErrorMessage('Please select at least one branch for restricted branch access.');
      return;
    }

    setIsInviting(true);
    setErrorMessage(null);

    try {
      const payload = {
        email: inviteEmail.trim().toLowerCase(),
        fullName: inviteName.trim() || undefined,
        role: inviteRole,
        branchScope: inviteBranchScope,
        branchIds: inviteBranchScope === 'selected' ? inviteSelectedBranches : [],
      };

      const res = await apiFetch('/v1/gyms/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to dispatch staff invitation.');
      }

      setSuccessMessage(`Invitation dispatched to ${inviteEmail}. An activation link has been delivered.`);
      setIsInviteModalOpen(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('staff');
      setInviteBranchScope('all');
      setInviteSelectedBranches([]);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while inviting staff.');
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Status Toggle (Active / Disabled)
  const handleConfirmStatusToggle = async () => {
    if (!statusModalTarget) return;

    setIsUpdatingStatus(true);
    setErrorMessage(null);

    const newStatus = !statusModalTarget.isActive;

    try {
      const res = await apiFetch(`/v1/gyms/staff/${statusModalTarget.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update staff status.');
      }

      setSuccessMessage(
        newStatus
          ? `Staff member ${statusModalTarget.user.fullName} has been reactivated.`
          : `Staff member ${statusModalTarget.user.fullName} has been deactivated. Active sessions have been revoked.`
      );
      setStatusModalTarget(null);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update staff status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Trigger Password Reset
  const handleConfirmPasswordReset = async () => {
    if (!resetModalTarget) return;

    setIsResettingPassword(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch(`/v1/gyms/staff/${resetModalTarget.id}/reset-password`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to send password reset email.');
      }

      setSuccessMessage(`Password reset link dispatched to ${resetModalTarget.user.email}.`);
      setResetModalTarget(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch password reset link.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter((member) => {
    const nameMatch = member.user.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = member.user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const queryMatches = nameMatch || emailMatch;

    const roleMatches =
      roleFilter === 'all'
        ? true
        : roleFilter === 'owner'
        ? member.role === 'owner'
        : member.role === 'staff' || member.role === 'manager' || member.role === 'front_desk';

    const statusMatches =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? member.isActive
        : !member.isActive;

    return queryMatches && roleMatches && statusMatches;
  });

  // Calculate stats
  const totalStaffCount = staffList.length;
  const activeStaffCount = staffList.filter((s) => s.isActive).length;
  const disabledStaffCount = totalStaffCount - activeStaffCount;

  // Non-owner permission barrier
  if (!isOwner) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-[#141820] border border-[#242933] rounded-xl p-8 text-center flex flex-col items-center">
          <div className="h-14 w-14 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white font-display mb-2">
            Owner Authorization Required
          </h2>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            Staff account provisioning, role delegation, and access controls are restricted strictly to verified <strong>Gym Owners</strong>. Contact your gym administrator to manage permissions.
          </p>
          <div className="px-4 py-2 rounded-lg bg-[#1B202C] border border-[#2A3241] text-xs font-mono text-slate-300">
            Active Role: <span className="text-[#D4FF00] uppercase font-semibold">{userRole || 'Staff'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats Bento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-[#141820] border border-[#242933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#D4FF00]/10 border border-[#D4FF00]/20 flex items-center justify-center text-[#D4FF00]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white font-display">Staff &amp; Access Delegation</h1>
                <p className="text-xs text-slate-400">
                  Manage facility roles, branch scopes, and secure account credentials
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-[#242933] pt-3">
            <span>
              Facility: <strong className="text-white">{activeGym?.tradeName || 'All Branches'}</strong>
            </span>
            <span>•</span>
            <span>
              Access Model: <strong className="text-[#D4FF00]">2-Role Tenant Model</strong>
            </span>
          </div>
        </div>

        {/* Counter Card 1: Active Staff */}
        <div className="bg-[#141820] border border-[#242933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Active Staff</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">{activeStaffCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Authorized for front-desk operations</p>
          </div>
        </div>

        {/* Counter Card 2: Total Provisioned */}
        <div className="bg-[#141820] border border-[#242933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Provisioned</span>
            <span className="text-xs font-mono text-slate-500">{disabledStaffCount} disabled</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-2xl font-bold font-mono text-white">{totalStaffCount}</div>
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-[#D4FF00] hover:bg-[#bfe600] text-black font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Invite Staff</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications / Feedback Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-[#141820] border border-[#242933] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name or email..."
            className="w-full pl-9 pr-4 py-2 bg-[#1B202C] border border-[#2A3241] rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#D4FF00]/60 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-2 bg-[#1B202C] border border-[#2A3241] rounded-lg text-xs text-white focus:outline-hidden focus:border-[#D4FF00]/60 transition-colors"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owners</option>
            <option value="staff">Staff Members</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-[#1B202C] border border-[#2A3241] rounded-lg text-xs text-white focus:outline-hidden focus:border-[#D4FF00]/60 transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
          </select>

          <button
            type="button"
            onClick={fetchData}
            title="Refresh Roster"
            className="p-2 bg-[#1B202C] border border-[#2A3241] rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Staff Roster Table */}
      <div className="bg-[#141820] border border-[#242933] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#242933] bg-[#171B24] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Branch Scope</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Assigned On</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242933] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#D4FF00]" />
                      <span>Loading authorized facility staff...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No staff members match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const isCurrentLoggedUser =
                    member.userId === user?.id || member.user?.email === user?.email;
                  const isOwnerRole = member.role === 'owner';

                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-[#1B202C]/50 transition-colors ${
                        !member.isActive ? 'opacity-65' : ''
                      }`}
                    >
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-[#1F2533] border border-[#2A3241] flex items-center justify-center text-xs font-bold text-white font-mono uppercase shrink-0">
                            {member.user.fullName
                              ? member.user.fullName.substring(0, 2)
                              : member.user.email.substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{member.user.fullName || 'Staff Member'}</span>
                              {isCurrentLoggedUser && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#D4FF00]/15 text-[#D4FF00] border border-[#D4FF00]/30">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{member.user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide border ${
                            isOwnerRole
                              ? 'bg-amber-950/30 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-300 border-[#2A3241]'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{member.role.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Branch Scope */}
                      <td className="py-3.5 px-4">
                        {member.branchScope === 'all' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                            <span>All Branches (Universal)</span>
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {member.assignedBranches && member.assignedBranches.length > 0 ? (
                              member.assignedBranches.map((b) => (
                                <span
                                  key={b.id}
                                  className="px-2 py-0.5 rounded bg-[#1B202C] border border-[#2A3241] text-[10px] text-slate-300"
                                >
                                  {b.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">
                                Specific Branches ({member.branchScope})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={isCurrentLoggedUser}
                          onClick={() => setStatusModalTarget(member)}
                          title={
                            isCurrentLoggedUser
                              ? 'You cannot deactivate your own account'
                              : member.isActive
                              ? 'Click to deactivate staff member'
                              : 'Click to activate staff member'
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                            isCurrentLoggedUser ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                          } ${
                            member.isActive
                              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50'
                              : 'bg-red-950/40 text-red-300 border border-red-500/30 hover:border-red-500/50'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              member.isActive ? 'bg-emerald-400' : 'bg-red-400'
                            }`}
                          />
                          <span>{member.isActive ? 'Active' : 'Disabled'}</span>
                        </button>
                      </td>

                      {/* Assigned Date */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                        {member.createdAt
                          ? new Date(member.createdAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setResetModalTarget(member)}
                            title="Dispatch Password Reset Email"
                            className="px-2.5 py-1 rounded-md bg-[#1B202C] hover:bg-[#252C3D] border border-[#2A3241] text-slate-300 text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <KeyRound className="w-3 h-3 text-[#D4FF00]" />
                            <span>Reset Password</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Invite Staff Member */}
      {isInviteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg bg-[#141820] border border-[#242933] rounded-xl p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#242933] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#D4FF00]/10 border border-[#D4FF00]/20 flex items-center justify-center text-[#D4FF00]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm font-display">Invite Staff Member</h3>
                  <p className="text-[11px] text-slate-400">
                    Provision account credentials and configure branch authorization
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleInviteStaff} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full px-3 py-2 rounded-lg bg-[#1B202C] border border-[#2A3241] text-white placeholder:text-slate-600 focus:outline-hidden focus:border-[#D4FF00]/60"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. sarah.j@oasisfitness.ae"
                  className="w-full px-3 py-2 rounded-lg bg-[#1B202C] border border-[#2A3241] text-white placeholder:text-slate-600 focus:outline-hidden focus:border-[#D4FF00]/60"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  An activation email will be sent via Brevo with a one-time credential setup link.
                </p>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Tenant Role <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                      inviteRole === 'staff'
                        ? 'bg-[#1B202C] border-[#D4FF00]/60 text-white'
                        : 'bg-[#161A22] border-[#2A3241] text-slate-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="staff"
                      checked={inviteRole === 'staff'}
                      onChange={() => setInviteRole('staff')}
                      className="mt-0.5 text-[#D4FF00] focus:ring-0"
                    />
                    <div>
                      <div className="font-bold text-white text-xs">Staff</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Desk check-in, shifts, sales &amp; member intake. PIN step-up required for high-risk actions.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                      inviteRole === 'owner'
                        ? 'bg-[#1B202C] border-[#D4FF00]/60 text-white'
                        : 'bg-[#161A22] border-[#2A3241] text-slate-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="owner"
                      checked={inviteRole === 'owner'}
                      onChange={() => setInviteRole('owner')}
                      className="mt-0.5 text-[#D4FF00] focus:ring-0"
                    />
                    <div>
                      <div className="font-bold text-white text-xs">Gym Owner</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Full unrestricted tenant access, staff management, analytics, and billing settings.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Branch Scope */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Branch Access Scope <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 mb-2.5">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      inviteBranchScope === 'all'
                        ? 'bg-[#1B202C] border-[#D4FF00]/60 text-white'
                        : 'bg-[#161A22] border-[#2A3241] text-slate-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="branchScope"
                      value="all"
                      checked={inviteBranchScope === 'all'}
                      onChange={() => setInviteBranchScope('all')}
                      className="text-[#D4FF00] focus:ring-0"
                    />
                    <span className="font-semibold text-xs">All Branches (Universal)</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      inviteBranchScope === 'selected'
                        ? 'bg-[#1B202C] border-[#D4FF00]/60 text-white'
                        : 'bg-[#161A22] border-[#2A3241] text-slate-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="branchScope"
                      value="selected"
                      checked={inviteBranchScope === 'selected'}
                      onChange={() => setInviteBranchScope('selected')}
                      className="text-[#D4FF00] focus:ring-0"
                    />
                    <span className="font-semibold text-xs">Specific Branches</span>
                  </label>
                </div>

                {/* Branch Multi-select Checkboxes */}
                {inviteBranchScope === 'selected' && (
                  <div className="p-3 bg-[#161A22] border border-[#2A3241] rounded-lg space-y-2 mt-2">
                    <div className="text-[11px] font-semibold text-slate-300 mb-1">
                      Select Permitted Branches:
                    </div>
                    {branchesList.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">No facility branches provisioned yet.</p>
                    ) : (
                      branchesList.map((branch) => {
                        const isChecked = inviteSelectedBranches.includes(branch.id);
                        return (
                          <label
                            key={branch.id}
                            className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setInviteSelectedBranches([...inviteSelectedBranches, branch.id]);
                                } else {
                                  setInviteSelectedBranches(
                                    inviteSelectedBranches.filter((id) => id !== branch.id)
                                  );
                                }
                              }}
                              className="rounded bg-[#1B202C] border-[#2A3241] text-[#D4FF00] focus:ring-0"
                            />
                            <span>{branch.name}</span>
                            {branch.city && <span className="text-[10px] text-slate-500">({branch.city})</span>}
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242933]">
                <button
                  type="button"
                  disabled={isInviting}
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1B202C] text-slate-300 hover:text-white border border-[#2A3241] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#bfe600] text-black font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isInviting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching Invitation...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Staff Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Status Toggle Confirmation */}
      {statusModalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-[#141820] border border-[#242933] rounded-xl p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                  statusModalTarget.isActive
                    ? 'bg-red-950/40 border border-red-500/30 text-red-400'
                    : 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400'
                }`}
              >
                {statusModalTarget.isActive ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm font-display">
                  {statusModalTarget.isActive ? 'Deactivate Staff Account' : 'Reactivate Staff Account'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {statusModalTarget.user.fullName} ({statusModalTarget.user.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {statusModalTarget.isActive ? (
                <>
                  Are you sure you want to deactivate this staff account? All open sessions will be{' '}
                  <strong className="text-red-400">instantly terminated</strong> and desk check-in permissions revoked.
                </>
              ) : (
                <>
                  Are you sure you want to reactivate this staff account? The user will immediately regain access to authorized facility branches.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setStatusModalTarget(null)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1B202C] text-slate-300 hover:text-white border border-[#2A3241] text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleConfirmStatusToggle}
                className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                  statusModalTarget.isActive
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isUpdatingStatus ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>
                    {statusModalTarget.isActive ? 'Confirm Deactivation' : 'Confirm Reactivation'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reset Password Confirmation */}
      {resetModalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-[#141820] border border-[#242933] rounded-xl p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#D4FF00]/10 border border-[#D4FF00]/20 flex items-center justify-center text-[#D4FF00] shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm font-display">Reset Staff Password</h3>
                <p className="text-[11px] text-slate-400">
                  {resetModalTarget.user.fullName} ({resetModalTarget.user.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will generate a time-bounded (1 hour) cryptographic password reset link and dispatch it directly to{' '}
              <strong className="text-white">{resetModalTarget.user.email}</strong> via Brevo transactional email.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isResettingPassword}
                onClick={() => setResetModalTarget(null)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1B202C] text-slate-300 hover:text-white border border-[#2A3241] text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResettingPassword}
                onClick={handleConfirmPasswordReset}
                className="px-4 py-1.5 rounded-lg bg-[#D4FF00] hover:bg-[#bfe600] text-black font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isResettingPassword ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Reset Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
