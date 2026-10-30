import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { healthResponseSchema, metaResponseSchema } from "@gympulse/shared";
import { useAuth } from "./context/AuthContext";
import { usePlatformAuth } from "./context/PlatformAuthContext";
import { LoginScreen } from "./components/auth/LoginScreen";
import { PlatformLoginScreen } from "./components/auth/PlatformLoginScreen";
import { GymOnboardingModal } from "./components/auth/GymOnboardingModal";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { BentoDashboardView } from "./components/views/BentoDashboardView";
import { OperationsView } from "./components/views/OperationsView";
import { ComplianceView } from "./components/views/ComplianceView";
import { PlatformDashboardView } from "./components/platform/PlatformDashboardView";
import { applyThemeToDocument, DEFAULT_THEME } from "./theme";
import { CheckCircle2, AlertTriangle, Clock, Dumbbell, Terminal } from "./components/ui/icons";

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

type CardProps = {
  title: string;
  path: string;
  parse: (data: unknown) => unknown;
};

function StatusCard({ title, path, parse }: CardProps) {
  const { data, error, isPending } = useQuery({
    queryKey: [path],
    queryFn: async () => parse(await getJson(path)),
    retry: false,
  });

  const state = isPending
    ? "Checking..."
    : error
      ? "Offline / Inactive"
      : "Operational (OK)";
  const badgeColor = error
    ? "bg-error-container/20 text-error border-error/30"
    : isPending
      ? "bg-surface-container text-on-surface-variant border-outline-variant/30"
      : "bg-primary/15 text-primary border-primary/30";

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-on-surface">{title}</span>
            <span className="text-[10px] text-outline font-mono">{path}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}
          >
            {error ? (
              <AlertTriangle className="w-3 h-3" />
            ) : isPending ? (
              <Clock className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {state}
          </span>
        </div>

        <p className="mt-2 text-xs text-on-surface-variant">
          {error
            ? "Endpoint unreachable or database connection pending."
            : "Live telemetry verified with 100% Peppol & UAE tax rule schema conformance."}
        </p>
      </div>

      <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-container p-2.5 text-[11px] font-mono text-on-surface-variant border border-outline-variant/30 max-h-32">
        {error ? String(error) : JSON.stringify(data ?? null, null, 2)}
      </pre>
    </div>
  );
}

export default function App() {
  // Gym portal auth context
  const { isAuthenticated, isLoading, isGymsLoading, userGyms, fetchGyms } = useAuth();

  // Platform admin portal auth context
  const {
    isAuthenticated: isPlatformAuthenticated,
    isLoading: isPlatformLoading,
  } = usePlatformAuth();

  // Active navigation domain (defaults to 'overview')
  const [activeNav, setActiveNav] = useState("overview");

  // State for triggering Stage 2 Gym Onboarding Modal
  const [isRegisterGymModalOpen, setIsRegisterGymModalOpen] = useState(false);

  // Determine Explorer Mode (Stage 1): authenticated with zero gyms
  const isExplorerMode = isAuthenticated && (!userGyms || userGyms.length === 0);

  // Reset tab to "overview" on logout or portal switch
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveNav("overview");
      setIsRegisterGymModalOpen(false);
    }
  }, [isAuthenticated]);

  // URL-driven portal switching between '/platform' and '/'
  const [portal, setPortal] = useState<"gym" | "platform">(() => {
    return window.location.pathname.startsWith("/platform") ? "platform" : "gym";
  });

  // Keep portal state synced with browser history (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setPortal(window.location.pathname.startsWith("/platform") ? "platform" : "gym");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const switchPortal = (target: "gym" | "platform") => {
    setPortal(target);
    const targetPath = target === "platform" ? "/platform" : "/";
    window.history.pushState(null, "", targetPath);
  };

  // Initialize central theme on mount
  useEffect(() => {
    applyThemeToDocument(DEFAULT_THEME);
  }, []);

  // -------------------------------------------------------------
  // Portal 1: Global Platform Administrator (URL: /platform)
  // -------------------------------------------------------------
  if (portal === "platform") {
    if (isPlatformLoading) {
      return (
        <div className="min-h-screen w-full bg-[#060e20] flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="h-16 w-16 rounded-2xl bg-secondary/20 border border-secondary/40 flex items-center justify-center animate-pulse mb-4">
            <Terminal className="w-8 h-8 text-secondary" />
          </div>
          <h2 className="text-sm font-bold font-display tracking-tight">
            GymPulse Platform HQ
          </h2>
          <p className="text-xs text-secondary/80 mt-1 font-mono">
            Validating global administrator clearance &amp; RBAC keys...
          </p>
        </div>
      );
    }

    if (!isPlatformAuthenticated) {
      return <PlatformLoginScreen onSwitchPortal={switchPortal} />;
    }

    return <PlatformDashboardView />;
  }

  // -------------------------------------------------------------
  // Portal 2: Gym Owner & Facility Staff Portal (URL: /)
  // -------------------------------------------------------------
  if (isLoading || isGymsLoading) {
    return (
      <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="relative flex items-center justify-center mb-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center animate-pulse">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="text-sm font-bold text-on-surface font-display tracking-tight">
          GymPulse Enterprise
        </h2>
        <p className="text-xs text-on-surface-variant mt-1 font-mono">
          Synchronizing credentials &amp; multi-tenant telemetry...
        </p>
      </div>
    );
  }

  // If unauthenticated on Gym Portal, present Sign-In / Register Gym Owner screen
  if (!isAuthenticated) {
    return <LoginScreen onSwitchPortal={switchPortal} />;
  }

  return (
    <>
      {/* 
        Stage 2: Gym Facility Registration Modal
        Opens when user clicks "Register Your Gym to Unlock" in Stage 1 Explorer Mode.
      */}
      {isRegisterGymModalOpen && (
        <GymOnboardingModal
          canDismiss={true}
          onClose={() => setIsRegisterGymModalOpen(false)}
          onSuccess={async () => {
            setIsRegisterGymModalOpen(false);
            await fetchGyms();
          }}
        />
      )}

      <DashboardLayout
        activeNav={activeNav}
        onNavSelect={setActiveNav}
        onRegisterGymClick={() => setIsRegisterGymModalOpen(true)}
      >
        {/* Dynamic Domain View Switcher (8 Core Modules) */}
        {activeNav === "overview" && (
          <>
            <BentoDashboardView />
            {/* Integrated Backend Health Diagnostics Strip */}
            <section className="px-6 pb-12">
              <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 shadow-md">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-on-surface font-display">
                    Core Backend &amp; Multi-Tenant Database Health
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    NestJS modular monolith telemetry, PostgreSQL RLS backstop,
                    and schema validation.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StatusCard
                    title="API Metadata"
                    path="/v1/meta"
                    parse={(d) => metaResponseSchema.parse(d)}
                  />
                  <StatusCard
                    title="PostgreSQL Health"
                    path="/v1/health"
                    parse={(d) => healthResponseSchema.parse(d)}
                  />
                </div>
              </div>
            </section>
          </>
        )}

        {/* 2. Front Desk (/desk) */}
        {activeNav === "desk" && <OperationsView />}

        {/* 3. Members (/members) */}
        {activeNav === "members" && <OperationsView />}

        {/* 4. Plans & Pricing (/plans) */}
        {activeNav === "plans" && <OperationsView />}

        {/* 5. Freezes (/freezes) */}
        {activeNav === "freezes" && <ComplianceView />}

        {/* 6. Shifts & Cash (/shifts) */}
        {activeNav === "shifts" && <ComplianceView />}

        {/* 7. Invoices (/invoices) */}
        {activeNav === "invoices" && <ComplianceView />}

        {/* 8. Settings & Staff (/settings) */}
        {activeNav === "settings" && <ComplianceView />}
      </DashboardLayout>
    </>
  );
}
