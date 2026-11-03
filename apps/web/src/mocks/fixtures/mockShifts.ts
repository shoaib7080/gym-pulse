/**
 * Realistic shifts fixture for Explorer Preview Mode
 * Matches GET /v1/shifts/current and GET /v1/shifts contracts:
 * Active shift with opening cash float AED 450.00 (45,000 fils)
 */

export const mockCurrentShift = {
  id: "shift-exp-active-01",
  gymId: "gym-preview-01",
  branchId: "br-preview-01",
  openedBy: "usr-preview-owner",
  openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // Opened 4 hours ago
  closedBy: null,
  closedAt: null,
  status: "open",
  openingFloatMinor: 45000, // 450.00 AED
  openingCashMinor: 45000,
  expectedCashMinor: 195000, // 450 float + 1,500 cash sales = 1,950.00 AED
  actualCashMinor: null,
  cashSalesMinor: 150000, // 1,500.00 AED
  varianceMinor: null,
  varianceReason: null,
  isVarianceApproved: false,
  currency: "AED",
  branchName: "Downtown Flagship",
  openedByName: "Rashid (Duty Manager)",
};

export const mockPastShifts = [
  mockCurrentShift,
  {
    id: "shift-exp-closed-01",
    gymId: "gym-preview-01",
    branchId: "br-preview-01",
    openedBy: "usr-preview-owner",
    openedAt: "2026-10-31T06:00:00Z",
    closedBy: "usr-preview-owner",
    closedAt: "2026-10-31T15:30:00Z",
    status: "closed",
    openingFloatMinor: 45000,
    openingCashMinor: 45000,
    expectedCashMinor: 265000,
    actualCashMinor: 265000,
    cashSalesMinor: 220000,
    varianceMinor: 0,
    varianceReason: "Perfect closeout drawer match",
    isVarianceApproved: true,
    currency: "AED",
    branchName: "Downtown Flagship",
    openedByName: "Rashid (Duty Manager)",
  },
  {
    id: "shift-exp-closed-02",
    gymId: "gym-preview-01",
    branchId: "br-preview-01",
    openedBy: "usr-preview-owner",
    openedAt: "2026-10-30T06:00:00Z",
    closedBy: "usr-preview-owner",
    closedAt: "2026-10-30T16:00:00Z",
    status: "closed",
    openingFloatMinor: 45000,
    openingCashMinor: 45000,
    expectedCashMinor: 185000,
    actualCashMinor: 185000,
    cashSalesMinor: 140000,
    varianceMinor: 0,
    varianceReason: "Balanced drawer",
    isVarianceApproved: true,
    currency: "AED",
    branchName: "Downtown Flagship",
    openedByName: "Rashid (Duty Manager)",
  },
  {
    id: "shift-exp-closed-03",
    gymId: "gym-preview-01",
    branchId: "br-preview-01",
    openedBy: "usr-preview-owner",
    openedAt: "2026-10-29T06:00:00Z",
    closedBy: "usr-preview-owner",
    closedAt: "2026-10-29T15:00:00Z",
    status: "closed",
    openingFloatMinor: 45000,
    openingCashMinor: 45000,
    expectedCashMinor: 310000,
    actualCashMinor: 310000,
    cashSalesMinor: 265000,
    varianceMinor: 0,
    varianceReason: "Normal weekend closing",
    isVarianceApproved: true,
    currency: "AED",
    branchName: "Downtown Flagship",
    openedByName: "Rashid (Duty Manager)",
  },
];
