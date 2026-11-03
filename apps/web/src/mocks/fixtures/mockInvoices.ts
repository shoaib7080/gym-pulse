/**
 * Realistic VAT invoices fixture for Explorer Preview Mode
 * Matches GET /v1/payments/invoices contract:
 * Sequential VAT invoices (INV-2026-00041, etc.) with 5% UAE VAT integer fils math.
 */

export const mockInvoices = [
  {
    id: "inv-sbx-0001",
    gymId: "gym-preview-01",
    paymentId: "pay-sbx-0001",
    docType: "receipt",
    series: "SBX",
    number: 1,
    invoiceNumber: "SBX-2026-00001",
    issuedOn: "2026-11-01T10:15:00Z",
    currency: "AED",
    createdAt: "2026-11-01T10:15:00Z",
    isSandbox: true,
    watermark: "SANDBOX DEMO - NOT A TAX INVOICE",
    supplier: {
      name: "Iron Oasis Fitness LLC (Sandbox Demo)",
      trn: "100987654300003",
      street: "Sheikh Zayed Road, Al Quoz 3",
      city: "Dubai",
      emirate: "Dubai",
      country: "United Arab Emirates",
      isSandbox: true,
    },
    buyer: {
      name: "Zaid Al-Habtoor",
      phone: "+971 50 889 0012",
      email: "zaid.h@habtoor.ae",
    },
    lineItems: [
      {
        description: "Sandbox Demo Plan (30 Days Unlimited)",
        quantity: 1,
        unitPriceMinor: 71429,
        totalMinor: 71429,
        vatRatePercent: 5,
        vatMinor: 3571,
      },
    ],
    totals: {
      baseMinor: 71429, // 714.29 AED
      vatMinor: 3571,   // 35.71 AED (5%)
      totalMinor: 75000, // 750.00 AED total
      isSandbox: true,
      watermark: "SANDBOX DEMO - NOT A TAX INVOICE",
    },
    payment: {
      id: "pay-sbx-0001",
      method: "pos_card",
      status: "succeeded",
      cardBrand: "visa",
      cardLast4: "4242",
    },
  },
  {
    id: "inv-exp-0041",
    gymId: "gym-preview-01",
    paymentId: "pay-exp-0041",
    docType: "tax_invoice",
    series: "INV",
    number: 41,
    invoiceNumber: "INV-2026-00041",
    issuedOn: "2026-10-31T14:22:10Z",
    currency: "AED",
    createdAt: "2026-10-31T14:22:10Z",
    supplier: {
      name: "Iron Oasis Fitness LLC",
      trn: "100987654300003",
      street: "Sheikh Zayed Road, Al Quoz 3",
      city: "Dubai",
      emirate: "Dubai",
      country: "United Arab Emirates",
    },
    buyer: {
      name: "Sarah Jenkins",
      phone: "+971 52 345 6789",
      email: "sarah.j@dubaimedia.ae",
    },
    lineItems: [
      {
        description: "All-Access 6-Month Membership Pass",
        quantity: 1,
        unitPriceMinor: 285714,
        totalMinor: 285714,
        vatRatePercent: 5,
        vatMinor: 14286,
      },
    ],
    totals: {
      baseMinor: 285714, // 2,857.14 AED
      vatMinor: 14286,   // 142.86 AED (5%)
      totalMinor: 300000, // 3,000.00 AED total
    },
    payment: {
      id: "pay-exp-0041",
      method: "pos_card",
      status: "succeeded",
      cardBrand: "visa",
      cardLast4: "8821",
    },
  },
  {
    id: "inv-exp-0040",
    gymId: "gym-preview-01",
    paymentId: "pay-exp-0040",
    docType: "tax_invoice",
    series: "INV",
    number: 40,
    invoiceNumber: "INV-2026-00040",
    issuedOn: "2026-10-30T11:15:00Z",
    currency: "AED",
    createdAt: "2026-10-30T11:15:00Z",
    supplier: {
      name: "Iron Oasis Fitness LLC",
      trn: "100987654300003",
      street: "Sheikh Zayed Road, Al Quoz 3",
      city: "Dubai",
      emirate: "Dubai",
      country: "United Arab Emirates",
    },
    buyer: {
      name: "Rashid Al-Maktoum",
      phone: "+971 50 234 5678",
      email: "rashid.m@oasisfitness.ae",
    },
    lineItems: [
      {
        description: "Platinum Annual VIP Full-Access",
        quantity: 1,
        unitPriceMinor: 476190,
        totalMinor: 476190,
        vatRatePercent: 5,
        vatMinor: 23810,
      },
    ],
    totals: {
      baseMinor: 476190, // 4,761.90 AED
      vatMinor: 23810,   // 238.10 AED (5%)
      totalMinor: 500000, // 5,000.00 AED total
    },
    payment: {
      id: "pay-exp-0040",
      method: "payment_link",
      status: "succeeded",
      cardBrand: "mastercard",
      cardLast4: "4012",
    },
  },
  {
    id: "inv-exp-0039",
    gymId: "gym-preview-01",
    paymentId: "pay-exp-0039",
    docType: "tax_invoice",
    series: "INV",
    number: 39,
    invoiceNumber: "INV-2026-00039",
    issuedOn: "2026-10-29T16:45:22Z",
    currency: "AED",
    createdAt: "2026-10-29T16:45:22Z",
    supplier: {
      name: "Iron Oasis Fitness LLC",
      trn: "100987654300003",
      street: "Sheikh Zayed Road, Al Quoz 3",
      city: "Dubai",
      emirate: "Dubai",
      country: "United Arab Emirates",
    },
    buyer: {
      name: "Tariq Mansoor",
      phone: "+971 55 456 7890",
      email: "tariq.mansoor@techhub.ae",
    },
    lineItems: [
      {
        description: "Personal Training 10-Session Block",
        quantity: 1,
        unitPriceMinor: 190476,
        totalMinor: 190476,
        vatRatePercent: 5,
        vatMinor: 9524,
      },
    ],
    totals: {
      baseMinor: 190476, // 1,904.76 AED
      vatMinor: 9524,    // 95.24 AED (5%)
      totalMinor: 200000, // 2,000.00 AED total
    },
    payment: {
      id: "pay-exp-0039",
      method: "cash",
      status: "succeeded",
    },
  },
  {
    id: "inv-exp-0038",
    gymId: "gym-preview-01",
    paymentId: "pay-exp-0038",
    docType: "tax_invoice",
    series: "INV",
    number: 38,
    invoiceNumber: "INV-2026-00038",
    issuedOn: "2026-10-28T09:30:00Z",
    currency: "AED",
    createdAt: "2026-10-28T09:30:00Z",
    supplier: {
      name: "Iron Oasis Fitness LLC",
      trn: "100987654300003",
      street: "Sheikh Zayed Road, Al Quoz 3",
      city: "Dubai",
      emirate: "Dubai",
      country: "United Arab Emirates",
    },
    buyer: {
      name: "Layla Nasser",
      phone: "+971 52 789 0123",
      email: "layla.nasser@designstudio.ae",
    },
    lineItems: [
      {
        description: "Monthly Standard Pass",
        quantity: 1,
        unitPriceMinor: 47619,
        totalMinor: 47619,
        vatRatePercent: 5,
        vatMinor: 2381,
      },
    ],
    totals: {
      baseMinor: 47619, // 476.19 AED
      vatMinor: 2381,   // 23.81 AED (5%)
      totalMinor: 50000, // 500.00 AED total
    },
    payment: {
      id: "pay-exp-0038",
      method: "pos_card",
      status: "succeeded",
      cardBrand: "apple_pay",
      cardLast4: "1923",
    },
  },
  {
    id: "inv-exp-0037",
    gymId: "gym-preview-01",
    paymentId: "pay-exp-0037",
    docType: "credit_note",
    series: "CN",
    number: 2,
    invoiceNumber: "CN-2026-00002",
    issuedOn: "2026-10-27T18:10:00Z",
    currency: "AED",
    createdAt: "2026-10-27T18:10:00Z",
    supplier: {
      name: "Iron Oasis Fitness LLC",
      trn: "100987654300003",
      street: "Sheikh Zayed Road, Al Quoz 3",
      city: "Dubai",
      emirate: "Dubai",
      country: "United Arab Emirates",
    },
    buyer: {
      name: "Omar Al-Qasimi",
      phone: "+971 55 012 3456",
      email: "omar.qasimi@realestate.ae",
    },
    lineItems: [
      {
        description: "Credit Note - Voided Duplicate Registration",
        quantity: 1,
        unitPriceMinor: -47619,
        totalMinor: -47619,
        vatRatePercent: 5,
        vatMinor: -2381,
      },
    ],
    totals: {
      baseMinor: -47619,
      vatMinor: -2381,
      totalMinor: -50000,
    },
    payment: {
      id: "pay-exp-0037",
      method: "pos_card",
      status: "voided",
    },
  },
];
