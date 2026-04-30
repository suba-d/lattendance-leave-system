import { differenceInCalendarDays } from "date-fns";

// Taiwan Labor Standards Act (勞基法) Article 38 — annual leave entitlement
// based on continuous service. Returned in DAYS; convert to hours by * 8.
//
// The statute reads:
//   6 months ≤ tenure < 1 year   →  3 days
//   1 year   ≤ tenure < 2 years  →  7 days
//   2 years  ≤ tenure < 3 years  → 10 days
//   3 years  ≤ tenure < 5 years  → 14 days
//   5 years  ≤ tenure < 10 years → 15 days
//   10+ years                    → +1 day per year, capped at 30 days
export function annualLeaveDaysForTenure(tenureYears: number): number {
  if (tenureYears < 0.5) return 0;
  if (tenureYears < 1) return 3;
  if (tenureYears < 2) return 7;
  if (tenureYears < 3) return 10;
  if (tenureYears < 5) return 14;
  if (tenureYears < 10) return 15;
  // 10y+: 15 + (years - 10 + 1) capped at 30. Year 10 → 16, year 24+ → 30.
  return Math.min(30, 15 + (Math.floor(tenureYears) - 10 + 1));
}

// Tenure in fractional years between hireDate and asOf (inclusive of asOf).
export function tenureYearsAt(hireDate: Date, asOf: Date): number {
  const days = differenceInCalendarDays(asOf, hireDate);
  return days / 365.25;
}

// Convenience: how many annual leave HOURS a user is entitled to "as of" a
// given date. 1 day = 8 hours.
export function annualLeaveHoursAsOf(hireDate: Date, asOf: Date): number {
  const tenure = tenureYearsAt(hireDate, asOf);
  return annualLeaveDaysForTenure(tenure) * 8;
}
