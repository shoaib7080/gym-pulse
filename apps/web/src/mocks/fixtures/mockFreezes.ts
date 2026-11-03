/**
 * Realistic freezes fixture for Explorer Preview Mode
 * Matches GET /v1/freezes contract:
 * 2 pending freeze requests with mock proof URLs and 3 active freezes
 */

export const mockFreezes = [
  // 2 Pending freeze requests with proof URLs
  {
    id: "frz-exp-pending-01",
    gymId: "gym-preview-01",
    membershipId: "ms-exp-002",
    startDate: "2026-11-05",
    endDate: "2026-11-25",
    status: "pending_review",
    reasonCode: "medical",
    reasonNote: "Minor sports rehabilitation procedure with required rest period",
    proofStorageKey: "gyms/gym-preview-01/freezes/frz-exp-pending-01/medical-cert-dubai-health.pdf",
    proofUrl: "https://storage.gympulse.ae/mock/medical-cert-dubai-health.pdf",
    rejectionReason: null,
    createdAt: "2026-10-30T10:00:00Z",
    updatedAt: "2026-10-30T10:00:00Z",
    member: {
      fullName: "Sarah Jenkins",
      memberNumber: "MEM-0002",
      phone: "+971 52 345 6789",
    },
    membership: {
      planName: "All-Access 6-Month",
      startDate: "2026-06-01",
      endDate: "2026-11-30",
    },
  },
  {
    id: "frz-exp-pending-02",
    gymId: "gym-preview-01",
    membershipId: "ms-exp-006",
    startDate: "2026-11-10",
    endDate: "2026-11-30",
    status: "pending_review",
    reasonCode: "travel",
    reasonNote: "Overseas project assignment with airline ticket documentation",
    proofStorageKey: "gyms/gym-preview-01/freezes/frz-exp-pending-02/emirates-flight-itinerary.pdf",
    proofUrl: "https://storage.gympulse.ae/mock/emirates-flight-itinerary.pdf",
    rejectionReason: null,
    createdAt: "2026-10-31T14:30:00Z",
    updatedAt: "2026-10-31T14:30:00Z",
    member: {
      fullName: "Layla Nasser",
      memberNumber: "MEM-0006",
      phone: "+971 52 789 0123",
    },
    membership: {
      planName: "Monthly Standard Pass",
      startDate: "2026-10-15",
      endDate: "2026-11-14",
    },
  },

  // 3 Active freezes
  {
    id: "frz-exp-active-01",
    gymId: "gym-preview-01",
    membershipId: "ms-exp-003",
    startDate: "2026-10-15",
    endDate: "2026-11-14",
    status: "active",
    reasonCode: "relocation",
    reasonNote: "Temporary temporary assignment to Abu Dhabi office",
    proofStorageKey: "gyms/gym-preview-01/freezes/frz-exp-active-01/transfer-letter.pdf",
    proofUrl: "https://storage.gympulse.ae/mock/transfer-letter.pdf",
    rejectionReason: null,
    createdAt: "2026-10-14T09:00:00Z",
    updatedAt: "2026-10-14T11:00:00Z",
    member: {
      fullName: "Tariq Mansoor",
      memberNumber: "MEM-0003",
      phone: "+971 55 456 7890",
    },
    membership: {
      planName: "Annual All-Access",
      startDate: "2026-02-01",
      endDate: "2027-02-14",
    },
  },
  {
    id: "frz-exp-active-02",
    gymId: "gym-preview-01",
    membershipId: "ms-exp-004",
    startDate: "2026-10-20",
    endDate: "2026-11-19",
    status: "active",
    reasonCode: "medical",
    reasonNote: "Orthopedic recovery following ankle sprain",
    proofStorageKey: "gyms/gym-preview-01/freezes/frz-exp-active-02/clinic-certificate.pdf",
    proofUrl: "https://storage.gympulse.ae/mock/clinic-certificate.pdf",
    rejectionReason: null,
    createdAt: "2026-10-19T13:20:00Z",
    updatedAt: "2026-10-19T16:00:00Z",
    member: {
      fullName: "Elena Rostova",
      memberNumber: "MEM-0004",
      phone: "+971 56 567 8901",
    },
    membership: {
      planName: "Quarterly Flex Pass",
      startDate: "2026-08-15",
      endDate: "2026-12-05",
    },
  },
  {
    id: "frz-exp-active-03",
    gymId: "gym-preview-01",
    membershipId: "ms-exp-005",
    startDate: "2026-10-01",
    endDate: "2026-11-01",
    status: "active",
    reasonCode: "travel",
    reasonNote: "Extended annual leave abroad",
    proofStorageKey: "gyms/gym-preview-01/freezes/frz-exp-active-03/travel-confirmation.pdf",
    proofUrl: "https://storage.gympulse.ae/mock/travel-confirmation.pdf",
    rejectionReason: null,
    createdAt: "2026-09-28T08:15:00Z",
    updatedAt: "2026-09-29T10:00:00Z",
    member: {
      fullName: "Sultan Al-Nuaimi",
      memberNumber: "MEM-0005",
      phone: "+971 50 678 9012",
    },
    membership: {
      planName: "Annual All-Access",
      startDate: "2026-03-01",
      endDate: "2027-03-20",
    },
  },
];

export const mockFreezesResponse = {
  items: mockFreezes,
  total: mockFreezes.length,
};
