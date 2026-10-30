import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Building2,
  Receipt,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  X,
} from "../ui/icons";

interface GymOnboardingModalProps {
  onSuccess?: () => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export function GymOnboardingModal({
  onSuccess,
  onClose,
  canDismiss = true,
}: GymOnboardingModalProps) {
  const { createGym, user, signOut } = useAuth();

  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState("");
  const [vatRegistered, setVatRegistered] = useState(true);
  const [trnNumber, setTrnNumber] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [timezone, setTimezone] = useState("Asia/Dubai");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!legalName.trim() || !tradeName.trim() || !tradeLicenseNumber.trim()) {
      setErrorMessage("Please complete all mandatory legal facility fields.");
      return;
    }

    if (vatRegistered && trnNumber.trim().length !== 15) {
      setErrorMessage(
        "UAE Federal Tax Authority (FTA) requires a valid 15-digit TRN for VAT-registered entities."
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await createGym({
        legalName: legalName.trim(),
        tradeName: tradeName.trim(),
        tradeLicenseNumber: tradeLicenseNumber.trim(),
        vatRegistered,
        trnNumber: vatRegistered ? trnNumber.trim() : null,
        currency,
        timezone,
      });

      if (!result.success) {
        setErrorMessage(
          result.error || "Failed to register gym facility. Please verify license format."
        );
      } else {
        onSuccess?.();
      }
    } catch {
      setErrorMessage("Network error while creating facility record.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-6 sm:p-8 relative">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface font-display">
                Register Fitness Facility
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Enter your facility&apos;s legal and registration details.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canDismiss && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-container transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {!canDismiss && (
              <button
                type="button"
                onClick={() => signOut()}
                className="text-xs text-outline hover:text-error transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-lg bg-error-container/20 border border-error/40 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-error">{errorMessage}</p>
          </div>
        )}

        {/* Facility Registration Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="legal-name"
                className="block text-xs font-semibold text-on-surface mb-1"
              >
                Legal Entity Name *
              </label>
              <input
                id="legal-name"
                type="text"
                required
                placeholder="e.g. Apex Health & Fitness LLC"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full bg-surface-container text-on-surface placeholder:text-outline text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="trade-name"
                className="block text-xs font-semibold text-on-surface mb-1"
              >
                Brand / Trade Name *
              </label>
              <input
                id="trade-name"
                type="text"
                required
                placeholder="e.g. Apex Gym Downtown"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                className="w-full bg-surface-container text-on-surface placeholder:text-outline text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="license-no"
                className="block text-xs font-semibold text-on-surface mb-1"
              >
                Economic Dept / Trade License # *
              </label>
              <input
                id="license-no"
                type="text"
                required
                placeholder="e.g. DED-DXB-987654"
                value={tradeLicenseNumber}
                onChange={(e) => setTradeLicenseNumber(e.target.value)}
                className="w-full bg-surface-container text-on-surface placeholder:text-outline text-xs px-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="currency"
                className="block text-xs font-semibold text-on-surface mb-1"
              >
                Base Currency &amp; Timezone
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-surface-container text-on-surface text-xs px-2.5 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none font-mono"
                >
                  <option value="AED">AED (د.إ)</option>
                  <option value="SAR">SAR (﷼)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                </select>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-surface-container text-on-surface text-xs px-2.5 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none"
                >
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Riyadh">Asia/Riyadh (AST)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                </select>
              </div>
            </div>
          </div>

          {/* UAE VAT / TRN Section */}
          <div className="p-3.5 rounded-lg bg-surface-container border border-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={vatRegistered}
                  onChange={(e) => setVatRegistered(e.target.checked)}
                  className="w-4 h-4 rounded border-outline-variant/60 bg-surface-container text-primary accent-primary"
                />
                <span className="text-xs font-bold text-on-surface">
                  Entity is Registered for UAE VAT
                </span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                FTA Compliance
              </span>
            </div>

            {vatRegistered && (
              <div>
                <label
                  htmlFor="trn-no"
                  className="block text-[11px] font-semibold text-on-surface-variant mb-1"
                >
                  15-digit Tax Registration Number (TRN)
                </label>
                <div className="relative">
                  <Receipt className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                  <input
                    id="trn-no"
                    type="text"
                    maxLength={15}
                    placeholder="100000000000003"
                    value={trnNumber}
                    onChange={(e) => setTrnNumber(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-surface-container-high text-on-surface placeholder:text-outline text-xs pl-9 pr-3 py-2 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none font-mono"
                  />
                </div>
                <p className="mt-1 text-[10px] text-outline">
                  Must be 15 numeric digits starting with 100 for UAE entities.
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-2 flex items-center gap-3">
            {canDismiss && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high text-slate-300 font-semibold text-xs border border-outline-variant/40 transition-all cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-on-primary font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-on-primary" />
                  <span>Registering Facility...</span>
                </>
              ) : (
                <>
                  <span>Register Facility</span>
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
