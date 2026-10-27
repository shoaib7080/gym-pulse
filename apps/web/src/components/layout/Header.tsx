import { useState } from "react";
import {
  Building2,
  ChevronDown,
  Search,
  Bell,
  HelpCircle,
  ShieldCheck,
  Palette,
} from "../ui/icons";
import {
  AVAILABLE_THEMES,
  applyThemeToDocument,
  type ThemeConfig,
} from "../../theme";

interface HeaderProps {
  onSearchClick?: () => void;
}

export function Header({ onSearchClick }: HeaderProps) {
  const [selectedBranch, setSelectedBranch] = useState("Downtown Flagship");
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState("kinetic-obsidian");

  const branches = [
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

  return (
    <header className="sticky top-0 z-30 h-16 w-full px-6 bg-surface-container-lowest/85 backdrop-blur-xl border-b border-outline-variant/30 flex items-center justify-between gap-4 shrink-0 shadow-sm">
      {/* Left: Branch Selector Dropdown & Live Status Indicators */}
      <div className="flex items-center gap-3">
        {/* Interactive Branch Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 hover:border-primary/50 transition-all cursor-pointer shadow-xs group"
          >
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-on-surface leading-tight">
                {selectedBranch}
              </span>
              <span className="text-[10px] text-on-surface-variant font-medium leading-tight">
                Branch #01 • 84% Capacity
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-on-surface-variant ml-1 transition-transform duration-200 ${
                isBranchDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Branch Dropdown Menu */}
          {isBranchDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-surface-container-high border border-outline-variant/50 p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1.5 text-[10px] font-bold text-outline uppercase tracking-wider">
                Select Facility Branch
              </div>
              <div className="flex flex-col gap-1">
                {branches.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => {
                      setSelectedBranch(b.name);
                      setIsBranchDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                      selectedBranch === b.name
                        ? "bg-primary-container text-on-primary-container font-semibold"
                        : "hover:bg-surface-bright text-on-surface"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-[10px] opacity-75">{b.code}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container font-mono">
                      {b.capacity}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Status Indicators */}
        <div className="hidden xl:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container border border-outline-variant/40">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">
              Operating: Normal
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container border border-outline-variant/40">
            <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
            <span className="text-[11px] font-semibold text-secondary uppercase tracking-wide">
              Compliance: Verified
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Ctrl+K / Command Search Bar */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <div
          role="search"
          onClick={onSearchClick}
          className="relative flex items-center w-full cursor-pointer group"
        >
          <Search className="w-4 h-4 absolute left-3 text-on-surface-variant group-hover:text-primary transition-colors pointer-events-none" />
          <input
            type="text"
            readOnly
            placeholder="Search members, trainers, receipts..."
            className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs pl-9 pr-14 py-2 rounded-lg border border-outline-variant/40 group-hover:border-primary/50 focus:outline-none transition-colors cursor-pointer"
          />
          <div className="absolute right-2.5 flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-outline bg-surface-container border border-outline-variant/50 rounded font-mono shadow-2xs">
              Ctrl+K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Actions, Theme Switcher, Notifications, User Profile */}
      <div className="flex items-center gap-3">
        {/* Theme Picker Dropdown */}
        <div className="relative">
          <button
            type="button"
            title="Switch Dashboard Theme"
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className="flex items-center gap-1.5 p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <Palette className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold hidden sm:inline">
              Theme
            </span>
          </button>

          {isThemeMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface-container-high border border-outline-variant/50 p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[10px] font-bold text-outline uppercase tracking-wider">
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
                        ? "bg-primary-container text-on-primary-container font-semibold"
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
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button
            type="button"
            title="Notifications (3 unread)"
            className="relative p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary-container">
              3
            </span>
          </button>
        </div>

        <div className="h-6 w-px bg-outline-variant/30 hidden sm:block" />

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-bold text-on-surface leading-tight">
              Sarah Jenkins
            </span>
            <div className="flex items-center justify-end gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-[10px] text-on-surface-variant font-medium leading-tight">
                General Manager
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-xs font-bold text-primary ring-1 ring-primary/20">
              SJ
            </div>
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />
          </div>
        </div>
      </div>
    </header>
  );
}
