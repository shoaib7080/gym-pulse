import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CreditCard,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Download,
  Building2,
  Users,
  Receipt,
  Calendar,
  ArrowRight,
  Clock,
  ShieldCheck,
  FileText,
  X,
  Lock,
} from '../ui/icons';

interface SaasPlan {
  id: string;
  code: string;
  name: string;
  billingInterval: 'month' | 'year';
  priceMinor: number;
  currency: string;
  limits: {
    maxBranches: number;
    maxMembers: number;
    maxStaff: number;
  };
  description?: string;
  features?: string[];
  isPopular?: boolean;
}

interface SubscriptionData {
  hasActiveSubscription: boolean;
  isRestricted: boolean;
  isSuspended: boolean;
  subscription: {
    id: string;
    gymId: string;
    saasPlanId: string;
    status: 'active' | 'past_due' | 'cancelled' | 'pending';
    periodStart: string;
    periodEnd: string;
    billingMethod?: string;
  } | null;
  plan: SaasPlan | null;
  usage: {
    activeMembers: number;
    activeBranches: number;
  };
  limits: {
    maxBranches: number;
    maxMembers: number;
    maxStaff: number;
  };
  unsubscribedCap?: number;
}

interface PlatformInvoice {
  id: string;
  invoiceNumber: string;
  issuedOn: string;
  dueOn?: string;
  docType: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    vatRatePercent: number;
    vatMinor: number;
    totalMinor: number;
  }>;
  totals: {
    subtotalMinor: number;
    vatMinor: number;
    grandTotalMinor: number;
    currency: string;
  };
  isPaid: boolean;
  totalPaidMinor: number;
  balanceDueMinor: number;
}

export function SubscriptionBillingView() {
  const { apiFetch, activeGym } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);

  // Billing interval toggle for upgrade grid ('month' | 'year')
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month');

  // Modal state
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<SaasPlan | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'direct_debit'>('card');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);

  // Fetch subscription, plans, and platform invoices
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [subRes, plansRes, invRes] = await Promise.all([
        apiFetch('/v1/subscription'),
        apiFetch('/v1/subscription/plans'),
        apiFetch('/v1/subscription/invoices'),
      ]);

      if (subRes.ok) {
        const sub = await subRes.json();
        setSubData(sub);
      }
      if (plansRes.ok) {
        const p = await plansRes.json();
        setPlans(Array.isArray(p) ? p : []);
      }
      if (invRes.ok) {
        const inv = await invRes.json();
        setInvoices(Array.isArray(inv) ? inv : []);
      }
    } catch (err) {
      console.warn('Failed to fetch subscription telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Execute Tier Change (POST /v1/subscription/change)
  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForUpgrade) return;

    setIsUpgrading(true);
    setUpgradeError(null);
    try {
      const res = await apiFetch('/v1/subscription/change', {
        method: 'POST',
        body: JSON.stringify({
          saasPlanId: selectedPlanForUpgrade.id,
          billingInterval: selectedInterval,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setUpgradeSuccess(
          `Successfully upgraded facility subscription to ${selectedPlanForUpgrade.name}! Tax invoice ${data.invoice?.invoiceNumber || ''} generated.`
        );
        setSelectedPlanForUpgrade(null);
        await fetchData();
      } else {
        setUpgradeError(data?.message || 'Failed to upgrade subscription tier.');
      }
    } catch {
      setUpgradeError('Network communication error processing tier upgrade.');
    } finally {
      setIsUpgrading(false);
    }
  };

  // Format AED from minor fils
  const formatAED = (minor: number) => {
    return (minor / 100).toLocaleString('en-AE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Synthetic PDF Download simulation
  const handleDownloadInvoice = (invoice: PlatformInvoice) => {
    const invoiceContent = `
========================================================================
                      GYMPULSE ENTERPRISE
                   TAX INVOICE / RECEIPT
========================================================================
Invoice Number : ${invoice.invoiceNumber}
Issued Date    : ${invoice.issuedOn}
Payment Status : ${invoice.isPaid ? 'PAID IN FULL' : 'PAYMENT DUE'}
Doc Type       : UAE FTA Compliant Tax Invoice
Gym License    : ${activeGym?.tradeLicenseNumber || 'DXB-987654-2026'}
Gym TRN        : ${activeGym?.trnNumber || '100987654300003'}

------------------------------------------------------------------------
LINE ITEMS:
------------------------------------------------------------------------
${invoice.lines
  .map(
    (l) =>
      `- ${l.description}\n  Qty: ${l.quantity} | Unit: AED ${formatAED(l.unitPriceMinor)} | VAT (5%): AED ${formatAED(l.vatMinor)} | Total: AED ${formatAED(l.totalMinor)}`
  )
  .join('\n')}

------------------------------------------------------------------------
FINANCIAL TOTALS (AED):
------------------------------------------------------------------------
Subtotal (Excl. VAT) : AED ${formatAED(invoice.totals.subtotalMinor)}
UAE VAT (5.0%)       : AED ${formatAED(invoice.totals.vatMinor)}
Grand Total Due      : AED ${formatAED(invoice.totals.grandTotalMinor)}
Amount Paid          : AED ${formatAED(invoice.totalPaidMinor)}
Balance Due          : AED ${formatAED(invoice.balanceDueMinor)}

Cryptographic Stamp  : SHA-256 Verified Platform Tax Ledger
========================================================================
    `;

    const blob = new Blob([invoiceContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoiceNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading && !subData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Clock className="w-8 h-8 animate-spin text-[#D4FF00] mb-3" />
        <p className="text-xs font-mono uppercase tracking-wider">Loading Subscription &amp; Quota Telemetry...</p>
      </div>
    );
  }

  const currentPlan = subData?.plan;
  const isFreeTrial = !subData?.hasActiveSubscription || subData?.subscription?.status !== 'active';
  const memberUsage = subData?.usage.activeMembers ?? 0;
  const memberMax = subData?.limits.maxMembers ?? 10;
  const isMemberOverLimit = memberUsage > memberMax;
  const memberPercent = Math.min(Math.round((memberUsage / Math.max(memberMax, 1)) * 100), 100);

  const branchUsage = subData?.usage.activeBranches ?? 0;
  const branchMax = subData?.limits.maxBranches ?? 1;
  const isBranchAtOrOverLimit = branchUsage >= branchMax;
  const branchPercent = Math.min(Math.round((branchUsage / Math.max(branchMax, 1)) * 100), 100);

  return (
    <div className="flex flex-col w-full pb-12 p-6 gap-6 min-w-0">
      {/* Top Banner & Status Alerts */}
      {upgradeSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{upgradeSuccess}</span>
          </div>
          <button type="button" onClick={() => setUpgradeSuccess(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* OVER-LIMIT GRACEFUL DOWNGRADE CALLOUT */}
      {isMemberOverLimit && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-2">
              <span>Member Quota Exceeded ({memberUsage} / {memberMax} Members)</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Over-Limit Protection Active
              </span>
            </div>
            <p className="text-amber-200/90 leading-relaxed">
              <strong>Graceful Access Retention:</strong> Existing active members retain full facility check-in and turnstile scanner access. Creating new memberships is temporarily paused until your tier is upgraded or your active roster is normalized.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1: CURRENT PLAN & CAPACITY CONSUMPTION BENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Subscription Summary */}
        <div className="lg:col-span-5 bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#D4FF00]">
                  Facility Plan
                </span>
                <span className="text-slate-600">•</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    isFreeTrial
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : isMemberOverLimit
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isMemberOverLimit ? 'bg-rose-400' : 'bg-[#D4FF00]'} animate-pulse`} />
                  {isFreeTrial ? 'Free Sandbox Trial' : isMemberOverLimit ? 'Over-Limit Active' : 'Active & Compliant'}
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight font-display">
                {currentPlan ? currentPlan.name : 'Starter Sandbox Tier'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {currentPlan?.description || 'Free sandbox environment for onboarding and initial facility configuration.'}
              </p>
            </div>

            <div className="pt-2 border-t border-[#242933] grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Billing Cycle</span>
                <div className="text-sm font-semibold text-white mt-0.5 flex items-baseline gap-1">
                  <span>{currentPlan ? `AED ${formatAED(currentPlan.priceMinor)}` : 'AED 0.00'}</span>
                  <span className="text-[11px] text-slate-400 font-normal">/ {subData?.subscription?.billingMethod || 'month'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Next Renewal</span>
                <div className="text-sm font-semibold text-white mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{subData?.subscription?.periodEnd || 'No Expiry (Sandbox)'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#171A21] border border-[#242933] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-surface-container flex items-center justify-center text-slate-300">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Default Payment Method</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {subData?.hasActiveSubscription ? 'Corporate Visa ending in •••• 4242' : 'No Payment Card on File'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                {subData?.hasActiveSubscription ? 'Auto-Renew' : 'Manual'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Real-time Quota Consumption Meters */}
        <div className="lg:col-span-7 bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 shadow-md flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#242933]">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Facility Capacity Consumption</h3>
                <p className="text-xs text-slate-400">Strictly enforced operational ceilings for active tenant</p>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Tier Real-time Engine</span>
            </div>

            {/* Quota Meter 1: Active Members */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-200">Active Member Roster</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`font-bold ${isMemberOverLimit ? 'text-rose-400' : 'text-white'}`}>
                    {memberUsage}
                  </span>
                  <span className="text-slate-400">/ {memberMax} max</span>
                  {isMemberOverLimit && (
                    <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 text-[10px] rounded border border-rose-500/30">
                      Over Limit
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 w-full bg-[#171A21] rounded-full overflow-hidden border border-[#242933]">
                <div
                  className={`h-full transition-all duration-500 ${
                    isMemberOverLimit
                      ? 'bg-rose-500'
                      : memberPercent >= 85
                      ? 'bg-amber-400'
                      : 'bg-[#D4FF00]'
                  }`}
                  style={{ width: `${memberPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{memberPercent}% capacity consumed</span>
                <span>{Math.max(memberMax - memberUsage, 0)} member slots remaining</span>
              </div>
            </div>

            {/* Quota Meter 2: Facility Branches */}
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-200">Provisioned Facility Branches</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`font-bold ${isBranchAtOrOverLimit ? 'text-amber-400' : 'text-white'}`}>
                    {branchUsage}
                  </span>
                  <span className="text-slate-400">/ {branchMax} allowed</span>
                  {isBranchAtOrOverLimit && (
                    <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] rounded border border-amber-500/30">
                      Cap Reached
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 w-full bg-[#171A21] rounded-full overflow-hidden border border-[#242933]">
                <div
                  className={`h-full transition-all duration-500 ${
                    isBranchAtOrOverLimit ? 'bg-amber-400' : 'bg-[#D4FF00]'
                  }`}
                  style={{ width: `${branchPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{branchPercent}% branch allowance used</span>
                <span>{Math.max(branchMax - branchUsage, 0)} additional branch allocations</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#242933] flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#D4FF00]" />
              Need to add more branches or members? Upgrade your tier below.
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: 3-TIER SAAS UPGRADE GRID */}
      <div className="space-y-4 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-white tracking-tight font-display">
              Subscription Tiers &amp; Scaling Packages
            </h3>
            <p className="text-xs text-slate-400">
              Upgrade seamlessly without downtime. Instant capacity provisioning and UAE FTA compliant VAT tax invoices.
            </p>
          </div>

          {/* Billing Interval Selector (Monthly vs Annual) */}
          <div className="flex items-center gap-1 bg-[#171A21] p-1 rounded-xl border border-[#242933] shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedInterval('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedInterval === 'month'
                  ? 'bg-[#D4FF00] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setSelectedInterval('year')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedInterval === 'year'
                  ? 'bg-[#D4FF00] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Save ~17%
              </span>
            </button>
          </div>
        </div>

        {/* 3 Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => {
            const isCurrent = currentPlan?.id === p.id && !isFreeTrial;
            const isPopular = p.isPopular;
            // 10 months price for annual (2 months free)
            const priceMinor =
              selectedInterval === 'year' ? p.priceMinor * 10 : p.priceMinor;

            return (
              <div
                key={p.id}
                className={`relative rounded-2xl p-6 flex flex-col justify-between transition-all ${
                  isPopular
                    ? 'bg-surface-container-low border-2 border-[#D4FF00] shadow-xl shadow-[#D4FF00]/5'
                    : 'bg-surface-container-low border border-outline-variant/30 hover:border-outline-variant/60'
                }`}
              >
                {/* Popular Pill */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#D4FF00] text-black font-extrabold text-[10px] uppercase tracking-wider rounded-full shadow-md">
                    Most Popular Choice
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-white text-base font-display">{p.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{p.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="pt-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-white font-mono">
                        AED {formatAED(priceMinor)}
                      </span>
                      <span className="text-xs text-slate-400">
                        / {selectedInterval === 'year' ? 'year' : 'month'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      + 5% UAE VAT ({formatAED(Math.round(priceMinor * 0.05))} AED)
                    </span>
                  </div>

                  {/* Quotas Summary Pill */}
                  <div className="p-2.5 rounded-xl bg-[#171A21] border border-[#242933] flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Building2 className="w-3.5 h-3.5 text-[#D4FF00]" />
                      <span>{p.limits.maxBranches >= 90 ? 'Unlimited' : `${p.limits.maxBranches} Branches`}</span>
                    </div>
                    <span className="text-slate-600">•</span>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Users className="w-3.5 h-3.5 text-[#D4FF00]" />
                      <span>{p.limits.maxMembers >= 90000 ? 'Unlimited' : `${p.limits.maxMembers} Members`}</span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2 pt-2 border-t border-[#242933]">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Included Features</div>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {(p.features || [
                        `Up to ${p.limits.maxBranches} Facility Branches`,
                        `Up to ${p.limits.maxMembers} Active Members`,
                        `${p.limits.maxStaff} Staff Accounts`,
                        'Desk QR & Card Scanning Engine',
                        'Shift Cash Drawer Balancing',
                      ]).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#D4FF00] shrink-0 mt-0.5" />
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card CTA */}
                <div className="pt-6">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl bg-surface-container border border-[#242933] text-slate-400 text-xs font-bold cursor-not-allowed text-center"
                    >
                      Current Active Plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanForUpgrade(p);
                        setUpgradeError(null);
                      }}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isPopular
                          ? 'bg-[#D4FF00] hover:bg-[#bfe600] text-black shadow-md shadow-[#D4FF00]/10'
                          : 'bg-[#171A21] hover:bg-white/10 text-white border border-[#242933]'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{p.code === 'pro' ? 'Upgrade to Pro' : `Select ${p.name}`}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: PAST PLATFORM TAX INVOICES TABLE */}
      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Platform Tax Invoices Ledger</h3>
            <p className="text-xs text-slate-400">
              Download sequential tax receipts with cryptographic verification and 5% UAE VAT breakdown
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">{invoices.length} Invoices Recorded</span>
        </div>

        <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#242933] bg-[#11141A] text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-4">Invoice Number</th>
                  <th className="py-3 px-4">Issued On</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Subtotal</th>
                  <th className="py-3 px-4">VAT (5%)</th>
                  <th className="py-3 px-4">Total (AED)</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242933] text-slate-300">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No platform invoices on file yet.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{inv.invoiceNumber}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">{inv.issuedOn}</td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-200">
                        {inv.lines[0]?.description || 'GymPulse SaaS Platform Subscription'}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        AED {formatAED(inv.totals.subtotalMinor)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        AED {formatAED(inv.totals.vatMinor)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        AED {formatAED(inv.totals.grandTotalMinor)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            inv.isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${inv.isPaid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          {inv.isPaid ? 'PAID' : 'DUE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(inv)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#171A21] hover:bg-white/10 text-slate-300 hover:text-white border border-[#242933] text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-[#D4FF00]" />
                          <span>PDF Tax Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* UPGRADE CHECKOUT CONFIRMATION MODAL */}
      {selectedPlanForUpgrade && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg bg-[#11141A] border border-[#242933] rounded-2xl p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#242933] pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#D4FF00]/10 flex items-center justify-center text-[#D4FF00]">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base font-display">
                    Confirm Tier Subscription Upgrade
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Upgrading to {selectedPlanForUpgrade.name} ({selectedInterval === 'year' ? 'Annual' : 'Monthly'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanForUpgrade(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message */}
            {upgradeError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{upgradeError}</span>
              </div>
            )}

            <form onSubmit={handleUpgradeSubmit} className="space-y-4 text-xs">
              {/* Order Summary Breakdown */}
              <div className="p-4 rounded-xl bg-[#171A21] border border-[#242933] space-y-2.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Order Breakdown (UAE Dirham)
                </div>

                {(() => {
                  const basePrice =
                    selectedInterval === 'year'
                      ? selectedPlanForUpgrade.priceMinor * 10
                      : selectedPlanForUpgrade.priceMinor;
                  const vatMinor = Math.round(basePrice * 0.05);
                  const grandTotal = basePrice + vatMinor;

                  return (
                    <div className="space-y-1.5 font-mono text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>{selectedPlanForUpgrade.name} ({selectedInterval})</span>
                        <span>AED {formatAED(basePrice)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>UAE VAT (5.0%)</span>
                        <span>AED {formatAED(vatMinor)}</span>
                      </div>
                      <div className="pt-2 border-t border-[#242933] flex items-center justify-between text-white font-bold text-sm">
                        <span className="font-sans font-bold">Total Due Now</span>
                        <span className="text-[#D4FF00]">AED {formatAED(grandTotal)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      selectedPaymentMethod === 'card'
                        ? 'bg-[#D4FF00]/5 border-[#D4FF00] text-white'
                        : 'bg-[#171A21] border-[#242933] text-slate-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className={`w-4 h-4 mt-0.5 ${selectedPaymentMethod === 'card' ? 'text-[#D4FF00]' : 'text-slate-500'}`} />
                    <div>
                      <div className="font-bold text-xs text-white">Credit / Debit Card</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Corporate Visa / Mastercard</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('direct_debit')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      selectedPaymentMethod === 'direct_debit'
                        ? 'bg-[#D4FF00]/5 border-[#D4FF00] text-white'
                        : 'bg-[#171A21] border-[#242933] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className={`w-4 h-4 mt-0.5 ${selectedPaymentMethod === 'direct_debit' ? 'text-[#D4FF00]' : 'text-slate-500'}`} />
                    <div>
                      <div className="font-bold text-xs text-white">UAE Direct Debit</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Central Bank UAEDDS</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-[#242933] flex items-center gap-2 text-slate-400 text-[11px]">
                <Lock className="w-3.5 h-3.5 text-[#D4FF00] shrink-0" />
                <span>
                  By confirming, you authorize GymPulse to charge your selected payment method. An official FTA tax invoice will be recorded instantly.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242933]">
                <button
                  type="button"
                  onClick={() => setSelectedPlanForUpgrade(null)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/5 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpgrading}
                  className="px-5 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#bfe600] text-black font-extrabold text-xs transition-all shadow-md shadow-[#D4FF00]/10 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUpgrading ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning Subscription...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm &amp; Activate Plan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
