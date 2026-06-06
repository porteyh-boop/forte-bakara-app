export type UserRole = "client" | "expert";

export type Status = "פעילה" | "בטיפול" | "מושבתת";

export type FaultStatus = Status | "טופלה";

export type FaultType =
  | "תקועה בין קומות"
  | "רעש חריג"
  | "דלת לא נסגרת"
  | "תאורה לא עובדת"
  | "כפתורים לא מגיבים"
  | "אחר";

export type FaultPriority = "דחופה" | "רגילה" | "נמוכה";

export type InsightSeverity = "גבוה" | "בינוני" | "נמוך";

export type TrendDirection = "שיפור" | "החמרה" | "יציב";

export interface Elevator {
  id: string;
  name: string;
  status: Status;
  floor?: string;
}

export interface Building {
  name: string;
  address: string;
  city: string;
  elevatorCount: number;
  elevatorCompany: string;
  contactPerson: string;
  phone: string;
  managementCompany: string;
  units: number;
}

export interface Fault {
  id: string;
  elevatorId: string;
  elevatorName: string;
  type: FaultType;
  description: string;
  status: FaultStatus;
  priority: FaultPriority;
  reportedAt: string;
  reportedBy?: string;
  resolvedAt?: string;
  downtimeHours?: number;
}

export interface ExpertInsight {
  id: string;
  text: string;
  severity: InsightSeverity;
  category: string;
}

export interface ExpertMetric {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
}

export interface FaultTypeBreakdown {
  type: FaultType;
  count: number;
  percentage: number;
}

export interface RecurringElevatorFault {
  elevatorId: string;
  elevatorName: string;
  faultCount: number;
  percentage: number;
  topTypes: { type: FaultType; count: number }[];
  isRecurring: boolean;
}

export interface RecurringTypeFault {
  type: FaultType;
  count: number;
  percentage: number;
  isRecurring: boolean;
  elevators: string[];
}

export interface ElevatorAvailability {
  elevatorId: string;
  elevatorName: string;
  availabilityPercent: number;
  downtimeHours: number;
  faultCount: number;
}

export interface ResponseTimeAnalysis {
  averageHours: number;
  targetHours: number;
  compliancePercent: number;
  trendPercent: number;
  trendDirection: TrendDirection;
  worstCase: string;
}

export interface DowntimeAnalysis {
  averageHours: number;
  totalHours: number;
  monthHours: number;
  trendPercent: number;
  trendDirection: TrendDirection;
  longestEvent: string;
}

export interface ServiceScoreBreakdown {
  label: string;
  score: number;
}

export interface ServiceCompanyRating {
  company: string;
  score: number;
  breakdown: ServiceScoreBreakdown[];
}

export interface ProblematicElevator {
  elevatorId: string;
  name: string;
  faultCount: number;
  percentage: number;
  downtimeHours: number;
  reason: string;
}

export interface InsufficientTreatmentAnalysis {
  company: string;
  suspiciousCases: number;
  detail: string;
}

export interface RiskAssessment {
  level: InsightSeverity;
  factors: string[];
  prediction: string;
}

export interface TrendAnalysis {
  direction: TrendDirection;
  faultCountChangePercent: number;
  downtimeChangePercent: number;
  description: string;
}

export interface AnomalyAlert {
  id: string;
  message: string;
  severity: InsightSeverity;
}

export interface ExpertAnalytics {
  insights: ExpertInsight[];
  metrics: ExpertMetric[];
  recurringByElevator: RecurringElevatorFault[];
  recurringByType: RecurringTypeFault[];
  faultTypeBreakdown: FaultTypeBreakdown[];
  failurePatterns: string[];
  problematicElevator: ProblematicElevator;
  insufficientTreatment: InsufficientTreatmentAnalysis;
  responseTime: ResponseTimeAnalysis;
  downtime: DowntimeAnalysis;
  elevatorAvailability: ElevatorAvailability[];
  serviceRating: ServiceCompanyRating;
  trend: TrendAnalysis;
  alerts: AnomalyAlert[];
  riskAssessment: RiskAssessment;
  actions: string[];
}
