import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Activity,
  ShieldCheck,
  Receipt,
  Search,
  Download,
  CheckCircle2,
  Clock,
  Plus,
  AlertTriangle,
  Building2,
} from '../ui/icons';

interface MemberEntity {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  memberNumber?: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  status?: string;
  createdAt?: string;
}

interface BranchEntity {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
}

export function OperationsView() {
  const { activeGym, apiFetch } = useAuth();

  const [members, setMembers] = useState<MemberEntity[]>([]);
  const [branches, setBranches] = useState<BranchEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Member Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGender, setNewGender] = useState<'male' | 'female' | 'other'>('male');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch real members and branches
  const fetchOperationsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParam = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery.trim())}` : '';
      const [memRes, brRes] = await Promise.allSettled([
        apiFetch(`/v1/members${queryParam}`),
        apiFetch('/v1/branches'),
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
        }
      }
    } catch (err) {
      console.warn('Failed to fetch operations data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, searchQuery, selectedBranchId]);

  useEffect(() => {
    fetchOperationsData();
  }, [fetchOperationsData]);

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

  return (
    <div className="flex flex-col w-full pb-12 font-sans">
      {/* Top Header */}
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low border-b border-outline-variant/30 shadow-sm">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-outline font-semibold">
            <span>Operations</span>
            <span className="text-on-surface-variant font-bold">/</span>
            <span className="text-primary font-bold">Member Registry</span>
          </div>
          <h1 className="text-xl font-bold text-on-surface font-display mt-0.5">
            Member Intake &amp; Front-Desk Operations
          </h1>
        </div>

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

      <div className="p-6 space-y-6">
        {/* Status Alerts */}
        {actionSuccess && (
          <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-2.5 text-xs text-primary animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Telemetry Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#131722] border border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total Registered Members</span>
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
              <span>Branch Facilities</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading ? '...' : branches.length || 1}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Available intake branches
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Access Control Protocol</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-base font-bold text-emerald-400 mt-1">
              Active &amp; Operational
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Real-time gate synchronization
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

        {/* Main Member Roster Table or Empty State */}
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
                    <th className="py-2.5 px-3">Gender</th>
                    <th className="py-2.5 px-3 text-right">Account Status</th>
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
                      <td className="py-3 px-3 capitalize text-outline">{m.gender || '—'}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
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

      {/* Register Member Modal Dialog */}
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
    </div>
  );
}
