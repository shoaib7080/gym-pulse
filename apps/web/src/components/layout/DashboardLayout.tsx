import React, { useEffect, useState } from 'react';
import { SidebarProvider } from '../../context/SidebarContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeNav: string;
  onNavSelect: (id: string) => void;
}

export function DashboardLayout({ children, activeNav, onNavSelect }: DashboardLayoutProps) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Global Ctrl+K / Cmd+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsSearchModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <SidebarProvider>
      {/* 
        Requirement 1: Pure Flexbox Shell
        Structure the root dashboard using a full-screen flex layout (`h-screen flex overflow-hidden`).
      */}
      <div className="h-screen w-screen flex overflow-hidden bg-surface text-on-surface">
        {/* Left Sidebar */}
        <Sidebar activeNav={activeNav} onNavSelect={onNavSelect} />

        {/* 
          Requirement 1: Main Content Container
          The main content container must use `flex-1 min-w-0 flex flex-col` 
          so that data-dense children (such as TanStack Table or charts) 
          automatically resize and expand without horizontal layout breaking or clipping.
        */}
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
          {/* Sticky Header Bar */}
          <Header onSearchClick={() => setIsSearchModalOpen(true)} />

          {/* Scrollable Main Viewport */}
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>

      {/* Ctrl+K Quick Search Command Dialog */}
      {isSearchModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-surface-lowest/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setIsSearchModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-surface-container-low border border-outline-variant/60 shadow-2xl p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/40">
              <span className="text-on-surface-variant font-mono">⌘</span>
              <input
                type="text"
                autoFocus
                placeholder="Type member name, RFID, trainer, or command..."
                className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 text-[10px] text-outline bg-surface-container-high rounded border border-outline-variant/40">
                ESC
              </kbd>
            </div>

            <div className="flex flex-col gap-1 text-xs text-on-surface-variant max-h-64 overflow-y-auto pt-1">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-outline">Quick Jump</div>
              <button
                type="button"
                onClick={() => {
                  onNavSelect('bento');
                  setIsSearchModalOpen(false);
                }}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-container hover:text-on-surface text-left"
              >
                <span>Live Membership & Access Pulse (Bento Hub)</span>
                <span className="text-primary font-mono text-[10px]">Jump →</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavSelect('operations');
                  setIsSearchModalOpen(false);
                }}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-container hover:text-on-surface text-left"
              >
                <span>Active Member Directory & Turnstile Feed</span>
                <span className="text-primary font-mono text-[10px]">Jump →</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavSelect('compliance');
                  setIsSearchModalOpen(false);
                }}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-container hover:text-on-surface text-left"
              >
                <span>Platform Admin Verification & Compliance</span>
                <span className="text-primary font-mono text-[10px]">Jump →</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavSelect('gallery');
                  setIsSearchModalOpen(false);
                }}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-container hover:text-on-surface text-left"
              >
                <span>Stitch Designs & Generated Code Gallery</span>
                <span className="text-primary font-mono text-[10px]">Jump →</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
