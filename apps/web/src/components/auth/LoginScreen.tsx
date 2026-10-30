import { useState, useMemo, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Dumbbell,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  UserPlus,
  Users,
  CheckCircle2,
  XCircle,
  Terminal,
} from "../ui/icons";

interface LoginScreenProps {
  onSwitchPortal?: (portal: "gym" | "platform") => void;
}

export function LoginScreen({
  onSwitchPortal: _onSwitchPortal,
}: LoginScreenProps) {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Evaluate password security rules in real-time
  const passwordRules = useMemo(() => {
    return {
      hasMinLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const isPasswordSecure =
    passwordRules.hasMinLength &&
    passwordRules.hasUpper &&
    passwordRules.hasLower &&
    passwordRules.hasNumber;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        setErrorMessage("Please enter your full name.");
        return;
      }

      // Explicit Password Rules Verification
      if (!passwordRules.hasMinLength) {
        setErrorMessage("Password must be at least 8 characters long.");
        return;
      }
      if (!passwordRules.hasUpper) {
        setErrorMessage(
          "Password must contain at least one uppercase letter (A-Z).",
        );
        return;
      }
      if (!passwordRules.hasLower) {
        setErrorMessage(
          "Password must contain at least one lowercase letter (a-z).",
        );
        return;
      }
      if (!passwordRules.hasNumber) {
        setErrorMessage(
          "Password must contain at least one numeric digit (0-9).",
        );
        return;
      }
    } else {
      if (password.length < 8) {
        setErrorMessage("Password must be at least 8 characters long.");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === "signin") {
        const result = await signIn(email, password);
        if (!result.success) {
          setErrorMessage(
            result.error ||
              "Authentication failed. Please verify your credentials.",
          );
        }
      } else {
        const result = await signUp(name, email, password);
        if (!result.success) {
          setErrorMessage(
            result.error ||
              "Registration failed. This email may already be registered.",
          );
        } else {
          setSuccessMessage(
            "Account created successfully! Initializing your facility dashboard...",
          );
        }
      }
    } catch {
      setErrorMessage(
        "An unexpected network error occurred. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 font-sans relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/10 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 right-0 w-[450px] h-[350px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Header / Branding */}
      <header className="w-full max-w-5xl flex items-center justify-between py-2 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Dumbbell className="w-6 h-6 text-on-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-on-surface tracking-tight font-display">
                GymPulse
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 uppercase tracking-widest">
                Club Ops
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-medium">
              Facility Operator &amp; Branch Staff Portal
            </p>
          </div>
        </div>

        {/* Header Right */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 text-slate-400">
            UAE &amp; GCC Management Core
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md my-auto relative z-10 py-6">
        <div className="rounded-xl bg-surface-container-low/95 backdrop-blur-xl border border-outline-variant/40 shadow-2xl p-6 sm:p-8">
          {/* Card Header & Switcher */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-on-surface font-display tracking-tight">
              {mode === "signin"
                ? "Sign In to GymPulse"
                : "Register Gym Account"}
            </h1>
            <p className="text-xs text-on-surface-variant mt-1.5">
              {mode === "signin"
                ? "Access your club dashboard & front-desk operations"
                : "Create your owner account to get started"}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-surface-container mb-6 border border-outline-variant/30">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === "signin"
                  ? "bg-surface-container-high text-on-surface shadow-sm border border-outline-variant/40"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === "signup"
                  ? "bg-surface-container-high text-on-surface shadow-sm border border-outline-variant/40"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Register (Owner)
            </button>
          </div>

          {/* Error Message Box */}
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

          {/* Success Message Box */}
          {successMessage && (
            <div
              role="status"
              className="mb-5 p-3.5 rounded-lg bg-primary/10 border border-primary/30 flex items-start gap-3 animate-in fade-in duration-200"
            >
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-primary leading-relaxed">
                  {successMessage}
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field (Sign Up Only) */}
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-semibold text-on-surface mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    placeholder="e.g. Tariq Al-Mansoor"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-surface-container text-on-surface placeholder:text-outline text-xs pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-on-surface mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@fitness-club.ae"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container text-on-surface placeholder:text-outline text-xs pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            {/* Password Field with Validation */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-on-surface"
                >
                  Password
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() =>
                      alert(
                        "Please request password reset from your club's General Manager or IT administrator.",
                      )
                    }
                    className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-surface-container text-on-surface placeholder:text-outline text-xs pl-10 pr-10 py-2.5 rounded-lg border transition-colors focus:outline-none focus:ring-1 ${
                    mode === "signup" && password.length > 0
                      ? isPasswordSecure
                        ? "border-primary/60 focus:border-primary focus:ring-primary"
                        : "border-warning/60 focus:border-warning focus:ring-warning"
                      : "border-outline-variant/50 focus:border-primary focus:ring-primary"
                  }`}
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

              {/* Dynamic Live Password Requirements Checklist (for Sign Up) */}
              {mode === "signup" && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 space-y-1.5">
                  <div className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                    Security Requirements
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordRules.hasMinLength
                          ? "text-primary font-medium"
                          : "text-outline"
                      }`}
                    >
                      {passwordRules.hasMinLength ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-outline-variant/60 flex items-center justify-center text-[8px] font-mono shrink-0">
                          8
                        </div>
                      )}
                      <span>8+ characters</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordRules.hasUpper
                          ? "text-primary font-medium"
                          : "text-outline"
                      }`}
                    >
                      {passwordRules.hasUpper ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-outline-variant/60 flex items-center justify-center text-[8px] font-mono shrink-0">
                          A
                        </div>
                      )}
                      <span>Uppercase (A-Z)</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordRules.hasLower
                          ? "text-primary font-medium"
                          : "text-outline"
                      }`}
                    >
                      {passwordRules.hasLower ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-outline-variant/60 flex items-center justify-center text-[8px] font-mono shrink-0">
                          a
                        </div>
                      )}
                      <span>Lowercase (a-z)</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordRules.hasNumber
                          ? "text-primary font-medium"
                          : "text-outline"
                      }`}
                    >
                      {passwordRules.hasNumber ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-outline-variant/60 flex items-center justify-center text-[8px] font-mono shrink-0">
                          1
                        </div>
                      )}
                      <span>Number (0-9)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Remember Me Checkbox (Sign In) */}
            {mode === "signin" && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-outline-variant/60 bg-surface-container text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                  <span className="text-xs text-on-surface-variant">
                    Keep me signed in
                  </span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                isLoading ||
                (mode === "signup" && !isPasswordSecure && password.length > 0)
              }
              className="w-full mt-3 py-2.5 px-4 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-on-primary font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-on-primary" />
                  <span>
                    {mode === "signin" ? "Verifying..." : "Creating Account..."}
                  </span>
                </>
              ) : (
                <>
                  <span>{mode === "signin" ? "Sign In" : "Register Gym Account"}</span>
                  {mode === "signin" ? (
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-5xl text-center py-4 text-xs text-outline relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-outline-variant/20">
        <div>
          <span>
            &copy; {new Date().getFullYear()} GymPulse Technologies LLC •
            Facility Operator Portal
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="hover:text-on-surface cursor-pointer">
            Security Architecture
          </span>
          <span>•</span>
          <span className="hover:text-on-surface cursor-pointer">
            UAE VAT Compliance
          </span>
          <span>•</span>
          <span className="hover:text-on-surface cursor-pointer">
            Multi-Tenant Scoping
          </span>
        </div>
      </footer>
    </div>
  );
}
