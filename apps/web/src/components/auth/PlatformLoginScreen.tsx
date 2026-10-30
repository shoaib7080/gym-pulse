import { useState, type FormEvent } from "react";
import { usePlatformAuth } from "../../context/PlatformAuthContext";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  ArrowRight,
  Terminal,
  KeyRound,
  CheckCircle2,
  Dumbbell,
} from "../ui/icons";

interface PlatformLoginScreenProps {
  onSwitchPortal?: (portal: "gym" | "platform") => void;
}

export function PlatformLoginScreen({ onSwitchPortal }: PlatformLoginScreenProps) {
  const { signIn } = usePlatformAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Demo fill for instant testing
  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Administrator email address and secure passphrase are required.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn(email, password);
      if (!result.success) {
        setErrorMessage(
          result.error ||
            "Authentication rejected. Invalid credentials or insufficient platform clearance."
        );
      }
    } catch {
      setErrorMessage("Network error connecting to the Global Platform Gateway.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#060e20] text-on-surface flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 font-sans relative overflow-x-hidden">
      {/* Background High-Security Cyber Glows */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-secondary/15 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Header / Branding */}
      <header className="w-full max-w-5xl flex items-center justify-between py-2 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shadow-lg shadow-secondary/25">
            <KeyRound className="w-5 h-5 text-[#003640]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-white tracking-tight font-display">
                GymPulse
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/20 text-secondary border border-secondary/40 uppercase tracking-widest font-mono">
                Platform HQ
              </span>
            </div>
            <p className="text-xs text-secondary/80 font-mono">
              Global Platform Governance &amp; Multi-Tenant Core
            </p>
          </div>
        </div>

        {/* Portal Switcher Button in Header */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high/80 border border-outline-variant/40 text-xs text-on-surface-variant font-mono">
            <ShieldAlert className="w-4 h-4 text-secondary" />
            <span>Role Guard Enforced</span>
          </div>

          <button
            type="button"
            onClick={() => onSwitchPortal?.("gym")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 hover:border-primary/50 text-xs font-semibold text-primary transition-all cursor-pointer shadow-xs"
            title="Switch to Club Operator Portal"
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Club Portal</span>
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md my-auto relative z-10 py-6">
        <div className="rounded-xl bg-surface-container-low/95 backdrop-blur-2xl border border-secondary/30 shadow-2xl p-6 sm:p-8">
          {/* Card Header & Shield Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-xl bg-secondary/10 border border-secondary/30 text-secondary mb-3">
              <Terminal className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white font-display tracking-tight">
              Platform Admin Gateway
            </h1>
            <p className="text-xs text-on-surface-variant mt-1.5">
              Authorized personnel only. Grants governance access over all gym tenants, KYC approvals, SaaS billing, and cryptographic ledgers.
            </p>
          </div>

          {/* Security Clearance Notice Banner */}
          <div className="mb-5 p-3 rounded-lg bg-surface-container border border-outline-variant/30 flex items-center gap-2.5 text-xs text-on-surface-variant">
            <ShieldCheck className="w-4 h-4 text-secondary shrink-0" />
            <span className="font-mono text-[11px]">
              Platform roles: <strong className="text-secondary">superadmin</strong>, <strong className="text-secondary">support</strong>, <strong className="text-secondary">auditor</strong>.
            </span>
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-error-container/20 border border-error/40 flex items-start gap-3 animate-in fade-in duration-200"
            >
              <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-error leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="platform-email"
                className="block text-xs font-semibold text-on-surface mb-1.5"
              >
                Platform Operator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                <input
                  id="platform-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@gympulse.ae"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container text-on-surface placeholder:text-outline text-xs pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/50 focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary transition-colors font-mono"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="platform-password"
                className="block text-xs font-semibold text-on-surface mb-1.5"
              >
                Master Administrator Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                <input
                  id="platform-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container text-on-surface placeholder:text-outline text-xs pl-10 pr-10 py-2.5 rounded-lg border border-outline-variant/50 focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors p-1 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-2.5 px-4 rounded-lg bg-secondary hover:bg-secondary/90 active:bg-secondary/80 text-[#003640] font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-secondary/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-[#003640]" />
                  <span>Verifying Platform Clearance...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Platform Operator</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Pre-fill helper */}
          <div className="mt-6 pt-5 border-t border-outline-variant/30">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider font-mono">
                Development Superadmin
              </span>
              <span className="text-[10px] text-secondary font-mono">Platform DB</span>
            </div>
            <button
              type="button"
              onClick={() =>
                handleQuickFill("admin@gympulse.ae", "AdminPassword123!")
              }
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 hover:border-secondary/40 text-xs text-on-surface-variant hover:text-on-surface transition-all cursor-pointer group"
            >
              <div className="text-left font-mono">
                <span className="font-semibold text-white block text-xs">
                  Platform Superadmin
                </span>
                <span className="text-[11px] text-outline">
                  admin@gympulse.ae
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 font-bold group-hover:bg-secondary group-hover:text-[#003640] transition-colors">
                Autofill
              </span>
            </button>
          </div>

          {/* Portal Switcher Footer Banner */}
          <div className="mt-4 p-3 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between gap-2">
            <div className="text-left">
              <div className="text-xs font-bold text-on-surface">Gym Owner or Front Desk?</div>
              <div className="text-[10px] text-on-surface-variant">Access your facility club operations</div>
            </div>
            <button
              type="button"
              onClick={() => onSwitchPortal?.("gym")}
              className="px-2.5 py-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Facility Portal &rarr;
            </button>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-5xl text-center py-4 text-xs text-outline relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-outline-variant/20">
        <div>
          <span>&copy; {new Date().getFullYear()} GymPulse Technologies LLC • Platform Governance Gateway</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span>Zero-Trust Architecture</span>
          <span>•</span>
          <span>SHA-256 Audit Trails</span>
          <span>•</span>
          <span>Global Monolith Isolation</span>
        </div>
      </footer>
    </div>
  );
}
