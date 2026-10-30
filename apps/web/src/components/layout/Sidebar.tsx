import React from "react";
import { useSidebar } from "../../context/SidebarContext";
import {
  LayoutDashboard,
  Users,
  Activity,
  ShieldCheck,
  Dumbbell,
  Receipt,
  Settings,
  ChevronLeft,
  PulseLogo,
} from "../ui/icons";

export interface NavItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "primary" | "secondary" | "tertiary";
}

/**
 * 8 Exact Domain Navigation Modules per Section 9.1 Specification:
 * 1. Overview (/dashboard)
 * 2. Front Desk (/desk)
 * 3. Members (/members)
 * 4. Plans & Pricing (/plans)
 * 5. Freezes (/freezes)
 * 6. Shifts & Cash (/shifts)
 * 7. Invoices (/invoices)
 * 8. Settings & Staff (/settings)
 */
const DOMAIN_MODULES: NavItem[] = [
  { id: "overview", name: "Overview", path: "/dashboard", icon: LayoutDashboard },
  { id: "desk", name: "Front Desk", path: "/desk", icon: Activity },
  { id: "members", name: "Members", path: "/members", icon: Users },
  { id: "plans", name: "Plans & Pricing", path: "/plans", icon: Dumbbell },
  {
    id: "freezes",
    name: "Freezes",
    path: "/freezes",
    icon: ShieldCheck,
    badge: "1 Req",
    badgeVariant: "tertiary",
  },
  { id: "shifts", name: "Shifts & Cash", path: "/shifts", icon: Receipt },
  { id: "invoices", name: "Invoices", path: "/invoices", icon: Receipt },
];

const SECONDARY_MODULES: NavItem[] = [
  { id: "settings", name: "Settings & Staff", path: "/settings", icon: Settings },
];

interface SidebarProps {
  activeNav: string;
  onNavSelect: (id: string) => void;
}

export function Sidebar({ activeNav, onNavSelect }: SidebarProps) {
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <aside
      id="main-sidebar"
      aria-label="Main Navigation"
      data-state={isCollapsed ? "collapsed" : "expanded"}
      className="group flex flex-col h-full bg-surface-container-low border-r border-outline-variant/30 transition-[width] duration-300 ease-in-out data-[state=expanded]:w-64 data-[state=collapsed]:w-[4.5rem] shrink-0 select-none overflow-hidden relative z-40 font-sans"
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-outline-variant/30 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="shrink-0 flex items-center justify-center shadow-sm">
            <PulseLogo className="w-8 h-8 rounded-lg" />
          </div>
          <div className="flex flex-col min-w-0 group-data-[state=collapsed]:hidden transition-opacity duration-200">
            <span className="font-bold text-base text-on-surface tracking-tight uppercase leading-none font-display">
              GymPulse
            </span>
            <span className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold mt-0.5">
              Admin Suite
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Scroll Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-6">
        {/* Core Modules Section */}
        <div>
          <div className="px-2 mb-2 group-data-[state=collapsed]:hidden">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Management
            </span>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Management Modules">
            {DOMAIN_MODULES.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;

              return (
                <div key={item.id} className="relative group/item">
                  <button
                    type="button"
                    title={item.name}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onNavSelect(item.id)}
                    className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-150 relative cursor-pointer ${
                      isActive
                        ? "bg-[#1E2430] text-white font-semibold border border-[#2A3241] shadow-xs"
                        : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent"
                    } group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? "text-[#D4FF00]" : "text-slate-400 group-hover/item:text-slate-200"
                      }`}
                    />
                    <span className="truncate group-data-[state=collapsed]:hidden text-left flex-1">
                      {item.name}
                    </span>

                    {/* Badge strictly when human action is required */}
                    {item.badge && (
                      <span className="group-data-[state=collapsed]:hidden text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>

                  {/* Accessible Hover Tooltip when Collapsed */}
                  <div
                    role="tooltip"
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-surface-container-highest text-on-surface text-xs font-semibold whitespace-nowrap shadow-lg border border-outline-variant/40 pointer-events-none z-50 transition-all opacity-0 translate-x-1 invisible group-data-[state=collapsed]:group-hover/item:opacity-100 group-data-[state=collapsed]:group-hover/item:visible group-data-[state=collapsed]:group-hover/item:translate-x-0"
                  >
                    {item.name}
                    {item.badge && (
                      <span className="ml-1.5 text-[10px] text-amber-400">
                        ({item.badge})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Secondary Modules Section */}
        <div className="mt-auto pt-2 border-t border-outline-variant/30">
          <nav className="flex flex-col gap-1" aria-label="Settings">
            {SECONDARY_MODULES.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;

              return (
                <div key={item.id} className="relative group/item">
                  <button
                    type="button"
                    title={item.name}
                    onClick={() => onNavSelect(item.id)}
                    className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-[#1E2430] text-white font-semibold border border-[#2A3241] shadow-xs"
                        : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent"
                    } group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? "text-[#D4FF00]" : "text-slate-400 group-hover/item:text-slate-200"
                      }`}
                    />
                    <span className="truncate group-data-[state=collapsed]:hidden text-left flex-1">
                      {item.name}
                    </span>
                  </button>

                  <div
                    role="tooltip"
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-surface-container-highest text-on-surface text-xs font-semibold whitespace-nowrap shadow-lg border border-outline-variant/40 pointer-events-none z-50 transition-all opacity-0 translate-x-1 invisible group-data-[state=collapsed]:group-hover/item:opacity-100 group-data-[state=collapsed]:group-hover/item:visible group-data-[state=collapsed]:group-hover/item:translate-x-0"
                  >
                    {item.name}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Area: Clean Version Indicator & Collapse Toggle Button */}
      <div className="p-3 border-t border-outline-variant/30 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between px-2 text-xs text-slate-400 group-data-[state=collapsed]:hidden">
          <span>v3.4.12-rc</span>
          <span className="text-[10px] text-slate-500">Connected</span>
        </div>

        {/* Collapse / Expand Toggle Button */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full flex items-center gap-3 p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer group-data-[state=collapsed]:justify-center shadow-xs"
        >
          <ChevronLeft className="w-4 h-4 shrink-0 transition-transform duration-300 ease-in-out group-data-[state=collapsed]:rotate-180 text-slate-400" />
        </button>
      </div>
    </aside>
  );
}
