export const DEFAULT_ELEVATOR_COMPANIES = [
  "KONE",
  "שינדלר",
  "אלקטרה",
  "ישראליפט",
  "טיב מעליות",
  "נעמן מעליות",
  "כפיר מעליות",
  "משיק מעליות",
  "צום מעליות",
  "סטאר ליפט",
  "אחר",
] as const;

export type DefaultElevatorCompany = (typeof DEFAULT_ELEVATOR_COMPANIES)[number];

export function isOtherElevatorCompany(value: string): boolean {
  return value === "אחר";
}
