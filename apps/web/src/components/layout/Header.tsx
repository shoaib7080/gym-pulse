import { useState } from "react";
import {
  Building2,
  ChevronDown,
  Search,
  Bell,
  HelpCircle,
  Palette,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
} from "../ui/icons";
import {
  AVAILABLE_THEMES,
  applyThemeToDocument,
  type ThemeConfig,
} from "../../theme";
import { useAuth } from "../../context/AuthContext";

interface HeaderProps {
  onSearchClick?: () => void;
  onRegisterGymClick?: () => void;
}

export function Header({ onSearchClick, onRegisterGymClick }: HeaderProps) {
  const { user, userGyms, activeGym, activeGymId, setActiveGymId, signOut } = useAuth();

  const [selectedBranch, setSelectedBranch] = useState("Downtown Flagship");
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState("kinetic-obsidian");

  const isExplorerMode = !userGyms || userGyms.length === 0;
  const isPendingVerification = activeGym?.status === "pending_verification";
  const isVerifiedActive = activeGym?.status === "active";

  const defaultBranches = [
    {
      name: "Downtown Flagship",
      code: "Branch #01",
      capacity: "84%",
      status: "Active Hub",
    },
    {
      name: "Westside CrossFit",
      code: "Branch #02",
      capacity: "92%",
      status: "Peak Load",
    },
    {
      name: "Uptown Spa Club",
      code: "Branch #03",
      capacity: "45%",
      status: "Normal",
    },
  ];

  const handleSelectTheme = (theme: ThemeConfig) => {
    setActiveThemeId(theme.id);
    applyThemeToDocument(theme);
    setIsThemeMenuOpen(false);
  };

  // Compute user initials
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "GP";

  const userRole = isExplorerMode
    ? "Operator"
    : activeGym?.yourRole
    ? activeGym.yourRole.charAt(0).toUpperCase() + activeGym.yourRole.slice(1)
    : "Administrator";

  const facilityName = isExplorerMode
    ? "Demo Facility"
    : activeGym?.tradeName || "Downtown Flagship";

  return (
    <div className="flex flex-col shrink-0 z-30 font-sans">
      {/* Demo / Sample Data Notice */}
      {isExplorerMode && (
        <div className="w-full bg-[#1A202C] border-b border-white/[0.08] px-4 py-2 flex items-center justify-between text-xs text-slate-300 gap-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase tracking-wider shrink-0">
              Demo Mode
            </span>
            <span className="truncate text-slate-300">
              You are viewing sample data. Register your facility to start live operations.
            </span>
          </div>
          <button
            type="button"
            onClick={onRegisterGymClick}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary hover:bg-primary-hover active:bg-primary-active text-on-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <span>Register Facility</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Verification In Review Notice */}
      {!isExplorerMode && isPendingVerification && (
        <div className="w-full bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 gap-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Verification In Review
            </span>
            <span className="truncate text-amber-200/90">
              Your facility registration is under review. Live payouts and official VAT invoicing will unlock upon approval.
            </span>
          </div>
        </div>
      )}

      {/* Main Top Header Bar */}
      <header className="h-16 w-full px-6 bg-surface-container-lowest/85 backdrop-blur-xl border-b border-outline-variant/30 flex items-center justify-between gap-4 shrink-0 shadow-sm font-sans">
        {/* Left: Branch / Gym Selector Dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 hover:border-slate-500 transition-all cursor-pointer shadow-xs group"
            >
              <Building2 className="w-4 h-4 text-slate-300 shrink-0" />
              <div className="flex flex-col text-left max-w-[160px] sm:max-w-[200px] truncate">
                <span className="text-xs font-bold text-on-surface leading-tight truncate">
                  {facilityName}
                </span>
                <span className="text-[10px] text-slate-400 font-medium leading-tight truncate">
                  {isExplorerMode
                    ? "Sample Data"
                    : activeGym?.branches?.length
                    ? `${activeGym.branches.length} Branches • Active`
                    : `${selectedBranch}`}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 ml-1 transition-transform duration-200 ${
                  isBranchDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Facility / Branch Dropdown Menu */}
            {isBranchDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-xl bg-surface-container-high border border-outline-variant/50 p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* If user has multiple assigned gyms */}
                {userGyms && userGyms.length > 1 && (
                  <div className="mb-2 pb-2 border-b border-outline-variant/30">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Switch Fitness Facility
                    </div>
                    <div className="flex flex-col gap-1">
                      {userGyms.map((g) => (
                        <button
                          key={g.gymId}
                          type="button"
                          onClick={() => {
                            setActiveGymId(g.gymId);
                            setIsBranchDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                            activeGymId === g.gymId
                              ? "bg-slate-800 text-white font-semibold"
                              : "hover:bg-surface-bright text-on-surface"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="font-semibold truncate">{g.gym.tradeName}</div>
                            <div className="text-[10px] text-slate-400">{g.role} • {g.gym.currency}</div>
                          </div>
                          {activeGymId === g.gymId && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Branch Selection */}
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Facility Branch
                </div>
                <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                  {activeGym?.branches && activeGym.branches.length > 0 ? (
                    activeGym.branches.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setSelectedBranch(b.name);
                          setIsBranchDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                          selectedBranch === b.name
                            ? "bg-slate-800 text-white font-semibold"
                            : "hover:bg-surface-bright text-on-surface"
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{b.name}</div>
                          <div className="text-[10px] text-slate-400">{b.code} • {b.city || "Dubai"}</div>
                        </div>
                        {b.isMain && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                            Main
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    defaultBranches.map((b) => (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() => {
                          setSelectedBranch(b.name);
                          setIsBranchDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                          selectedBranch === b.name
                            ? "bg-slate-800 text-white font-semibold"
                            : "hover:bg-surface-bright text-on-surface"
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{b.name}</div>
                          <div className="text-[10px] text-slate-400">{b.code}</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container font-mono">
                          {b.capacity}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active Shift Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container border border-outline-variant/30 text-[11px] text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium">Shift: Front Desk Active</span>
          </div>
        </div>

        {/* Middle: Ctrl+K / Command Search Bar (Widened & uncluttered) */}
        <div className="flex-1 max-w-xl mx-4 hidden md:block">
          <div
            role="search"
            onClick={onSearchClick}
            className="relative flex items-center w-full cursor-pointer group"
          >
            <Search className="w-4 h-4 absolute left-3.5 text-slate-400 group-hover:text-primary transition-colors pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search members, check-ins, invoices..."
              className="w-full bg-surface-container-low text-on-surface placeholder:text-slate-400 text-xs pl-10 pr-16 py-2 rounded-lg border border-outline-variant/40 group-hover:border-slate-500 focus:outline-none transition-colors cursor-pointer"
            />
            <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-surface-container border border-outline-variant/50 rounded font-sans shadow-2xs">
                Ctrl+K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Actions, Theme Switcher, Notifications, User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Theme Picker Dropdown */}
          <div className="relative">
            <button
              type="button"
              title="Switch Dashboard Theme"
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              className="flex items-center gap-1.5 p-2 rounded-lg text-slate-400 hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              <Palette className="w-4 h-4 text-slate-300" />
              <span className="text-xs font-semibold hidden sm:inline">Theme</span>
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface-container-high border border-outline-variant/50 p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Color Systems
                </div>
                <div className="flex flex-col gap-1">
                  {Object.values(AVAILABLE_THEMES).map((th) => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => handleSelectTheme(th)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                        activeThemeId === th.id
                          ? "bg-slate-800 text-white font-semibold"
                          : "hover:bg-surface-bright text-on-surface"
                      }`}
                    >
                      <span>{th.name}</span>
                      <span
                        className="w-3 h-3 rounded-full border border-surface shadow-xs"
                        style={{ backgroundColor: th.colors.primary }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notifications & Help Center */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Help & Knowledge Base"
              className="p-2 rounded-lg text-slate-400 hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Notifications"
              className="relative p-2 rounded-lg text-slate-400 hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-outline-variant/30 hidden sm:block" />

          {/* User Profile */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2.5 pl-1 p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer text-left"
            >
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-bold text-on-surface leading-tight">
                  {user?.name || "Operator"}
                </span>
                <span className="text-[10px] text-slate-400 font-medium leading-tight">
                  {userRole}
                </span>
              </div>

              <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-xs font-bold text-slate-200">
                {userInitials}
              </div>
            </button>

            {/* Profile & Session Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-surface-container-high border border-outline-variant/50 p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="pb-3 border-b border-outline-variant/30">
                  <div className="text-xs font-bold text-on-surface">{user?.name || "Operator"}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {user?.email || "user@gympulse.ae"}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    Role: {userRole}
                  </div>
                </div>

                <div className="py-2">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                    Active Facility
                  </div>
                  <div className="text-xs font-medium text-on-surface">
                    {facilityName}
                  </div>
                </div>

                <div className="pt-2 border-t border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-semibold text-error hover:bg-error-container/20 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
