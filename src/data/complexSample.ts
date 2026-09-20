/* The "Load Complex Test JSON" sample.
 *
 * Sized to demonstrate the tool rather than stress it: deep enough to need
 * the tree and the Navigator, wide enough to make a readable graph, and well
 * under the Visualizer's truncation threshold so every node renders.
 *
 * It deliberately covers every shape the viewer has to handle — nesting six
 * levels down, arrays of objects, arrays of arrays, an empty array and an
 * empty object, null, booleans, integers, floats, negatives, exponents, a
 * number big enough to show precision, unicode, an escaped string, and a long
 * string that has to wrap. Brand-neutral, so it reads the same on every
 * domain this app is served from.
 */
export const complexSample = {
  meta: {
    requestId: "req_8f3a2c71-4b9d-4e15-9c02-7a1e6d5b8f34",
    generatedAt: "2026-09-20T08:14:22.481Z",
    apiVersion: "2026-04-01",
    latencyMs: 142.75,
    cached: false,
    region: "ap-south-1",
    deprecations: [],
    experiments: {},
  },
  pagination: {
    page: 1,
    perPage: 3,
    totalItems: 1847,
    totalPages: 616,
    hasNext: true,
    cursor: "eyJvZmZzZXQiOjMsInNvcnQiOiJjcmVhdGVkX2F0In0",
  },
  orders: [
    {
      id: "ord_10482",
      status: "fulfilled",
      placedAt: "2026-09-12T11:04:09Z",
      total: 18499.5,
      currency: "INR",
      priority: false,
      customer: {
        id: 4471,
        name: "Ananya Iyer",
        email: "ananya.iyer@example.com",
        vip: true,
        loyaltyPoints: 2840,
        address: {
          line1: "14, Brigade Road",
          line2: null,
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
          geo: {lat: 12.9716, lng: 77.5946, accuracyM: 12.4},
        },
      },
      items: [
        {
          sku: "KB-8741",
          name: "Mechanical keyboard, 75% layout",
          qty: 1,
          unitPrice: 12999,
          attributes: {switch: "tactile", backlight: true, layout: "ANSI"},
          discounts: [
            {code: "FESTIVE10", type: "percent", value: 10},
            {code: "LOYALTY", type: "flat", value: 500},
          ],
        },
        {
          sku: "CB-2219",
          name: "USB-C braided cable, 2m",
          qty: 2,
          unitPrice: 1299,
          attributes: {colour: "graphite", rated: "100W"},
          discounts: [],
        },
      ],
      payment: {
        method: "upi",
        captured: true,
        attempts: 1,
        reference: "UPI/2026/0912/44817",
        breakdown: {subtotal: 15597, tax: 2807.5, shipping: 95, refunded: 0},
      },
      timeline: [
        {at: "2026-09-12T11:04:09Z", event: "placed", actor: "customer"},
        {
          at: "2026-09-12T11:05:44Z",
          event: "payment_captured",
          actor: "system",
        },
        {at: "2026-09-13T06:30:12Z", event: "shipped", actor: "warehouse-blr"},
        {at: "2026-09-15T14:52:03Z", event: "delivered", actor: "courier"},
      ],
    },
    {
      id: "ord_10483",
      status: "in_transit",
      placedAt: "2026-09-18T19:41:55Z",
      total: 4299,
      currency: "INR",
      priority: true,
      customer: {
        id: 5120,
        name: "Rahul Mehta",
        email: "rahul.mehta@example.com",
        vip: false,
        loyaltyPoints: 310,
        address: {
          line1: "Flat 7B, Sea Breeze Apartments",
          line2: "Carter Road, Bandra West",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400050",
          country: "IN",
          geo: {lat: 19.0544, lng: 72.8201, accuracyM: 8.1},
        },
      },
      items: [
        {
          sku: "MS-3308",
          name: "Wireless mouse, ergonomic",
          qty: 1,
          unitPrice: 4299,
          attributes: {dpi: 16000, hand: "right", wireless: true},
          discounts: [],
        },
      ],
      payment: {
        method: "card",
        captured: true,
        attempts: 2,
        reference: "CARD/2026/0918/90233",
        breakdown: {subtotal: 3643, tax: 656, shipping: 0, refunded: 0},
      },
      timeline: [
        {at: "2026-09-18T19:41:55Z", event: "placed", actor: "customer"},
        {at: "2026-09-18T19:43:10Z", event: "payment_failed", actor: "gateway"},
        {
          at: "2026-09-18T19:44:02Z",
          event: "payment_captured",
          actor: "system",
        },
        {at: "2026-09-19T08:12:40Z", event: "shipped", actor: "warehouse-bom"},
      ],
    },
    {
      id: "ord_10484",
      status: "cancelled",
      placedAt: "2026-09-19T07:22:31Z",
      total: 0,
      currency: "INR",
      priority: false,
      customer: {
        id: 5121,
        name: "Priya Raghunathan",
        email: "priya.r@example.com",
        vip: false,
        loyaltyPoints: 0,
        address: {
          line1: "22/A, Mount Road",
          line2: null,
          city: "Chennai",
          state: "Tamil Nadu",
          postalCode: "600002",
          country: "IN",
          geo: {lat: 13.0604, lng: 80.2496, accuracyM: 21.9},
        },
      },
      items: [],
      payment: {
        method: null,
        captured: false,
        attempts: 0,
        reference: null,
        breakdown: {subtotal: 0, tax: 0, shipping: 0, refunded: 2499},
      },
      timeline: [
        {at: "2026-09-19T07:22:31Z", event: "placed", actor: "customer"},
        {at: "2026-09-19T07:26:48Z", event: "cancelled", actor: "customer"},
      ],
    },
  ],
  inventory: {
    "warehouse-blr": {
      city: "Bengaluru",
      online: true,
      capacityUsed: 0.7342,
      staff: 48,
      shelves: [["KB-8741", "CB-2219"], ["MS-3308"], []],
      restock: {
        nextRunAt: "2026-09-21T02:00:00Z",
        thresholds: {critical: 5, low: 25, healthy: 100},
      },
    },
    "warehouse-bom": {
      city: "Mumbai",
      online: true,
      capacityUsed: 0.9108,
      staff: 63,
      shelves: [["MS-3308", "CB-2219"]],
      restock: {
        nextRunAt: "2026-09-20T22:00:00Z",
        thresholds: {critical: 5, low: 25, healthy: 100},
      },
    },
    "warehouse-maa": {
      city: "Chennai",
      online: false,
      capacityUsed: 0,
      staff: 0,
      shelves: [],
      restock: null,
    },
  },
  analytics: {
    revenue: {
      today: 1284930.25,
      yesterday: 1190442.8,
      deltaPct: 7.94,
      sevenDayAvg: 1.20338e6,
      allTimePaise: 98217446300,
    },
    conversion: {visits: 48211, carts: 6034, checkouts: 2188, rate: 0.0454},
    topSearches: [
      "keyboard",
      "usb-c",
      "मैकेनिकल",
      "ergonomic mouse",
      "cable 2m",
    ],
    notes:
      'Figures are provisional until the nightly reconciliation job runs; the "deltaPct" field compares like-for-like hours only, so it reads low before 09:00 IST.',
    anomalies: [
      {metric: "refund_rate", zScore: -2.41, flagged: true, window: "24h"},
      {metric: "cart_abandonment", zScore: 0.88, flagged: false, window: "24h"},
    ],
  },
  featureFlags: {
    checkout: {
      oneClick: {enabled: true, rollout: {strategy: "percentage", value: 35}},
      upiAutopay: {
        enabled: false,
        rollout: {strategy: "allowlist", value: null},
      },
    },
    search: {
      semantic: {enabled: true, rollout: {strategy: "percentage", value: 100}},
    },
  },
};
