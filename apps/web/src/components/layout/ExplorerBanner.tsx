import React from "react";
import { ArrowRight } from "../ui/icons";

interface ExplorerBannerProps {
  onRegisterClick: () => void;
}

/**
 * ExplorerBanner Component (Inside DashboardLayout)
 * Sleek top notification bar mounted directly below the global navbar whenever user.gym_id === null.
 * Non-distracting styling: Dark slate background #171A21, subtle border #242933, no glowing neon dots.
 * Solid #D4FF00 primary CTA: "Register Your Gym to Unlock".
 */
export function ExplorerBanner({ onRegisterClick }: ExplorerBannerProps) {
  return (
    <div
      role="region"
      aria-label="Explorer Mode Notification"
      className="w-full bg-[#171A21] border-b border-[#242933] px-6 py-2.5 flex items-center justify-between text-xs transition-colors shrink-0 z-30"
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-slate-300">
          You are exploring GymPulse with preview data.
        </span>
      </div>

      <button
        type="button"
        onClick={onRegisterClick}
        className="inline-flex items-center gap-1.5 bg-[#D4FF00] hover:bg-[#bfe600] text-black font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm cursor-pointer active:scale-95"
      >
        <span>Register Your Gym to Unlock</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
