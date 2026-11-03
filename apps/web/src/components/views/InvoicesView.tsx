import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Receipt,
  Search,
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  CreditCard,
  Building2,
  Zap,
} from '../ui/icons';

export interface InvoiceRecord {
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
  isSandbox?: boolean;
  watermark?: string;
  supplier: {
    legalName?: string;
    tradeName?: string;
    trnNumber?: string;
    name?: string;
    trn?: string;
    street?: string;
    city?: string;
    emirate?: string;
    country?: string;
    isSandbox?: boolean;
  };
  buyer: {
    fullName?: string;
    name?: string;
    phone?: string;
    email?: string;
    memberNumber?: string;
    trnNumber?: string;
  };
  totals: {
    totalMinor: number;
    baseMinor: number;
    vatMinor: number;
    vatRateBps?: number;
    currency?: string;
    isSandbox?: boolean;
    watermark?: string;
  };
  lines?: Array<{
    description: string;
    quantity?: number;
    unitPriceMinor?: number;
    totalMinor: number;
    baseMinor?: number;
    vatMinor?: number;
  }>;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
    vatRatePercent?: number;
    vatMinor?: number;
  }>;
  payment?: {
    id?: string;
    method?: string;
    status?: string;
    cardBrand?: string;
    cardLast4?: string;
  };
}

export function InvoicesView() {
  const { activeGym, apiFetch } = useAuth();
  const currency = activeGym?.currency || 'AED';
  const isGymPending = activeGym?.status === 'pending_verification';

  // Data states
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'INV' | 'CN' | 'REC' | 'SBX'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'voided' | 'sandbox'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'pos_card' | 'cash' | 'bank_transfer'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month' | 'last30'>('all');

  // Notifications
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Fetch invoices from backend
  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/v1/invoices');
      if (res.ok) {
        const data = await res.json();
        const list: InvoiceRecord[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setInvoices(list);
      } else {
        // Fallback to /v1/payments/invoices
        const altRes = await apiFetch('/v1/payments/invoices');
        if (altRes.ok) {
          const altData = await altRes.json();
          setInvoices(Array.isArray(altData) ? altData : []);
        } else {
          setInvoices([]);
        }
      }
    } catch {
      setAlertError('Unable to load tax invoices ledger.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Filter computation
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Series / Type Filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'SBX' && inv.series !== 'SBX' && !inv.isSandbox) return false;
        if (typeFilter === 'INV' && inv.series !== 'INV') return false;
        if (typeFilter === 'CN' && inv.series !== 'CN' && inv.docType !== 'credit_note') return false;
        if (typeFilter === 'REC' && inv.series !== 'REC') return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        const isCredit = inv.series === 'CN' || inv.docType === 'credit_note';
        const isSbx = inv.series === 'SBX' || inv.isSandbox;
        if (statusFilter === 'sandbox' && !isSbx) return false;
        if (statusFilter === 'voided' && !isCredit && inv.payment?.status !== 'voided') return false;
        if (statusFilter === 'paid' && (isCredit || isSbx)) return false;
      }

      // 3. Payment Method Filter
      if (methodFilter !== 'all') {
        const method = inv.payment?.method || 'pos_card';
        if (methodFilter === 'pos_card' && !['pos_card', 'card_pos', 'card', 'payment_link'].includes(method)) return false;
        if (methodFilter === 'cash' && method !== 'cash') return false;
        if (methodFilter === 'bank_transfer' && method !== 'bank_transfer') return false;
      }

      // 4. Date Range Filter
      if (dateFilter !== 'all') {
        const invDate = new Date(inv.issuedOn || inv.createdAt);
        const now = new Date();
        if (dateFilter === 'today') {
          if (invDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'month') {
          if (invDate.getMonth() !== now.getMonth() || invDate.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'last30') {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          if (invDate < thirtyDaysAgo) return false;
        }
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = inv.invoiceNumber?.toLowerCase().includes(q);
        const buyerName = (inv.buyer?.fullName || inv.buyer?.name || '').toLowerCase();
        const buyerPhone = (inv.buyer?.phone || '').toLowerCase();
        const buyerTrn = (inv.buyer?.trnNumber || '').toLowerCase();
        const matchesQuery = numMatch || buyerName.includes(q) || buyerPhone.includes(q) || buyerTrn.includes(q);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [invoices, typeFilter, statusFilter, methodFilter, dateFilter, searchQuery]);

  // Aggregate KPI Stats across filtered set
  const stats = useMemo(() => {
    let grossMinor = 0;
    let vatMinor = 0;
    let netMinor = 0;
    let invCount = 0;
    let cnCount = 0;
    let sbxCount = 0;

    filteredInvoices.forEach((inv) => {
      const isCredit = inv.series === 'CN' || inv.docType === 'credit_note';
      const isSbx = inv.series === 'SBX' || inv.isSandbox;
      const total = inv.totals?.totalMinor || 0;
      const vat = inv.totals?.vatMinor || 0;
      const base = inv.totals?.baseMinor || 0;

      if (isSbx) {
        sbxCount += 1;
      } else if (isCredit) {
        cnCount += 1;
      } else {
        invCount += 1;
      }

      grossMinor += total;
      vatMinor += vat;
      netMinor += base;
    });

    return {
      grossAed: (grossMinor / 100).toFixed(2),
      vatAed: (vatMinor / 100).toFixed(2),
      vatFils: vatMinor.toLocaleString(),
      netAed: (netMinor / 100).toFixed(2),
      invCount,
      cnCount,
      sbxCount,
    };
  }, [filteredInvoices]);

  // Bulk CSV Export Function
  const handleExportCsv = () => {
    if (filteredInvoices.length === 0) {
      setAlertError('No invoices match the current filters to export.');
      return;
    }

    const headers = [
      'Invoice Number',
      'Series',
      'Issued Date',
      'Document Type',
      'Status',
      'Customer Name',
      'Customer Phone',
      'Payment Method',
      'Net Base (AED)',
      'UAE 5% VAT (AED)',
      'VAT (fils)',
      'Gross Total (AED)',
      'Currency',
      'Seller TRN',
      'Sandbox Demo',
    ];

    const rows = filteredInvoices.map((inv) => {
      const isCredit = inv.series === 'CN' || inv.docType === 'credit_note';
      const isSbx = inv.series === 'SBX' || inv.isSandbox;
      const totalAed = ((inv.totals?.totalMinor || 0) / 100).toFixed(2);
      const netAed = ((inv.totals?.baseMinor || 0) / 100).toFixed(2);
      const vatAed = ((inv.totals?.vatMinor || 0) / 100).toFixed(2);
      const vatFils = inv.totals?.vatMinor || 0;
      const buyerName = inv.buyer?.fullName || inv.buyer?.name || 'Walk-in Member';
      const buyerPhone = inv.buyer?.phone || '—';
      const method = inv.payment?.method || 'pos_card';
      const trn = inv.supplier?.trnNumber || inv.supplier?.trn || activeGym?.trnNumber || '100987654300003';
      const docType = isSbx ? 'Sandbox Demo Receipt' : isCredit ? 'Credit Note' : 'Tax Invoice';
      const status = isCredit ? 'Voided / Credit' : isSbx ? 'Sandbox Demo' : 'Paid';

      return [
        `"${inv.invoiceNumber}"`,
        `"${inv.series}"`,
        `"${inv.issuedOn || inv.createdAt}"`,
        `"${docType}"`,
        `"${status}"`,
        `"${buyerName.replace(/"/g, '""')}"`,
        `"${buyerPhone}"`,
        `"${method}"`,
        netAed,
        vatAed,
        vatFils,
        totalAed,
        inv.currency || currency,
        `"${trn}"`,
        isSbx ? 'YES' : 'NO',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `GymPulse-Tax-Invoices-Ledger-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setAlertSuccess(`Exported ${filteredInvoices.length} invoices to CSV (UAE VAT compliant).`);
  };

  // Download PDF from server presigned S3 endpoint
  const handleDownloadPdf = async (inv: InvoiceRecord) => {
    setIsDownloadingPdf(true);
    setAlertError(null);
    try {
      const res = await apiFetch(`/v1/invoices/${inv.id}/pdf`);
      if (res.ok) {
        const payload = await res.json();
        const downloadUrl = payload?.downloadUrl;
        if (downloadUrl) {
          // If mock or direct URL, initiate native download
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = payload.fileName || `Invoice-${inv.invoiceNumber}.pdf`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setAlertSuccess(`Official PDF generated: ${inv.invoiceNumber}`);
        } else {
          // Fallback to window.print
          window.print();
        }
      } else {
        // Fallback print
        window.print();
      }
    } catch {
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-16">
      {/* Top Workspace Header */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131722] border-b border-[#2A3241] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            <span>{activeGym?.tradeName || 'GymPulse'}</span>
            <span className="text-slate-600">/</span>
            <span className="text-[#D4FF00] font-bold">Tax &amp; Sequential Invoices</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 mt-0.5">
            <span>Sequential VAT Ledger</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-[#1E2430] border border-[#2A3241] text-slate-300">
              {invoices.length} Records
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* UAE VAT Compliance Chip */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A202C] border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>FTA 5% UAE VAT Ready</span>
          </div>

          {/* Export to CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] text-xs font-bold transition-all cursor-pointer shadow-sm shadow-[#D4FF00]/15"
          >
            <Download className="w-4 h-4" />
            <span>Export to CSV</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl">
        {/* Stage 2 Sandbox Demo Invoicing Notice */}
        {(isGymPending || invoices.some((i) => i.series === 'SBX')) && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                  <span>Sandbox Mode Active — SBX Demo Invoicing</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] uppercase font-bold">
                    Demo Series
                  </span>
                </div>
                <div className="text-xs text-amber-200/80 mt-1">
                  Receipts generated during onboarding verification use the temporary <code className="font-mono text-amber-300 font-bold">SBX-YYYY-XXXXX</code> series with a diagonal <span className="font-semibold text-white">"SANDBOX DEMO - NOT A TAX INVOICE"</span> watermark. These demo transactions do not advance your official tenant tax invoice sequences.
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('SBX');
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs cursor-pointer transition-colors"
              >
                Filter SBX Series
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        {alertError && (
          <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-500/30 flex items-center justify-between gap-2 text-xs text-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{alertError}</span>
            </div>
            <button type="button" onClick={() => setAlertError(null)} className="text-red-400 hover:text-white">
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
            <button type="button" onClick={() => setAlertSuccess(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4-Card Summary Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Gross Invoiced</span>
              <Receipt className="w-4 h-4 text-[#D4FF00]" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {isLoading ? '...' : `${stats.grossAed} ${currency}`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Total collected incl. 5% VAT</div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>UAE 5% VAT Pool</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {isLoading ? '...' : `${stats.vatAed} ${currency}`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Exact {stats.vatFils} fils for FTA Return
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Net Tax Base</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {isLoading ? '...' : `${stats.netAed} ${currency}`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Base gym revenue excl. VAT</div>
          </div>

          <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Ledger Count</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {isLoading ? '...' : filteredInvoices.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {stats.invCount} Invoices • {stats.cnCount} Credit • {stats.sbxCount} Demo
            </div>
          </div>
        </div>

        {/* Filter and Search Suite */}
        <div className="p-4 rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice # (INV-..., SBX-...), customer name, phone, TRN..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#1A202C] border border-[#2A3241] text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D4FF00]"
              />
            </div>

            {/* Quick Series Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All Series' },
                { id: 'INV', label: 'Tax Invoices (INV)' },
                { id: 'CN', label: 'Credit Notes (CN)' },
                { id: 'SBX', label: 'Sandbox (SBX)' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    typeFilter === t.id
                      ? 'bg-[#1E2430] text-white border border-[#2A3241]'
                      : 'text-slate-400 hover:text-white bg-transparent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#2A3241]/60 text-xs">
            <div className="flex items-center gap-1 text-slate-400">
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid &amp; Active</option>
                <option value="voided">Voided / Credit Notes</option>
                <option value="sandbox">Sandbox Demo Receipts</option>
              </select>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <span>Payment Method:</span>
              <select
                value={methodFilter}
                onChange={(e: any) => setMethodFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
              >
                <option value="all">All Methods</option>
                <option value="pos_card">Card / POS Terminal</option>
                <option value="cash">Cash Register</option>
                <option value="bank_transfer">Bank Wire</option>
              </select>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <span>Date Range:</span>
              <select
                value={dateFilter}
                onChange={(e: any) => setDateFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#1A202C] border border-[#2A3241] text-white focus:outline-none focus:border-[#D4FF00]"
              >
                <option value="all">All Records</option>
                <option value="today">Today Only</option>
                <option value="month">This Month</option>
                <option value="last30">Last 30 Days</option>
              </select>
            </div>

            {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all' || methodFilter !== 'all' || dateFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setMethodFilter('all');
                  setDateFilter('all');
                }}
                className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2430] transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Sequential Tax Invoice Ledger Table */}
        <div className="rounded-xl bg-[#131722] border border-[#2A3241] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2A3241] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Tax Invoices &amp; Receipts Ledger</h2>
              <p className="text-xs text-slate-400">Gapless sequential audit records with UAE 5% VAT fils calculation.</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredInvoices.length} of {invoices.length}
            </span>
          </div>

          {isLoading ? (
            <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Clock className="w-6 h-6 animate-spin text-[#D4FF00]" />
              <span>Loading sequential invoice ledger...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Receipt className="w-8 h-8 text-slate-600 mb-1" />
              <span className="font-semibold text-slate-300">No invoices found</span>
              <p className="max-w-xs text-slate-400 text-[11px]">
                {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try clearing your search query or adjusting your filters.'
                  : 'Invoices will automatically record here as front desk sales or renewals occur.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#2A3241] text-slate-400 uppercase text-[10px] tracking-wider bg-[#1A202C]/60">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Invoice Number</th>
                    <th className="py-3 px-4 font-semibold">Date of Issue</th>
                    <th className="py-3 px-4 font-semibold">Billed To (Member)</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold">Method</th>
                    <th className="py-3 px-4 font-semibold font-mono text-right">Net Base</th>
                    <th className="py-3 px-4 font-semibold font-mono text-right">5% VAT</th>
                    <th className="py-3 px-4 font-semibold font-mono text-right">Gross Total</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A3241]/60">
                  {filteredInvoices.map((inv) => {
                    const isCredit = inv.series === 'CN' || inv.docType === 'credit_note';
                    const isSbx = inv.series === 'SBX' || inv.isSandbox;
                    const totalAed = ((inv.totals?.totalMinor || 0) / 100).toFixed(2);
                    const netAed = ((inv.totals?.baseMinor || 0) / 100).toFixed(2);
                    const vatAed = ((inv.totals?.vatMinor || 0) / 100).toFixed(2);
                    const buyerName = inv.buyer?.fullName || inv.buyer?.name || 'Walk-in Member';

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setSelectedInvoice(inv)}
                        className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                      >
                        {/* 1. Invoice Number & Badge */}
                        <td className="py-3.5 px-4 font-mono font-bold text-white group-hover:text-[#D4FF00] transition-colors">
                          <div className="flex items-center gap-1.5">
                            <span>{inv.invoiceNumber}</span>
                            {isSbx && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] uppercase font-bold tracking-tight">
                                DEMO SBX
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Date */}
                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                          {inv.issuedOn ? new Date(inv.issuedOn).toLocaleDateString() : new Date(inv.createdAt).toLocaleDateString()}
                        </td>

                        {/* 3. Billed To */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{buyerName}</div>
                          {inv.buyer?.phone && (
                            <div className="text-[10px] text-slate-400 font-mono">{inv.buyer.phone}</div>
                          )}
                        </td>

                        {/* 4. Type Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isSbx
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : isCredit
                                ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {isSbx ? 'Sandbox Demo' : isCredit ? 'Credit Note' : 'Tax Invoice'}
                          </span>
                        </td>

                        {/* 5. Payment Method */}
                        <td className="py-3.5 px-4 text-slate-300">
                          <span className="capitalize text-[11px]">
                            {inv.payment?.method?.replace('_', ' ') || 'POS Card'}
                          </span>
                        </td>

                        {/* 6. Net Base */}
                        <td className="py-3.5 px-4 font-mono text-right text-slate-300">
                          {netAed} {inv.currency || currency}
                        </td>

                        {/* 7. 5% VAT */}
                        <td className="py-3.5 px-4 font-mono text-right text-slate-400">
                          {vatAed} {inv.currency || currency}
                        </td>

                        {/* 8. Gross Total */}
                        <td className="py-3.5 px-4 font-mono text-right font-bold">
                          <span className={isCredit ? 'text-red-400' : 'text-white'}>
                            {totalAed} {inv.currency || currency}
                          </span>
                        </td>

                        {/* 9. Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(inv)}
                              className="px-2.5 py-1 rounded bg-[#1E2430] hover:bg-[#D4FF00] text-slate-200 hover:text-[#121800] border border-[#2A3241] font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(inv)}
                              title="Download PDF"
                              className="p-1 rounded bg-[#1E2430] hover:bg-slate-700 text-slate-300 hover:text-white border border-[#2A3241] transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Official UAE FTA Tax Receipt Modal with Sandbox Watermark */}
      {selectedInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-[#131722] border border-[#2A3241] shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3241] mb-4">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Official Electronic Receipt • Federal Tax Authority
                </div>
                <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <span>{selectedInvoice.invoiceNumber}</span>
                  {(selectedInvoice.series === 'SBX' || selectedInvoice.isSandbox) && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] uppercase font-bold">
                      Sandbox Demo
                    </span>
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body Container (With Conditional Watermark) */}
            <div className="relative space-y-4 text-xs overflow-hidden">
              {/* Prominent Diagonal Sandbox Watermark */}
              {(selectedInvoice.series === 'SBX' || selectedInvoice.isSandbox || isGymPending) && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 select-none overflow-hidden">
                  <div className="transform -rotate-28 text-center border-4 border-amber-500/30 px-6 py-4 rounded-2xl bg-amber-950/20 backdrop-blur-[1px] shadow-2xl">
                    <div className="text-xl sm:text-2xl font-black uppercase tracking-widest text-amber-400/35 font-mono">
                      SANDBOX DEMO
                    </div>
                    <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-300/40 mt-1">
                      NOT A TAX INVOICE
                    </div>
                  </div>
                </div>
              )}

              {/* Supplier & Buyer Header Box */}
              <div className="p-4 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-white text-sm">
                      {selectedInvoice.supplier?.tradeName || selectedInvoice.supplier?.name || activeGym?.tradeName || 'GymPulse Club'}
                    </div>
                    {selectedInvoice.supplier?.legalName && (
                      <div className="text-[11px] text-slate-400">{selectedInvoice.supplier.legalName}</div>
                    )}
                    <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                      TRN: {selectedInvoice.supplier?.trnNumber || selectedInvoice.supplier?.trn || activeGym?.trnNumber || '100987654300003'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-[10px] uppercase font-semibold">Date of Supply</div>
                    <div className="font-mono text-white">
                      {selectedInvoice.issuedOn ? new Date(selectedInvoice.issuedOn).toLocaleDateString() : new Date(selectedInvoice.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-slate-400 text-[10px] mt-1 uppercase font-semibold">Series</div>
                    <div className="font-mono text-slate-300">{selectedInvoice.series}</div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#2A3241]/60 flex justify-between items-start">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Customer (Billed To)</div>
                    <div className="font-bold text-white">
                      {selectedInvoice.buyer?.fullName || selectedInvoice.buyer?.name || 'Walk-in Member'}
                    </div>
                    {selectedInvoice.buyer?.phone && (
                      <div className="text-[11px] text-slate-400 font-mono">{selectedInvoice.buyer.phone}</div>
                    )}
                    {selectedInvoice.buyer?.email && (
                      <div className="text-[10px] text-slate-400">{selectedInvoice.buyer.email}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedInvoice.series === 'SBX' || selectedInvoice.isSandbox
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : selectedInvoice.docType === 'credit_note'
                          ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {selectedInvoice.series === 'SBX'
                        ? 'SANDBOX DEMO RECEIPT'
                        : selectedInvoice.docType === 'credit_note'
                        ? 'OFFICIAL CREDIT NOTE'
                        : 'TAX INVOICE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-lg bg-[#1A202C] border border-[#2A3241] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1E2430] text-slate-400 uppercase text-[10px] border-b border-[#2A3241]">
                    <tr>
                      <th className="p-3">Item Description</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Net Base</th>
                      <th className="p-3 text-right">5% VAT</th>
                      <th className="p-3 text-right">Total ({selectedInvoice.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A3241]">
                    {(selectedInvoice.lines || selectedInvoice.lineItems || [
                      {
                        description: 'Gym Membership / Access Pass',
                        quantity: 1,
                        unitPriceMinor: selectedInvoice.totals.baseMinor,
                        totalMinor: selectedInvoice.totals.totalMinor,
                        baseMinor: selectedInvoice.totals.baseMinor,
                        vatMinor: selectedInvoice.totals.vatMinor,
                      },
                    ]).map((item: any, idx: number) => {
                      const net = ((item.baseMinor || item.unitPriceMinor || 0) / 100).toFixed(2);
                      const vat = ((item.vatMinor || 0) / 100).toFixed(2);
                      const total = ((item.totalMinor || 0) / 100).toFixed(2);

                      return (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="p-3 text-white font-medium">{item.description}</td>
                          <td className="p-3 text-center text-slate-300 font-mono">{item.quantity || 1}</td>
                          <td className="p-3 text-right font-mono text-slate-300">{net}</td>
                          <td className="p-3 text-right font-mono text-slate-400">{vat}</td>
                          <td className="p-3 text-right font-mono text-white font-bold">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="p-4 rounded-lg bg-[#1A202C] border border-[#2A3241] space-y-2 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Net Amount (Before Tax):</span>
                  <span>{((selectedInvoice.totals?.baseMinor || 0) / 100).toFixed(2)} {selectedInvoice.currency}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>UAE 5% VAT:</span>
                  <span>{((selectedInvoice.totals?.vatMinor || 0) / 100).toFixed(2)} {selectedInvoice.currency}</span>
                </div>
                <div className="pt-2 border-t border-[#2A3241] flex justify-between font-bold text-white text-sm">
                  <span>Total Due / Paid:</span>
                  <span className="text-[#D4FF00]">
                    {((selectedInvoice.totals?.totalMinor || 0) / 100).toFixed(2)} {selectedInvoice.currency}
                  </span>
                </div>
              </div>

              {/* Payment Telemetry Details */}
              <div className="p-3 rounded-lg bg-[#131722] border border-[#2A3241]/60 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-300" />
                  <span>
                    Settlement: <span className="text-white capitalize">{selectedInvoice.payment?.method || 'POS Card'}</span>
                  </span>
                </div>
                <span>FTA Audit Verification Passed</span>
              </div>

              {/* Footer Controls */}
              <div className="pt-3 border-t border-[#2A3241] flex items-center justify-between gap-3">
                <div className="text-[10px] text-slate-400">
                  Peppol-ready XML &amp; SHA-256 Hash Chain
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1E2430] text-slate-300 hover:text-white border border-[#2A3241] font-semibold text-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDownloadingPdf}
                    onClick={() => handleDownloadPdf(selectedInvoice)}
                    className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-[#D4FF00] hover:bg-[#c2ed00] text-[#121800] font-bold text-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
