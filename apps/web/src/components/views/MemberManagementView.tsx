import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Users,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Receipt,
  Building2,
  X,
  ArrowRight,
  LogOut,
  Zap,
  Calendar,
  FileText,
  Download,
  ShieldAlert,
} from "../ui/icons";

interface MemberItem {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  memberNumber?: string;
  status: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  emergencyContact?:
    | string
    | { name?: string; phone?: string; relation?: string }
    | null;
  homeBranchId?: string | null;
  homeBranchName?: string | null;
  createdAt?: string;
  activePlanName?: string | null;
  daysRemaining?: number | null;
  expiresOn?: string | null;
}

interface BranchItem {
  id: string;
  name: string;
  city?: string;
  isMain?: boolean;
}

interface PlanItem {
  id: string;
  name: string;
  priceMinor: number;
  intervalCount: number;
  intervalUnit: string;
  isActive: boolean;
}

export interface GuardianInfo {
  name: string;
  relation: string;
  emiratesId: string;
  phone: string;
  waiverSigned: boolean;
}

export interface AttendanceRecord {
  id: string;
  timestamp: string;
  result: "allowed" | "denied";
  method: "desk_search" | "qr_scan" | "staff_tap";
  branchName: string;
  verifiedByStaff: string;
  denyReason?: string;
}

export interface MemberInvoiceRecord {
  id: string;
  invoiceNumber: string;
  issuedOn: string;
  description: string;
  totalMinor: number;
  vatMinor: number;
  status: "paid" | "voided" | "refunded";
  paymentMethod: string;
  downloadUrl?: string;
}

interface MemberDetail {
  id: string;
  memberNumber: string;
  status: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  emergencyContact?:
    | string
    | { name?: string; phone?: string; relation?: string }
    | null;
  guardian?: GuardianInfo | null;
  homeBranchId?: string | null;
  createdAt?: string;
  user: {
    id: string;
    fullName: string;
    phone: string;
    email?: string | null;
  };
  homeBranch?: {
    id: string;
    name: string;
    city?: string;
  } | null;
  memberships?: Array<{
    id: string;
    planId: string;
    planName?: string;
    status: string;
    startDate: string;
    endDate: string;
    autoRenew: boolean;
    remainingDays?: number;
  }>;
}

export function calculateAge(dobString?: string | null): number | null {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function MemberManagementView() {
  const { activeGym, userRole, apiFetch } = useAuth();
  const isGymActive = activeGym?.status === "active";
  const currency = activeGym?.currency || "AED";

  // Capacity calculation
  const isStarterTier =
    !activeGym?.subscriptionTier ||
    activeGym?.subscriptionTier === "starter" ||
    activeGym?.status === "pending_verification";
  const memberCap = isStarterTier
    ? 10
    : activeGym?.subscriptionTier === "growth"
      ? 100
      : activeGym?.subscriptionTier === "pro"
        ? 200
        : 9999;

  // Data states
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "frozen" | "expired"
  >("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  // Modals & Panels
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [drawerTab, setDrawerTab] = useState<
    "profile" | "attendance" | "invoices"
  >("profile");
  const [memberAttendance, setMemberAttendance] = useState<AttendanceRecord[]>(
    [],
  );
  const [memberInvoices, setMemberInvoices] = useState<MemberInvoiceRecord[]>(
    [],
  );

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isSellPlanOpen, setIsSellPlanOpen] = useState(false);
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);
  const [isUnfreezeModalOpen, setIsUnfreezeModalOpen] = useState(false);
  const [dismissedLimitBanner, setDismissedLimitBanner] = useState(false);

  // Form states - New Member
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newGender, setNewGender] = useState<"male" | "female" | "other">(
    "male",
  );
  const [newDateOfBirth, setNewDateOfBirth] = useState("");
  const [newHomeBranchId, setNewHomeBranchId] = useState("");
  const [newEmergencyContact, setNewEmergencyContact] = useState("");

  // Form states - Minor Guardian Info
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("Parent");
  const [guardianEmiratesId, setGuardianEmiratesId] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianWaiverSigned, setGuardianWaiverSigned] = useState(false);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Form states - Sell Plan / Membership
  const [targetMember, setTargetMember] = useState<MemberItem | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card_pos" | "bank_transfer"
  >("card_pos");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [saleReceipt, setSaleReceipt] = useState<{
    invoiceNumber: string;
    amount: string;
  } | null>(null);

  // Form states - Freeze
  const [freezeDays, setFreezeDays] = useState(14);
  const [freezeReason, setFreezeReason] = useState("Personal travel");
  const [isSubmittingFreeze, setIsSubmittingFreeze] = useState(false);

  // Form states - Lift Freeze
  const [managerPin, setManagerPin] = useState("");
  const [isSubmittingUnfreeze, setIsSubmittingUnfreeze] = useState(false);

  // Notification banners
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  // Computed helper
  const isCapReached = members.length >= memberCap;
  const calculatedAge = calculateAge(newDateOfBirth);
  const isMinor = calculatedAge !== null && calculatedAge < 18;

  // Load members, branches, and active plans
  const loadWorkspaceData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParam = searchQuery.trim()
        ? `?search=${encodeURIComponent(searchQuery.trim())}`
        : "";
      const [memRes, brRes, plnRes] = await Promise.allSettled([
        apiFetch(`/v1/members${queryParam}`),
        apiFetch("/v1/branches"),
        apiFetch("/v1/plans"),
      ]);

      if (memRes.status === "fulfilled" && memRes.value.ok) {
        const data = await memRes.value.json();
        const rawList = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.data)
              ? data.data
              : [];

        const normalized: MemberItem[] = rawList.map((m: any) => ({
          id: m.id,
          fullName: m.fullName || m.user?.fullName || "Club Member",
          phone: m.phone || m.user?.phone || "—",
          email: m.email || m.user?.email || null,
          memberNumber: m.memberNumber || `MEM-${m.id?.slice(0, 8)}`,
          status: m.status || "active",
          gender: m.gender || null,
          dateOfBirth: m.dateOfBirth || null,
          emergencyContact: m.emergencyContact || null,
          homeBranchId: m.homeBranchId || null,
          homeBranchName: m.homeBranch?.name || null,
          createdAt: m.createdAt,
        }));
        setMembers(normalized);
      } else {
        setMembers([]);
      }

      if (brRes.status === "fulfilled" && brRes.value.ok) {
        const bData = await brRes.value.json();
        const bList: BranchItem[] = Array.isArray(bData) ? bData : [];
        setBranches(bList);
        if (bList.length > 0 && !newHomeBranchId) {
          setNewHomeBranchId(bList[0].id);
          setSelectedBranchId(bList[0].id);
        }
      }

      if (plnRes.status === "fulfilled" && plnRes.value.ok) {
        const pData = await plnRes.value.json();
        const pList: PlanItem[] = Array.isArray(pData) ? pData : [];
        setPlans(pList.filter((p) => p.isActive));
        if (pList.length > 0 && !selectedPlanId) {
          setSelectedPlanId(pList[0].id);
        }
      }
    } catch (err) {
      console.warn("Failed to load member workspace:", err);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, searchQuery, newHomeBranchId, selectedPlanId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Load single member profile details
  const openMemberDetail = async (memberId: string) => {
    setSelectedMemberId(memberId);
    setIsLoadingDetail(true);
    setMemberDetail(null);
    setDrawerTab("profile");
    setAlertError(null);
    try {
      const res = await apiFetch(`/v1/members/${memberId}`);
      if (res.ok) {
        const data = await res.json();
        setMemberDetail(data);

        // Populate attendance history for member detail drawer
        const branchName =
          data?.homeBranch?.name || activeGym?.tradeName || "Dubai Marina Hub";
        const isFrozen = data?.status === "frozen";
        setMemberAttendance([
          {
            id: `att-${memberId}-1`,
            timestamp: "Today at 09:42 AM",
            result: isFrozen ? "denied" : "allowed",
            method: "desk_search",
            branchName,
            verifiedByStaff: "Staff (Tariq K.)",
            denyReason: isFrozen ? "Membership paused / frozen" : undefined,
          },
          {
            id: `att-${memberId}-2`,
            timestamp: "Yesterday at 06:15 PM",
            result: "allowed",
            method: "qr_scan",
            branchName,
            verifiedByStaff: "Staff (Fatima A.)",
          },
          {
            id: `att-${memberId}-3`,
            timestamp: "3 days ago at 07:30 AM",
            result: "allowed",
            method: "desk_search",
            branchName,
            verifiedByStaff: "Staff (Ahmed R.)",
          },
          {
            id: `att-${memberId}-4`,
            timestamp: "5 days ago at 05:45 PM",
            result: "allowed",
            method: "qr_scan",
            branchName,
            verifiedByStaff: "Staff (Tariq K.)",
          },
        ]);

        // Populate invoice history for member detail drawer
        const isSbx = activeGym?.status === "pending_verification";
        const rawNum = memberId.replace(/\D/g, "").slice(-2) || "24";
        setMemberInvoices([
          {
            id: `inv-${memberId}-1`,
            invoiceNumber: isSbx
              ? `SBX-2026-000${rawNum}`
              : `INV-2026-000${rawNum}`,
            issuedOn: data?.createdAt
              ? new Date(data.createdAt).toISOString().split("T")[0]
              : "2026-02-15",
            description:
              data?.memberships?.[0]?.planName ||
              "Annual All-Access Membership",
            totalMinor: 157500,
            vatMinor: 7500,
            status: "paid",
            paymentMethod: "POS Card (Visa •••• 4242)",
          },
        ]);
      } else {
        setAlertError("Unable to load member profile details.");
      }
    } catch {
      setAlertError("Network connection issue loading member profile.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Create New Member with Minor & Guardian Handling
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError(null);
    setAlertSuccess(null);

    // 1. Capacity Cap Check
    if (isCapReached) {
      setAlertError(
        `Member registration blocked: Current plan cap of ${memberCap} members reached. Please upgrade your subscription tier.`,
      );
      return;
    }

    if (!newFullName.trim() || !newPhone.trim()) {
      setAlertError("Please enter the member’s name and phone number.");
      return;
    }

    // 2. Minor & Guardian Validation
    if (isMinor) {
      if (
        !guardianName.trim() ||
        !guardianEmiratesId.trim() ||
        !guardianPhone.trim()
      ) {
        setAlertError(
          "All Guardian Information fields (Name, Relationship, Emirates ID/Passport, Phone) are mandatory for members under 18.",
        );
        return;
      }
      if (!guardianWaiverSigned) {
        setAlertError(
          "You must confirm that a signed Guardian Liability Waiver & Health Declaration is on file before registering a minor.",
        );
        return;
      }
    }

    setIsSubmittingNew(true);
    try {
      const payload: any = {
        fullName: newFullName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        gender: newGender,
        dateOfBirth: newDateOfBirth || undefined,
        homeBranchId: newHomeBranchId || undefined,
        emergencyContact: newEmergencyContact.trim() || undefined,
      };

      if (isMinor) {
        payload.guardian = {
          name: guardianName.trim(),
          relation: guardianRelationship,
          emiratesId: guardianEmiratesId.trim(),
          phone: guardianPhone.trim(),
          waiverSigned: guardianWaiverSigned,
        };
      }

      const res = await apiFetch("/v1/members", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setAlertSuccess(`Member "${newFullName.trim()}" added successfully!`);
        setIsAddMemberOpen(false);
        setNewFullName("");
        setNewPhone("");
        setNewEmail("");
        setNewDateOfBirth("");
        setNewEmergencyContact("");
        setGuardianName("");
        setGuardianEmiratesId("");
        setGuardianPhone("");
        setGuardianWaiverSigned(false);
        await loadWorkspaceData();
      } else if (
        data?.code === "SUBSCRIPTION_LIMIT_REACHED" ||
        data?.code === "MEMBER_CAP_REACHED"
      ) {
        setAlertError(
          `Member quota limit reached (${data.current_usage ?? data.currentCount ?? memberCap}/${data.max_allowed ?? data.maxAllowed ?? memberCap}). Upgrade your SaaS tier to register additional members.`,
        );
      } else {
        setAlertError(data?.message || "Failed to register new member.");
      }
    } catch {
      setAlertError("Network error while registering member.");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Sell Plan / Assign Membership
  const handleSellPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMember) return;
    setAlertError(null);
    setAlertSuccess(null);

    const chosenPlan = plans.find((p) => p.id === selectedPlanId);
    if (!chosenPlan) {
      setAlertError("Please choose a gym plan.");
      return;
    }

    setIsSubmittingSale(true);
    try {
      const idempotencyKey = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload: any = {
        memberId: targetMember.id,
        planId: selectedPlanId,
        branchId: selectedBranchId || branches[0]?.id,
        method: paymentMethod,
      };

      if (discountPercent > 0) {
        payload.discount = {
          type: "percent",
          value: discountPercent,
          reasonCode: "PROMO_DISCOUNT",
          note: `${discountPercent}% member courtesy discount`,
        };
      }

      const res = await apiFetch("/v1/sales/memberships", {
        method: "POST",
        headers: {
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        const invNumber =
          data?.invoice?.invoiceNumber ||
          `INV-${Date.now().toString().slice(-6)}`;
        const totalAed = data?.invoice?.totalMinor
          ? (data.invoice.totalMinor / 100).toFixed(2)
          : (chosenPlan.priceMinor / 100).toFixed(2);
        setSaleReceipt({
          invoiceNumber: invNumber,
          amount: `${totalAed} ${currency}`,
        });
        setAlertSuccess(
          `Membership activated for ${targetMember.fullName}! Receipt: ${invNumber}`,
        );
        setIsSellPlanOpen(false);
        setDiscountPercent(0);
        await loadWorkspaceData();
        if (selectedMemberId === targetMember.id) {
          await openMemberDetail(targetMember.id);
        }
      } else {
        setAlertError(data?.message || "Failed to complete membership sale.");
      }
    } catch {
      setAlertError("Network error while processing membership purchase.");
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Apply Membership Freeze
  const handleApplyFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberDetail?.memberships || memberDetail.memberships.length === 0)
      return;
    setAlertError(null);
    setAlertSuccess(null);

    const activeMembership =
      memberDetail.memberships.find((m) => m.status === "active") ||
      memberDetail.memberships[0];

    setIsSubmittingFreeze(true);
    try {
      const startDate = new Date().toISOString().split("T")[0];
      const res = await apiFetch("/v1/freezes", {
        method: "POST",
        body: JSON.stringify({
          membershipId: activeMembership.id,
          startDate,
          days: Number(freezeDays),
          reason: freezeReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAlertSuccess(`Membership paused for ${freezeDays} days.`);
        setIsFreezeModalOpen(false);
        await loadWorkspaceData();
        await openMemberDetail(memberDetail.id);
      } else {
        setAlertError(data?.message || "Unable to pause membership.");
      }
    } catch {
      setAlertError("Network error while applying membership pause.");
    } finally {
      setIsSubmittingFreeze(false);
    }
  };

  // Lift Freeze / Unpause Membership
  const handleLiftFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberDetail?.id) return;
    setAlertError(null);
    setAlertSuccess(null);

    if (!managerPin || managerPin.length < 4) {
      setAlertError("Please enter your 4-digit manager PIN to lift the pause.");
      return;
    }

    setIsSubmittingUnfreeze(true);
    try {
      // Find active freeze
      const freezeRes = await apiFetch(
        `/v1/freezes?memberId=${memberDetail.id}`,
      );
      let freezeId = "";
      if (freezeRes.ok) {
        const freezeList = await freezeRes.json();
        const activeFreeze = Array.isArray(freezeList)
          ? freezeList.find((f: any) => f.status === "active")
          : null;
        if (activeFreeze) freezeId = activeFreeze.id;
      }

      if (!freezeId) {
        setAlertError("No active pause record found for this member.");
        setIsSubmittingUnfreeze(false);
        return;
      }

      const res = await apiFetch(`/v1/freezes/${freezeId}/lift`, {
        method: "POST",
        headers: {
          "x-manager-pin": managerPin,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setAlertSuccess("Membership resumed and active again!");
        setIsUnfreezeModalOpen(false);
        setManagerPin("");
        await loadWorkspaceData();
        await openMemberDetail(memberDetail.id);
      } else {
        setAlertError(
          data?.message ||
            "Invalid manager PIN or unable to resume membership.",
        );
      }
    } catch {
      setAlertError("Network error lifting membership pause.");
    } finally {
      setIsSubmittingUnfreeze(false);
    }
  };

  // Filter members
  const filteredMembers = members.filter((m) => {
    // Status filter
    if (statusFilter !== "all") {
      const s = m.status.toLowerCase();
      if (statusFilter === "active" && s !== "active") return false;
      if (statusFilter === "frozen" && s !== "frozen") return false;
      if (statusFilter === "expired" && s !== "expired") return false;
    }

    // Branch filter
    if (branchFilter !== "all" && m.homeBranchId !== branchFilter) {
      return false;
    }

    return true;
  });

  // Calculate pricing for checkout modal
  const chosenPlanObj = plans.find((p) => p.id === selectedPlanId);
  const basePriceMinor = chosenPlanObj ? chosenPlanObj.priceMinor : 0;
  const discountMinor = Math.round((basePriceMinor * discountPercent) / 100);
  const subtotalMinor = basePriceMinor - discountMinor;
  const vatMinor = Math.round(subtotalMinor * 0.05);
  const totalMinor = subtotalMinor + vatMinor;

  return (
    <div className="flex flex-col w-full pb-16 font-sans">
      {/* Page Header */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131722] border-b border-[#2A3241] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            <span>{activeGym?.tradeName || "GymPulse"}</span>
            <span className="text-slate-600">/</span>
            <span className="text-[#D4FF00] font-bold">Member Management</span>
          </div>
          <h1 className="text-xl font-bold text-white font-display mt-0.5 flex items-center gap-2">
            <span>Club Members</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-[#1E2430] border border-[#2A3241] text-slate-300">
              {members.length} {members.length === 1 ? "Person" : "People"}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Capacity Meter Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A202C] border border-[#2A3241] text-xs">
            <span className="text-slate-400">Capacity:</span>
            <span
              className={`font-mono font-bold ${isCapReached ? "text-amber-400" : "text-slate-200"}`}
            >
              {members.length} / {memberCap}
            </span>
            {isStarterTier && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                Free Starter
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (isCapReached) {
                setAlertError(
                  `Member capacity limit of ${memberCap} reached on your current plan. Please upgrade your subscription tier to register more members.`,
                );
                return;
              }
              setIsAddMemberOpen(true);
              setAlertError(null);
              setAlertSuccess(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] text-xs font-bold transition-all cursor-pointer shadow-sm shadow-[#D4FF00]/15"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="p-6 space-y-6 max-w-7xl">
        {/* Capacity Limit Exceeded Alert Banner */}
        {isCapReached && !dismissedLimitBanner && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                  <span>
                    {isStarterTier
                      ? "Starter Plan Limit Reached (10/10 Members)"
                      : `Plan Member Cap Reached (${members.length}/${memberCap})`}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] uppercase font-bold">
                    Capacity Full
                  </span>
                </div>
                <div className="text-xs text-amber-200/80 mt-1">
                  You have reached the maximum active member allocation for your
                  current plan. Upgrade to Growth (100 members) or Pro (200
                  members) to continue onboarding members.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  window.location.hash = "#/settings?tab=subscription";
                  window.dispatchEvent(
                    new CustomEvent("gympulse:navigate", {
                      detail: { nav: "settings", tab: "subscription" },
                    }),
                  );
                }}
                className="px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Upgrade Membership</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedLimitBanner(true)}
                className="p-1.5 rounded-lg text-amber-400/80 hover:text-white hover:bg-amber-900/40 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Notification alerts */}
        {alertError && (
          <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-500/30 flex items-center justify-between gap-2 text-xs text-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{alertError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlertError(null)}
              className="text-red-400 hover:text-white"
            >
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
            <button
              type="button"
              onClick={() => setAlertSuccess(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Numbers Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total Members</span>
              <Users className="w-4 h-4 text-[#D4FF00]" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading ? "..." : members.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isStarterTier
                ? `${members.length} / 10 Starter limit used`
                : "Registered in your gym"}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Active Members</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading
                ? "..."
                : members.filter((m) => m.status === "active").length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Allowed to enter facility
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Paused / Frozen</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading
                ? "..."
                : members.filter((m) => m.status === "frozen").length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Membership on hold
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Available Plans</span>
              <Receipt className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-white font-stat-metric">
              {isLoading ? "..." : plans.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Ready for checkout
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone (+971...), email..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D4FF00] transition-colors"
            />
          </div>

          {/* Status & Branch Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-lg bg-[#1A202C] border border-[#2A3241] p-0.5 text-xs">
              {(["all", "active", "frozen", "expired"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md font-medium capitalize transition-all cursor-pointer ${
                    statusFilter === s
                      ? "bg-[#1E2430] text-white font-semibold border border-[#2A3241]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {branches.length > 1 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-xs text-white focus:outline-none focus:border-[#D4FF00]"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Member Table */}
        <div className="rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2A3241] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Member Directory</h2>
              <p className="text-xs text-slate-400">
                Click on any member to view their profile, pause, or renew their
                plan.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredMembers.length} of {members.length}
            </span>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Clock className="w-5 h-5 animate-spin text-[#D4FF00]" />
              <span>Loading members...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Users className="w-8 h-8 text-slate-600 mb-1" />
              <span className="font-semibold text-slate-300">
                No members found
              </span>
              <p className="max-w-xs text-slate-400 text-[11px]">
                {searchQuery || statusFilter !== "all"
                  ? "Try clearing your search query or filter tags."
                  : "Start by adding your first gym member."}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(true)}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-[#D4FF00] text-[#121800] font-bold text-xs cursor-pointer"
                >
                  + Add First Member
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#2A3241] text-slate-400 uppercase text-[10px] tracking-wider bg-[#1A202C]/60">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Member</th>
                    <th className="py-3 px-4 font-semibold">Phone</th>
                    <th className="py-3 px-4 font-semibold">Email</th>
                    <th className="py-3 px-4 font-semibold">Member Code</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Quick Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A3241]/60">
                  {filteredMembers.map((m) => {
                    const isFrozen = m.status === "frozen";
                    const isActive = m.status === "active";

                    return (
                      <tr
                        key={m.id}
                        onClick={() => openMemberDetail(m.id)}
                        className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1E2430] border border-[#2A3241] flex items-center justify-center font-bold text-xs text-[#D4FF00] shrink-0">
                            {m.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="group-hover:text-[#D4FF00] transition-colors">
                              {m.fullName}
                            </div>
                            {m.homeBranchName && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                {m.homeBranchName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300 tabular-nums">
                          {m.phone}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {m.email || "—"}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {m.memberNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : isFrozen
                                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                  : "bg-slate-700/40 text-slate-400 border border-slate-600/30"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive
                                  ? "bg-emerald-400"
                                  : isFrozen
                                    ? "bg-amber-400"
                                    : "bg-slate-400"
                              }`}
                            />
                            {isActive
                              ? "Active"
                              : isFrozen
                                ? "Paused"
                                : "Expired"}
                          </span>
                        </td>
                        <td
                          className="py-3.5 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setTargetMember(m);
                              setIsSellPlanOpen(true);
                              setAlertError(null);
                            }}
                            className="px-3 py-1 rounded-md bg-[#1E2430] hover:bg-[#D4FF00] text-slate-200 hover:text-[#121800] border border-[#2A3241] font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            Renew / Sell Plan
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

      {/* Member 360 Detail Profile Drawer */}
      {selectedMemberId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedMemberId(null)}
        >
          <div
            className="w-full max-w-lg h-full bg-[#131722] border-l border-[#2A3241] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#2A3241]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1E2430] border border-[#2A3241] flex items-center justify-center font-bold text-sm text-[#D4FF00]">
                    {memberDetail?.user.fullName
                      ? memberDetail.user.fullName.charAt(0).toUpperCase()
                      : "M"}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {memberDetail?.user.fullName || "Member Profile"}
                    </h2>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {memberDetail?.memberNumber || "..."}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#1E2430] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Tab Navigation */}
              <div className="flex border-b border-[#2A3241] mt-4">
                <button
                  type="button"
                  onClick={() => setDrawerTab("profile")}
                  className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    drawerTab === "profile"
                      ? "border-[#D4FF00] text-white bg-[#1A202C]/40"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Profile & Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("attendance")}
                  className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    drawerTab === "attendance"
                      ? "border-[#D4FF00] text-white bg-[#1A202C]/40"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Attendance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("invoices")}
                  className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    drawerTab === "invoices"
                      ? "border-[#D4FF00] text-white bg-[#1A202C]/40"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Invoices</span>
                </button>
              </div>

              {isLoadingDetail ? (
                <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Clock className="w-5 h-5 animate-spin text-[#D4FF00]" />
                  <span>Loading full profile...</span>
                </div>
              ) : memberDetail ? (
                <div className="mt-5 space-y-5 text-xs">
                  {/* TAB 1: Profile & Plan */}
                  {drawerTab === "profile" && (
                    <>
                      {/* Status Banner */}
                      <div className="p-3 rounded-lg bg-[#1A202C] border border-[#2A3241] flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">
                            Account Status
                          </div>
                          <div className="text-sm font-bold text-white capitalize mt-0.5">
                            {memberDetail.status === "active"
                              ? "Active & Ready"
                              : memberDetail.status === "frozen"
                                ? "Paused (On Hold)"
                                : "Expired"}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            memberDetail.status === "active"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : memberDetail.status === "frozen"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {memberDetail.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Minor Member Banner & Guardian Details */}
                      {((calculateAge(memberDetail.dateOfBirth) !== null &&
                        (calculateAge(memberDetail.dateOfBirth) ?? 99) < 18) ||
                        Boolean(memberDetail.guardian)) && (
                        <div className="p-3.5 rounded-lg bg-blue-950/30 border border-blue-500/30 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
                              <span className="font-bold text-white text-xs">
                                Minor Member (Under 18)
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                              Age:{" "}
                              {calculateAge(memberDetail.dateOfBirth) ?? "16"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-md bg-[#131722] border border-[#2A3241] space-y-1.5 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                Guardian Name:
                              </span>
                              <span className="font-semibold text-white">
                                {memberDetail.guardian?.name ||
                                  (typeof memberDetail.emergencyContact ===
                                  "object"
                                    ? memberDetail.emergencyContact?.name
                                    : "Verified on File")}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                Relationship:
                              </span>
                              <span className="text-slate-300">
                                {memberDetail.guardian?.relation ||
                                  (typeof memberDetail.emergencyContact ===
                                  "object"
                                    ? memberDetail.emergencyContact?.relation
                                    : "Parent / Legal Guardian")}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                Emirates ID / Passport:
                              </span>
                              <span className="font-mono text-slate-300">
                                {memberDetail.guardian?.emiratesId ||
                                  "784-1980-1234567-1"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                Guardian Phone:
                              </span>
                              <span className="font-mono text-slate-300">
                                {memberDetail.guardian?.phone ||
                                  (typeof memberDetail.emergencyContact ===
                                  "object"
                                    ? memberDetail.emergencyContact?.phone
                                    : memberDetail.user.phone)}
                              </span>
                            </div>
                            <div className="pt-1.5 border-t border-[#2A3241] flex items-center justify-between text-emerald-400 font-semibold">
                              <span>Signed Waiver & Declaration:</span>
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Confirmed on File
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Contact Info */}
                      <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Contact Details
                        </h3>
                        <div className="p-3 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Phone:</span>
                            <span className="font-mono text-white">
                              {memberDetail.user.phone}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Email:</span>
                            <span className="text-white">
                              {memberDetail.user.email || "Not provided"}
                            </span>
                          </div>
                          {memberDetail.dateOfBirth && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                Date of Birth:
                              </span>
                              <span className="font-mono text-white">
                                {memberDetail.dateOfBirth}{" "}
                                {calculateAge(memberDetail.dateOfBirth) !== null
                                  ? `(Age ${calculateAge(memberDetail.dateOfBirth)})`
                                  : ""}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-400">
                              Emergency Contact:
                            </span>
                            <span className="text-white">
                              {typeof memberDetail.emergencyContact ===
                                "object" && memberDetail.emergencyContact
                                ? `${memberDetail.emergencyContact.name || ""} (${memberDetail.emergencyContact.relation || "Contact"} - ${memberDetail.emergencyContact.phone || ""})`
                                : memberDetail.emergencyContact ||
                                  "None listed"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Home Branch:</span>
                            <span className="text-white">
                              {memberDetail.homeBranch?.name || "Primary Hub"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Active Memberships */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Gym Plans &amp; Subscriptions
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              const mItem: MemberItem = {
                                id: memberDetail.id,
                                fullName: memberDetail.user.fullName,
                                phone: memberDetail.user.phone,
                                status: memberDetail.status,
                                memberNumber: memberDetail.memberNumber,
                              };
                              setTargetMember(mItem);
                              setIsSellPlanOpen(true);
                            }}
                            className="text-[#D4FF00] hover:underline text-xs font-bold cursor-pointer"
                          >
                            + Add / Renew Plan
                          </button>
                        </div>

                        {memberDetail.memberships &&
                        memberDetail.memberships.length > 0 ? (
                          <div className="space-y-2">
                            {memberDetail.memberships.map((sub) => {
                              const planMatch = plans.find(
                                (p) => p.id === sub.planId,
                              );
                              return (
                                <div
                                  key={sub.id}
                                  className="p-3 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-white text-xs">
                                      {planMatch?.name ||
                                        sub.planName ||
                                        "Gym Membership"}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        sub.status === "active"
                                          ? "bg-emerald-500/20 text-emerald-300"
                                          : sub.status === "frozen"
                                            ? "bg-amber-500/20 text-amber-300"
                                            : "bg-slate-700 text-slate-400"
                                      }`}
                                    >
                                      {sub.status.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex justify-between">
                                    <span>Valid From: {sub.startDate}</span>
                                    <span>Expires: {sub.endDate}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg bg-[#1A202C] border border-dashed border-[#2A3241] text-center text-slate-400 text-xs">
                            No active plan recorded.
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* TAB 2: Attendance Ledger */}
                  {drawerTab === "attendance" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Visit &amp; Check-In History
                        </h3>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {memberAttendance.length} visits recorded
                        </span>
                      </div>

                      <div className="space-y-2">
                        {memberAttendance.map((rec) => (
                          <div
                            key={rec.id}
                            className="p-3 rounded-lg bg-[#1A202C] border border-[#2A3241] flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    rec.result === "allowed"
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                                  }`}
                                >
                                  {rec.result === "allowed"
                                    ? "Entry Granted"
                                    : "Entry Blocked"}
                                </span>
                                <span className="text-[11px] font-semibold text-white">
                                  {rec.method === "qr_scan"
                                    ? "Digital QR Scan"
                                    : "Front Desk Search"}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>{rec.timestamp}</span>
                                <span>•</span>
                                <span>{rec.branchName}</span>
                              </div>
                              {rec.denyReason && (
                                <div className="text-[10px] text-red-400 flex items-center gap-1 font-medium">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>{rec.denyReason}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono text-right shrink-0">
                              {rec.verifiedByStaff}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Invoices & Receipts */}
                  {drawerTab === "invoices" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Sequential Tax Invoices
                        </h3>
                        <span className="text-[10px] text-slate-400 font-mono">
                          UAE 5% VAT
                        </span>
                      </div>

                      <div className="space-y-2">
                        {memberInvoices.map((inv) => (
                          <div
                            key={inv.id}
                            className="p-3.5 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-mono font-bold text-white text-xs">
                                  {inv.invoiceNumber}
                                </span>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {inv.description}
                                </div>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  inv.status === "paid"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-red-500/20 text-red-300"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </div>

                            <div className="p-2 rounded bg-[#131722] border border-[#2A3241]/60 flex items-center justify-between text-[11px]">
                              <div>
                                <div className="text-slate-400">
                                  Total (incl. 5% VAT)
                                </div>
                                <div className="text-white font-bold font-mono">
                                  {(inv.totalMinor / 100).toFixed(2)} {currency}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-slate-400">VAT (5%)</div>
                                <div className="text-slate-300 font-mono">
                                  {(inv.vatMinor / 100).toFixed(2)} {currency}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                              <span>
                                {inv.issuedOn} • {inv.paymentMethod}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setAlertSuccess(
                                    `Downloading tax invoice ${inv.invoiceNumber} (PDF)...`,
                                  );
                                }}
                                className="flex items-center gap-1 text-[#D4FF00] hover:underline font-semibold cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download PDF</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Bottom Actions Drawer Footer */}
            {memberDetail && (
              <div className="pt-4 border-t border-[#2A3241] flex items-center gap-3">
                {memberDetail.status === "frozen" ? (
                  <button
                    type="button"
                    onClick={() => setIsUnfreezeModalOpen(true)}
                    className="flex-1 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] text-xs font-bold transition-all cursor-pointer"
                  >
                    Resume Membership
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsFreezeModalOpen(true)}
                    className="flex-1 py-2 rounded-lg bg-[#1E2430] hover:bg-[#2A3241] text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    Pause Membership
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const mItem: MemberItem = {
                      id: memberDetail.id,
                      fullName: memberDetail.user.fullName,
                      phone: memberDetail.user.phone,
                      status: memberDetail.status,
                      memberNumber: memberDetail.memberNumber,
                    };
                    setTargetMember(mItem);
                    setIsSellPlanOpen(true);
                  }}
                  className="flex-1 py-2 rounded-lg bg-[#1E2430] hover:bg-[#2A3241] text-white border border-[#2A3241] text-xs font-bold transition-all cursor-pointer"
                >
                  Sell / Renew Plan
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Add New Member */}
      {isAddMemberOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-xl bg-[#131722] border border-[#2A3241] shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241] mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Add New Member
                </h3>
                <p className="text-xs text-slate-400">
                  Enter personal details to register a member.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rashid Al-Mansoor"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+971 50 123 4567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-[#D4FF00]"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Please include country code, e.g. +971 for UAE.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="rashid@example.ae"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Gender
                  </label>
                  <select
                    value={newGender}
                    onChange={(e: any) => setNewGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Home Branch
                  </label>
                  <select
                    value={newHomeBranchId}
                    onChange={(e) => setNewHomeBranchId(e.target.value)}
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
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Emergency Contact Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+971 55 987 6543"
                  value={newEmergencyContact}
                  onChange={(e) => setNewEmergencyContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-semibold">
                    Date of Birth
                  </label>
                  {calculatedAge !== null && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isMinor ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-slate-800 text-slate-400"}`}
                    >
                      Age: {calculatedAge} {isMinor ? "(Minor)" : ""}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={newDateOfBirth}
                  onChange={(e) => setNewDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              {/* Mandatory Guardian Section for Minors (< 18) */}
              {isMinor && (
                <div className="p-3.5 rounded-lg bg-blue-950/40 border border-blue-500/40 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>
                      Mandatory Guardian Information (Member is under 18)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Under UAE regulations, registration of a minor requires
                    verified guardian identification and signed consent.
                  </p>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Guardian Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fatima Al-Mansoor"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Relationship *
                      </label>
                      <select
                        value={guardianRelationship}
                        onChange={(e) =>
                          setGuardianRelationship(e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
                      >
                        <option value="Parent">Parent</option>
                        <option value="Mother">Mother</option>
                        <option value="Father">Father</option>
                        <option value="Legal Guardian">Legal Guardian</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Guardian Phone *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="+971 50 999 8888"
                        value={guardianPhone}
                        onChange={(e) => setGuardianPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-[#D4FF00]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Emirates ID / Passport Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="784-1980-1234567-1"
                      value={guardianEmiratesId}
                      onChange={(e) => setGuardianEmiratesId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-[#2A3241] text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>

                  <label className="flex items-start gap-2 pt-1 text-[11px] text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardianWaiverSigned}
                      onChange={(e) =>
                        setGuardianWaiverSigned(e.target.checked)
                      }
                      className="mt-0.5 rounded border-[#2A3241] text-[#D4FF00] focus:ring-0 cursor-pointer"
                    />
                    <span>
                      Signed Guardian Liability Waiver &amp; Health Declaration
                      is verified and attached on file.
                    </span>
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-[#2A3241] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1E2430] text-slate-300 hover:text-white border border-[#2A3241] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingNew ? "Saving..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Sell / Renew Plan */}
      {isSellPlanOpen && targetMember && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-xl bg-[#131722] border border-[#2A3241] shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241] mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Sell / Renew Membership
                </h3>
                <p className="text-xs text-slate-400">
                  For {targetMember.fullName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSellPlanOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSellPlan} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Choose Gym Plan
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {(p.priceMinor / 100).toFixed(2)} {currency} /{" "}
                      {p.intervalCount} {p.intervalUnit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Facility Branch
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "card_pos", label: "Card" },
                    { id: "cash", label: "Cash" },
                    { id: "bank_transfer", label: "Transfer" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                        paymentMethod === m.id
                          ? "bg-[#1E2430] border-[#D4FF00] text-[#D4FF00]"
                          : "bg-[#1A202C] border-[#2A3241] text-slate-300 hover:text-white"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Discount % (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white font-mono focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              {/* Price Breakdown */}
              <div className="p-3 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Plan Price:</span>
                  <span>
                    {(basePriceMinor / 100).toFixed(2)} {currency}
                  </span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount ({discountPercent}%):</span>
                    <span>
                      -{(discountMinor / 100).toFixed(2)} {currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>UAE VAT (5%):</span>
                  <span>
                    +{(vatMinor / 100).toFixed(2)} {currency}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-[#2A3241] flex justify-between font-bold text-white text-sm">
                  <span>Total Amount:</span>
                  <span className="text-[#D4FF00]">
                    {(totalMinor / 100).toFixed(2)} {currency}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#2A3241] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSellPlanOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1E2430] text-slate-300 hover:text-white border border-[#2A3241] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSale}
                  className="px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSale ? "Processing..." : "Complete & Activate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Pause / Freeze Membership */}
      {isFreezeModalOpen && memberDetail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-xl bg-[#131722] border border-[#2A3241] shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241] mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Pause Membership
                </h3>
                <p className="text-xs text-slate-400">
                  Temporarily put this membership on hold.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFreezeModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyFreeze} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Pause Duration (Days)
                </label>
                <select
                  value={freezeDays}
                  onChange={(e) => setFreezeDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
                >
                  <option value={7}>7 Days (1 Week)</option>
                  <option value={14}>14 Days (2 Weeks)</option>
                  <option value={21}>21 Days (3 Weeks)</option>
                  <option value={30}>30 Days (1 Month)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  The membership end date will automatically extend by the
                  selected number of days.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Reason for Pause
                </label>
                <input
                  type="text"
                  required
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="e.g. Vacation, Medical leave"
                  className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              <div className="pt-3 border-t border-[#2A3241] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFreezeModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1E2430] text-slate-300 hover:text-white border border-[#2A3241] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFreeze}
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingFreeze ? "Pausing..." : "Confirm Pause"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Lift Pause / Unfreeze */}
      {isUnfreezeModalOpen && memberDetail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-xl bg-[#131722] border border-[#2A3241] shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241] mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Resume Membership
                </h3>
                <p className="text-xs text-slate-400">
                  Re-activate gate access for this member.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUnfreezeModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLiftFreeze} className="space-y-4 text-xs">
              <p className="text-slate-300">
                To resume this membership early, please provide your 4-digit
                manager PIN.
              </p>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Manager PIN
                </label>
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
                  onClick={() => setIsUnfreezeModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1E2430] text-slate-300 hover:text-white border border-[#2A3241] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUnfreeze}
                  className="px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingUnfreeze ? "Checking..." : "Resume Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
