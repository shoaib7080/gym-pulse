/**
 * Index barrel for mock fixtures
 */
export * from "./mockMetrics";
export * from "./mockMembers";
export * from "./mockShifts";
export * from "./mockFreezes";
export * from "./mockInvoices";

export const mockBranches = [
  {
    id: "br-preview-01",
    gymId: "gym-preview-01",
    name: "Downtown Flagship",
    code: "DXB-01",
    address: {
      street: "Sheikh Zayed Road, Al Quoz 3",
      city: "Dubai",
      emirate: "Dubai",
      country: "United Arab Emirates",
    },
    isMain: true,
    isActive: true,
    capacity: 250,
  },
  {
    id: "br-preview-02",
    gymId: "gym-preview-01",
    name: "Dubai Marina Bay",
    code: "DXB-02",
    address: {
      street: "Marina Promenade, Tower B",
      city: "Dubai",
      emirate: "Dubai",
      country: "United Arab Emirates",
    },
    isMain: false,
    isActive: true,
    capacity: 180,
  },
];

export const mockPlans = [
  {
    id: "plan-preview-01",
    name: "Platinum Annual VIP",
    code: "VIP-ANNUAL",
    priceMinor: 500000, // 5,000.00 AED
    intervalUnit: "year",
    intervalCount: 1,
    freezeDaysAllowed: 60,
    isActive: true,
    currency: "AED",
    description: "Unlimited gym floor, premium wet spa, sauna, and towel service across all branches.",
  },
  {
    id: "plan-preview-02",
    name: "All-Access 6-Month",
    code: "ALL-6M",
    priceMinor: 300000, // 3,000.00 AED
    intervalUnit: "month",
    intervalCount: 6,
    freezeDaysAllowed: 30,
    isActive: true,
    currency: "AED",
    description: "Full peak and off-peak turnstile access to all facility amenities.",
  },
  {
    id: "plan-preview-03",
    name: "Quarterly Flex Pass",
    code: "FLEX-3M",
    priceMinor: 160000, // 1,600.00 AED
    intervalUnit: "month",
    intervalCount: 3,
    freezeDaysAllowed: 14,
    isActive: true,
    currency: "AED",
    description: "Quarterly access with flexibility for business travelers and seasonal residents.",
  },
  {
    id: "plan-preview-04",
    name: "Monthly Standard Pass",
    code: "STD-1M",
    priceMinor: 50000, // 500.00 AED
    intervalUnit: "month",
    intervalCount: 1,
    freezeDaysAllowed: 0,
    isActive: true,
    currency: "AED",
    description: "Standard monthly access without long-term commitment.",
  },
];

export const mockGymProfile = {
  id: "gym-preview-01",
  tradeName: "Iron Oasis Fitness",
  legalName: "Iron Oasis Fitness LLC",
  tradeLicenseNumber: "DXB-987654-2026",
  status: "pending_verification",
  vatRegistered: true,
  trnNumber: "100987654300003",
  currency: "AED",
  timezone: "Asia/Dubai",
  branches: mockBranches,
};

export const mockStaff = [
  {
    id: "staff-exp-01",
    gymId: "gym-preview-01",
    userId: "usr-preview-owner",
    role: "owner",
    branchScope: "all",
    isActive: true,
    createdAt: "2026-08-01T09:00:00Z",
    lastLoginAt: "2026-11-01T08:30:00Z",
    user: {
      id: "usr-preview-owner",
      fullName: "Rashid Al-Maktoum",
      email: "rashid.owner@oasisfitness.ae",
      phone: "+971 50 123 4567",
      status: "active",
    },
    assignedBranches: [
      { id: "br-preview-01", name: "Downtown Flagship" },
      { id: "br-preview-02", name: "Dubai Marina Bay" },
    ],
  },
  {
    id: "staff-exp-02",
    gymId: "gym-preview-01",
    userId: "usr-preview-mgr",
    role: "staff",
    branchScope: "all",
    isActive: true,
    createdAt: "2026-08-15T10:30:00Z",
    lastLoginAt: "2026-11-01T07:15:00Z",
    user: {
      id: "usr-preview-mgr",
      fullName: "David Sterling",
      email: "david.m@oasisfitness.ae",
      phone: "+971 52 987 6543",
      status: "active",
    },
    assignedBranches: [
      { id: "br-preview-01", name: "Downtown Flagship" },
      { id: "br-preview-02", name: "Dubai Marina Bay" },
    ],
  },
  {
    id: "staff-exp-03",
    gymId: "gym-preview-01",
    userId: "usr-preview-desk",
    role: "staff",
    branchScope: "selected",
    isActive: true,
    createdAt: "2026-09-01T11:00:00Z",
    lastLoginAt: "2026-10-31T18:45:00Z",
    user: {
      id: "usr-preview-desk",
      fullName: "Amina Al-Falasi",
      email: "amina.f@oasisfitness.ae",
      phone: "+971 55 555 1234",
      status: "active",
    },
    assignedBranches: [
      { id: "br-preview-01", name: "Downtown Flagship" },
    ],
  },
  {
    id: "staff-exp-04",
    gymId: "gym-preview-01",
    userId: "usr-preview-inactive",
    role: "staff",
    branchScope: "selected",
    isActive: false,
    createdAt: "2026-09-10T14:00:00Z",
    lastLoginAt: "2026-10-15T11:20:00Z",
    user: {
      id: "usr-preview-inactive",
      fullName: "Zayd Mansoor",
      email: "zayd.m@oasisfitness.ae",
      phone: "+971 56 444 7890",
      status: "disabled",
    },
    assignedBranches: [
      { id: "br-preview-02", name: "Dubai Marina Bay" },
    ],
  },
];

export const mockGymDocuments = [
  {
    id: "doc-exp-01",
    gymId: "gym-preview-01",
    docType: "trade_license",
    fileName: "DED-Trade-License-2026.pdf",
    storageKey: "gyms/gym-preview-01/documents/trade-license.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1420500,
    createdAt: "2026-10-15T09:00:00Z",
  },
  {
    id: "doc-exp-02",
    gymId: "gym-preview-01",
    docType: "trn_certificate",
    fileName: "FTA-VAT-Tax-Registration-Certificate.pdf",
    storageKey: "gyms/gym-preview-01/documents/trn-certificate.pdf",
    mimeType: "application/pdf",
    sizeBytes: 890200,
    createdAt: "2026-10-16T11:30:00Z",
  },
];

export const mockSubscriptionPlans = [
  {
    id: "plan-saas-growth",
    code: "growth",
    name: "Growth Tier",
    billingInterval: "month",
    priceMinor: 39900, // 399.00 AED
    currency: "AED",
    limits: { maxBranches: 3, maxMembers: 100, maxStaff: 10 },
    description: "Designed for independent gym clubs and boutique studios expanding operations.",
    features: [
      "Up to 3 Facility Branches",
      "Up to 100 Active Members",
      "10 Authorized Staff Accounts",
      "Software Desk QR & Card Scanning",
      "Shift Cash Drawer Reconciliations",
      "Bilingual SMS OTP & WhatsApp Notifications",
    ],
  },
  {
    id: "plan-saas-pro",
    code: "pro",
    name: "Pro Tier",
    billingInterval: "month",
    priceMinor: 79900, // 799.00 AED
    currency: "AED",
    limits: { maxBranches: 5, maxMembers: 200, maxStaff: 25 },
    isPopular: true,
    description: "The complete operating system for high-volume, multi-branch fitness chains.",
    features: [
      "Up to 5 Facility Branches",
      "Up to 200 Active Members",
      "25 Authorized Staff Accounts",
      "Everything in Growth Tier",
      "Policy-Controlled Freeze Engine",
      "Tamper-Evident SHA-256 Audit Trail",
      "Per-Manager PIN Step-Up Verification",
      "Multi-Branch Member Roaming",
    ],
  },
  {
    id: "plan-saas-enterprise",
    code: "enterprise",
    name: "Enterprise Tier",
    billingInterval: "month",
    priceMinor: 149900, // 1,499.00 AED
    currency: "AED",
    limits: { maxBranches: 99, maxMembers: 999999, maxStaff: 999 },
    description: "Dedicated cloud infrastructure and custom SLAs for enterprise fitness franchises.",
    features: [
      "Unlimited Facility Branches",
      "Unlimited Active Members",
      "Unlimited Staff Accounts",
      "Everything in Pro Tier",
      "Priority 99.9% SLA & 24/7 Dedicated Support",
      "Turnstile Hardware Biometric Bridge Integration",
      "Custom UAE VAT & Multi-Currency Settlement",
    ],
  },
];

export const mockGymSubscription = {
  hasActiveSubscription: true,
  isRestricted: false,
  isSuspended: false,
  subscription: {
    id: "sub-saas-preview-01",
    gymId: "gym-preview-01",
    saasPlanId: "plan-saas-growth",
    status: "active",
    periodStart: "2026-10-01",
    periodEnd: "2026-12-01",
    billingMethod: "card",
  },
  plan: mockSubscriptionPlans[0],
  usage: {
    activeMembers: 84,
    activeBranches: 2,
  },
  limits: {
    maxBranches: 3,
    maxMembers: 100,
    maxStaff: 10,
  },
  unsubscribedCap: 10,
};

export const mockPlatformInvoices = [
  {
    id: "pinv-000104",
    invoiceNumber: "GP-INV-000104",
    issuedOn: "2026-10-01",
    dueOn: "2026-10-15",
    docType: "tax_invoice",
    lines: [
      {
        description: "GymPulse SaaS Platform Subscription - Growth Tier (Monthly)",
        quantity: 1,
        unitPriceMinor: 39900,
        vatRatePercent: 5,
        vatMinor: 1995,
        totalMinor: 41895,
      },
    ],
    totals: {
      subtotalMinor: 39900,
      vatMinor: 1995,
      grandTotalMinor: 41895,
      currency: "AED",
    },
    isPaid: true,
    totalPaidMinor: 41895,
    balanceDueMinor: 0,
  },
  {
    id: "pinv-000105",
    invoiceNumber: "GP-INV-000105",
    issuedOn: "2026-11-01",
    dueOn: "2026-11-15",
    docType: "tax_invoice",
    lines: [
      {
        description: "GymPulse SaaS Platform Subscription Renewal - Growth Tier (Monthly)",
        quantity: 1,
        unitPriceMinor: 39900,
        vatRatePercent: 5,
        vatMinor: 1995,
        totalMinor: 41895,
      },
    ],
    totals: {
      subtotalMinor: 39900,
      vatMinor: 1995,
      grandTotalMinor: 41895,
      currency: "AED",
    },
    isPaid: false,
    totalPaidMinor: 0,
    balanceDueMinor: 41895,
  },
];

