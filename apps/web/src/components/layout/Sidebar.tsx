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
  Layers,
  PulseLogo,
} from "../ui/icons";

export interface NavItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "primary" | "secondary" | "tertiary";
}

const CORE_MODULES: NavItem[] = [
  { id: "bento", name: "Dashboard Hub", icon: LayoutDashboard },
  {
    id: "operations",
    name: "Operations & Roster",
    icon: Users,
    badge: "1,420",
    badgeVariant: "primary",
  },
  {
    id: "telemetry",
    name: "Live Telemetry",
    icon: Activity,
    badge: "Live",
    badgeVariant: "secondary",
  },
  {
    id: "compliance",
    name: "Compliance Vault",
    icon: ShieldCheck,
    badge: "1 Req",
    badgeVariant: "tertiary",
  },
  { id: "equipment", name: "Equipment Map", icon: Dumbbell },
  { id: "billing", name: "Billing & Shifts", icon: Receipt },
  {
    id: "gallery",
    name: "Stitch Screens",
    icon: Layers,
    badge: "3 Designs",
    badgeVariant: "primary",
  },
];

const SECONDARY_MODULES: NavItem[] = [
  { id: "settings", name: "Facility Settings", icon: Settings },
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
      className="group flex flex-col h-full bg-surface-container-low border-r border-outline-variant/30 transition-[width] duration-300 ease-in-out data-[state=expanded]:w-64 data-[state=collapsed]:w-[4.5rem] shrink-0 select-none overflow-hidden relative z-40"
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
            <span className="text-[10px] text-primary tracking-widest uppercase font-semibold mt-0.5">
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
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Core Modules
            </span>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Core Modules">
            {CORE_MODULES.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;

              return (
                <div key={item.id} className="relative group/item">
                  <button
                    type="button"
                    title={item.name}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onNavSelect(item.id)}
                    className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                      isActive
                        ? "bg-primary-container text-on-primary-container font-semibold shadow-[0_0_15px_-3px_rgba(132,204,22,0.3)]"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    } group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="truncate group-data-[state=collapsed]:hidden text-left flex-1">
                      {item.name}
                    </span>

                    {/* Badge when expanded */}
                    {item.badge && (
                      <span
                        className={`group-data-[state=collapsed]:hidden text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          item.badgeVariant === "tertiary"
                            ? "bg-tertiary-container/30 text-tertiary"
                            : item.badgeVariant === "secondary"
                              ? "bg-secondary-container/20 text-secondary"
                              : isActive
                                ? "bg-on-primary-container/20 text-on-primary-container"
                                : "bg-primary/10 text-primary"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>

                  {/* Accessible Hover Tooltip when Collapsed (shadcn/Radix style) */}
                  <div
                    role="tooltip"
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-surface-container-highest text-on-surface text-xs font-semibold whitespace-nowrap shadow-lg border border-outline-variant/40 pointer-events-none z-50 transition-all opacity-0 translate-x-1 invisible group-data-[state=collapsed]:group-hover/item:opacity-100 group-data-[state=collapsed]:group-hover/item:visible group-data-[state=collapsed]:group-hover/item:translate-x-0"
                  >
                    {item.name}
                    {item.badge && (
                      <span className="ml-1.5 text-[10px] text-primary">
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
                    className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-primary-container text-on-primary-container font-semibold"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    } group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
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

      {/* Bottom Area: Version Indicator & Collapse Toggle Button with Rotating Chevron */}
      <div className="p-3 border-t border-outline-variant/30 shrink-0 flex flex-col gap-2">
        {/* Version info when expanded */}
        <div className="flex items-center justify-between px-2 text-xs text-outline group-data-[state=collapsed]:hidden">
          <span>v3.4.12-rc</span>
          <span
            className="h-2 w-2 rounded-full bg-primary animate-pulse"
            title="System Connected"
          />
        </div>

        {/* Collapse / Expand Toggle Button with Rotating Chevron */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full flex items-center gap-3 p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer group-data-[state=collapsed]:justify-center shadow-xs"
        >
          <ChevronLeft className="w-4 h-4 shrink-0 transition-transform duration-300 ease-in-out group-data-[state=collapsed]:rotate-180" />
          {/* <span className="text-xs font-medium group-data-[state=collapsed]:hidden">
            Collapse Sidebar
          </span> */}
        </button>
      </div>
    </aside>
  );
}
