export const RECIPIENTS = ["Mummy", "Papa", "Brother"] as const;
export type Recipient = (typeof RECIPIENTS)[number];

export const RECIPIENT_META: Record<
  Recipient,
  { label: string; color: string; soft: string; text: string; ring: string }
> = {
  Mummy: { label: "Mummy", color: "#e11d74", soft: "bg-pink-50", text: "text-pink-700", ring: "ring-pink-200" },
  Papa: { label: "Papa", color: "#2563eb", soft: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  Brother: { label: "Brother", color: "#d97706", soft: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;
export const MAX_AMOUNT = 1_000_000_000; // ₹100 crore – sanity limit

export const LIMITS = {
  description: 200,
  reason: 200,
  notes: 500,
} as const;
