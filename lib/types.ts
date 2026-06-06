export type UserRole = "client" | "expert";

export type Status = "פעילה" | "בטיפול" | "מושבתת";

export type FaultStatus = Status | "פתוחה" | "סגורה" | "טופלה";

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
  /** מספר תחנות */
  stations: number;
  floor?: string;
}

export interface Building {
  buildingCode: string;
  name: string;
  address: string;
  city: string;
  elevatorCount: number;
  elevatorCompany: string;
  contactPerson: string;
  phone: string;
  managementCompany: string;
  units: number;
  /** שדות עתידיים — לא מוצגים כרגע בממשק */
  contractNumber?: string;
  serviceLevel?: string;
  serviceStartDate?: string;
  lastInspectionDate?: string;
}

export interface BuildingDataContext {
  id: string;
  building: Building;
  elevators: Elevator[];
  faults: Fault[];
  activeFaultDowntime: Record<string, number>;
}

export type BuildingStatusTone = "good" | "warning" | "alert";

export interface BuildingListItem {
  id: string;
  buildingCode: string;
  name: string;
  address: string;
  city: string;
  elevatorCount: number;
  faultCount: number;
  openFaultCount: number;
  closedFaultCount: number;
  disabledElevatorCount: number;
  buildingStatus: Status;
  statusLabel: string;
  statusTone: BuildingStatusTone;
}

export interface Fault {
  id: string;
  ticketNumber?: string;
  elevatorId: string;
  elevatorName: string;
  type: FaultType;
  description: string;
  status: FaultStatus;
  priority: FaultPriority;
  reportedAt: string;
  reportedBy?: string;
  resolvedAt?: string;
  /** משך זמן מפתיחה עד סגירה (שעות) */
  durationHours?: number;
  downtimeHours?: number;
  isUserSubmitted?: boolean;
  /** נשמר בדיווחי משתמש — האם המעלית מושבתת */
  isDisabled?: boolean;
  /** תמונה מצורפת לדיווח — נשמרת ב-localStorage כ-data URL */
  image?: {
    dataUrl: string;
    name: string;
    sizeBytes: number;
    mimeType: string;
  };
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

export type FeedbackSenderRole =
  | "ועד בית"
  | "חברת ניהול"
  | "אחזקה"
  | "דייר"
  | "אחר";

export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export type FeedbackYesMaybeNo = "כן" | "אולי" | "לא";

export interface PilotFeedback {
  id: string;
  buildingId: string;
  buildingName: string;
  senderName: string;
  senderRole: FeedbackSenderRole;
  rating: FeedbackRating;
  wouldUseRegularly: FeedbackYesMaybeNo;
  unclearOrMissing: string;
  expectedFeature: string;
  wouldRecommend: FeedbackYesMaybeNo;
  createdAt: string;
}

export interface FeedbackSubmissionInput {
  senderName: string;
  senderRole: FeedbackSenderRole;
  rating: FeedbackRating;
  wouldUseRegularly: FeedbackYesMaybeNo;
  unclearOrMissing: string;
  expectedFeature: string;
  wouldRecommend: FeedbackYesMaybeNo;
}

export interface FeedbackStats {
  total: number;
  avgRating: number;
  wouldUseYes: number;
  wouldRecommendYes: number;
  wouldUseCounts: Record<FeedbackYesMaybeNo, number>;
  recommendCounts: Record<FeedbackYesMaybeNo, number>;
  recent: PilotFeedback[];
}
