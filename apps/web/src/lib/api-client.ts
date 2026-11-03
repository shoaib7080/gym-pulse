/**
 * API Client Interceptor & Mock Adapter (Pattern 2)
 *
 * When an unonboarded user registers with only Name, Email, Password (`user.gym_id === null`),
 * they land on Explorer Preview Mode:
 * 1. For GET endpoints: Intercepts before network dispatch and instantly resolves via
 *    pre-bundled realistic UAE mock fixtures (zero latency, zero spinners).
 * 2. For mutating endpoints (POST, PUT, PATCH, DELETE): Short-circuits and returns
 *    a standard 403 error containing:
 *    `{ code: 'EXPLORER_MODE_READ_ONLY', message: 'Register your gym to unlock live actions.' }`
 *    and dispatches a global window event `gympulse:open-register-modal` so the onboarding
 *    drawer cleanly opens without polluting pages with `isExplorer` conditionals.
 * 3. When `activeGymId` exists: Passes through transparently to the real NestJS API.
 */

import {
  mockRevenueReport,
  mockCheckInsReport,
  mockOccupancyReport,
  mockMembers,
  mockMembersResponse,
  mockCurrentShift,
  mockPastShifts,
  mockFreezes,
  mockFreezesResponse,
  mockInvoices,
  mockBranches,
  mockPlans,
  mockGymProfile,
  mockStaff,
  mockGymDocuments,
  mockSubscriptionPlans,
  mockGymSubscription,
  mockPlatformInvoices,
} from "../mocks/fixtures";

export const EXPLORER_EVENT_OPEN_REGISTER = "gympulse:open-register-modal";

export interface MockInterceptorContext {
  token: string | null;
  activeGymId: string | null;
}

/**
 * Dispatches global custom event to trigger RegisterGymModal slide-over drawer
 */
export function triggerRegisterGymDrawer() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(EXPLORER_EVENT_OPEN_REGISTER, {
        detail: {
          code: "EXPLORER_MODE_READ_ONLY",
          message: "Register your gym to unlock live actions.",
        },
      })
    );
  }
}

/**
 * Mock response helper creating a synthetic Fetch Response
 */
function createJsonResponse(data: unknown, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json",
      "x-gympulse-mock": "explorer-preview",
    },
  });
}

/**
 * Handle Explorer Preview Mode interceptor
 * Returns a Response if intercepted, or null if it should pass through to network.
 */
export function interceptExplorerRequest(
  path: string,
  options: RequestInit = {}
): Response | null {
  const method = (options.method || "GET").toUpperCase();
  const urlPath = path.split("?")[0]; // ignore query parameters for routing

  // Never intercept auth endpoints, public meta/health, or actual gym onboarding
  if (
    urlPath.startsWith("/v1/auth/") ||
    urlPath === "/v1/health" ||
    urlPath === "/v1/meta" ||
    (urlPath === "/v1/gyms" && method === "POST") ||
    (urlPath.startsWith("/v1/gyms/") && urlPath.endsWith("/onboard") && method === "POST")
  ) {
    return null;
  }

  // Intercept Mutating Endpoints (POST, PUT, PATCH, DELETE) in Explorer Mode
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    // Automatically trigger onboarding slide-over drawer
    triggerRegisterGymDrawer();

    return createJsonResponse(
      {
        code: "EXPLORER_MODE_READ_ONLY",
        message: "Register your gym to unlock live actions.",
      },
      403,
      "Forbidden"
    );
  }

  // Intercept GET endpoints with pre-bundled UAE mock fixtures
  if (method === "GET") {
    // 1. Revenue report
    if (urlPath === "/v1/reports/revenue") {
      return createJsonResponse(mockRevenueReport);
    }

    // 2. Check-ins report
    if (urlPath === "/v1/reports/checkins") {
      return createJsonResponse(mockCheckInsReport);
    }

    // 2b. Occupancy & live floor telemetry
    if (urlPath === "/v1/reports/occupancy") {
      return createJsonResponse(mockOccupancyReport);
    }

    // 3. Members list & single member
    if (urlPath === "/v1/members") {
      return createJsonResponse(mockMembersResponse);
    }
    if (urlPath.startsWith("/v1/members/")) {
      const memberId = urlPath.replace("/v1/members/", "");
      const found = mockMembers.find((m) => m.id === memberId) || mockMembers[0];
      return createJsonResponse(found);
    }

    // 4. Shifts
    if (urlPath === "/v1/shifts/current") {
      return createJsonResponse(mockCurrentShift);
    }
    if (urlPath === "/v1/shifts") {
      return createJsonResponse(mockPastShifts);
    }

    // 5. Freezes
    if (urlPath === "/v1/freezes") {
      return createJsonResponse(mockFreezesResponse);
    }
    if (urlPath.startsWith("/v1/freezes/")) {
      const freezeId = urlPath.replace("/v1/freezes/", "");
      const found = mockFreezes.find((f) => f.id === freezeId) || mockFreezes[0];
      return createJsonResponse(found);
    }

    // 6. Invoices
    if (urlPath === "/v1/payments/invoices" || urlPath === "/v1/invoices") {
      return createJsonResponse(mockInvoices);
    }
    if (urlPath.startsWith("/v1/invoices/") && urlPath.endsWith("/pdf")) {
      const invId = urlPath.replace("/v1/invoices/", "").replace("/pdf", "");
      const found = mockInvoices.find((i) => i.id === invId) || mockInvoices[0];
      return createJsonResponse({
        invoiceId: found.id,
        invoiceNumber: found.invoiceNumber,
        downloadUrl: `https://gympulse-storage.s3.me-central-1.amazonaws.com/invoices/${found.invoiceNumber}.pdf?mock=true`,
        fileName: `${found.invoiceNumber}.pdf`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
    }
    if (urlPath.startsWith("/v1/payments/invoices/") || urlPath.startsWith("/v1/invoices/")) {
      const invId = urlPath.split("/").pop();
      const found = mockInvoices.find((i) => i.id === invId) || mockInvoices[0];
      return createJsonResponse(found);
    }

    // 7. Branches
    if (urlPath === "/v1/branches") {
      return createJsonResponse(mockBranches);
    }

    // 8. Plans
    if (urlPath === "/v1/plans") {
      return createJsonResponse(mockPlans);
    }

    // 9. Current Gym details
    if (urlPath === "/v1/gyms/current" || urlPath === "/v1/gyms/profile") {
      return createJsonResponse(mockGymProfile);
    }

    // 10. Staff list
    if (urlPath === "/v1/gyms/staff") {
      return createJsonResponse(mockStaff);
    }

    // 11. Verification documents
    if (urlPath === "/v1/gyms/documents") {
      return createJsonResponse(mockGymDocuments);
    }

    // 12. SaaS Platform Subscription & Usage
    if (urlPath === "/v1/subscription") {
      return createJsonResponse(mockGymSubscription);
    }
    if (urlPath === "/v1/subscription/plans") {
      return createJsonResponse(mockSubscriptionPlans);
    }
    if (urlPath === "/v1/subscription/invoices") {
      return createJsonResponse(mockPlatformInvoices);
    }
  }

  return null;
}
