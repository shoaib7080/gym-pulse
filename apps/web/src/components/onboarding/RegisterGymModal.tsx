import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Building2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  X,
  UploadCloud,
} from "../ui/icons";

interface RegisterGymModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * RegisterGymModal Slide-Over Drawer
 * Clean, focused slide-over drawer collecting the 4 essential fields:
 * 1. Gym Trade Name (e.g. Iron Oasis Fitness)
 * 2. Legal Entity Name
 * 3. UAE Trade License Number (with optional file upload)
 * 4. Main Branch Name & City (e.g. Dubai Marina)
 * Optional: 15-digit Tax Registration Number TRN
 *
 * On submit: calls POST /v1/gyms (real network request), updates activeGymId,
 * transitions the user from Explorer Mode to Stage 2 (pending_verification).
 */
export function RegisterGymModal({
  isOpen,
  onClose,
  onSuccess,
}: RegisterGymModalProps) {
  const { createGym, fetchGyms } = useAuth();

  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState("");
  const [mainBranchName, setMainBranchName] = useState("Downtown Flagship");
  const [mainBranchCity, setMainBranchCity] = useState("Dubai");
  const [trnNumber, setTrnNumber] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [licenseFileName, setLicenseFileName] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage("License file must be smaller than 10MB");
        return;
      }
      setLicenseFileName(file.name);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!tradeName.trim()) {
      setErrorMessage("Gym Trade Name is required (e.g. Iron Oasis Fitness).");
      return;
    }
    if (!legalName.trim()) {
      setErrorMessage("Legal Entity Name is required.");
      return;
    }
    if (!tradeLicenseNumber.trim()) {
      setErrorMessage("UAE Trade License Number is required.");
      return;
    }
    if (!mainBranchName.trim() || !mainBranchCity.trim()) {
      setErrorMessage("Main branch name and city are required.");
      return;
    }

    if (vatRegistered && trnNumber.trim()) {
      if (!/^[0-9]{15}$/.test(trnNumber.trim())) {
        setErrorMessage("UAE Tax Registration Number (TRN) must be exactly 15 digits.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await createGym({
        tradeName: tradeName.trim(),
        legalName: legalName.trim(),
        tradeLicenseNumber: tradeLicenseNumber.trim(),
        vatRegistered: Boolean(vatRegistered && trnNumber.trim()),
        trnNumber: trnNumber.trim() || undefined,
        currency: "AED",
        timezone: "Asia/Dubai",
        settings: {
          mainBranchName: mainBranchName.trim(),
          mainBranchCity: mainBranchCity.trim(),
          licenseDocument: licenseFileName || undefined,
        },
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to register gym facility.");
        return;
      }

      await fetchGyms();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during facility onboarding.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-gym-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#11141A] border-l border-[#242933] h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#242933] bg-[#171A21]/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#D4FF00]/10 border border-[#D4FF00]/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#D4FF00]" />
            </div>
            <div>
              <h2 id="register-gym-title" className="text-base font-bold text-white tracking-tight">
                Register Your Gym
              </h2>
              <p className="text-xs text-slate-400">
                Unlock full access, real check-ins, and live billing.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-300">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-2.5 text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* 1. Trade Name */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-200">
              Gym Trade Name <span className="text-[#D4FF00]">*</span>
            </label>
            <input
              type="text"
              required
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              placeholder="e.g. Iron Oasis Fitness"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#171A21] border border-[#242933] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#D4FF00]/60 transition-colors"
            />
            <p className="text-[11px] text-slate-500">
              The public brand name displayed on member passes and the app.
            </p>
          </div>

          {/* 2. Legal Entity Name */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-200">
              Legal Entity Name <span className="text-[#D4FF00]">*</span>
            </label>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Iron Oasis Fitness LLC"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#171A21] border border-[#242933] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#D4FF00]/60 transition-colors"
            />
            <p className="text-[11px] text-slate-500">
              Official company name registered on your UAE commercial register.
            </p>
          </div>

          {/* 3. Trade License Number & File Upload */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-200">
              UAE Trade License Number <span className="text-[#D4FF00]">*</span>
            </label>
            <input
              type="text"
              required
              value={tradeLicenseNumber}
              onChange={(e) => setTradeLicenseNumber(e.target.value)}
              placeholder="e.g. DED-892144 or 1234567"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#171A21] border border-[#242933] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#D4FF00]/60 transition-colors"
            />

            {/* Optional File Attachment */}
            <div className="mt-2 pt-1">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Trade License Document (PDF or Image, optional)
              </label>
              <label className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#171A21] border border-dashed border-[#242933] hover:border-slate-500 transition-colors cursor-pointer">
                <div className="flex items-center gap-2 text-slate-400">
                  <UploadCloud className="w-4 h-4 text-[#D4FF00]" />
                  <span className="truncate max-w-[240px]">
                    {licenseFileName || "Select license PDF or scanned copy..."}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Browse
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>

          {/* 4. Main Branch Name & City */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-200">
                Main Branch Name <span className="text-[#D4FF00]">*</span>
              </label>
              <input
                type="text"
                required
                value={mainBranchName}
                onChange={(e) => setMainBranchName(e.target.value)}
                placeholder="Downtown Flagship"
                className="w-full px-3 py-2.5 rounded-xl bg-[#171A21] border border-[#242933] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#D4FF00]/60 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-200">
                City / Emirate <span className="text-[#D4FF00]">*</span>
              </label>
              <select
                value={mainBranchCity}
                onChange={(e) => setMainBranchCity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#171A21] border border-[#242933] text-white focus:outline-hidden focus:border-[#D4FF00]/60 transition-colors"
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

          {/* Optional TRN */}
          <div className="p-3.5 rounded-xl bg-[#171A21] border border-[#242933] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200">UAE VAT Registration</div>
                <div className="text-[11px] text-slate-400">
                  Is your facility registered for 5% UAE VAT?
                </div>
              </div>
              <input
                type="checkbox"
                id="vat-check"
                checked={vatRegistered}
                onChange={(e) => setVatRegistered(e.target.checked)}
                className="h-4 w-4 rounded accent-[#D4FF00] cursor-pointer"
              />
            </div>

            {vatRegistered && (
              <div className="space-y-1.5 pt-2 border-t border-[#242933]">
                <label className="block font-semibold text-slate-200">
                  15-digit Tax Registration Number (TRN)
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={trnNumber}
                  onChange={(e) => setTrnNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="100XXXXXXXXX003"
                  className="w-full px-3 py-2 rounded-lg bg-[#11141A] border border-[#242933] text-white font-mono placeholder:text-slate-600 focus:outline-hidden focus:border-[#D4FF00]/60 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Trust strip */}
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center gap-2.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-[#D4FF00] shrink-0" />
            <span>
              Your preview data will be archived safely. Live mode will initialize your dedicated branch and verification queue.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-[#242933] text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 bg-[#D4FF00] hover:bg-[#bfe600] text-black font-bold px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Register Gym &amp; Unlock</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
