export type ProjectTaskPriority = "נמוכה" | "רגילה" | "גבוהה" | "דחופה";
export type ProjectTaskStatus = "פתוחה" | "בתהליך" | "הושלמה" | "בוטלה";

export interface ProjectTask {
  id: string;
  buildingId: string;
  title: string;
  description: string;
  priority: ProjectTaskPriority;
  status: ProjectTaskStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskInput {
  title: string;
  description: string;
  priority: ProjectTaskPriority;
  status: ProjectTaskStatus;
  dueDate: string;
}

export const PROJECT_TASK_PRIORITIES: ProjectTaskPriority[] = [
  "נמוכה",
  "רגילה",
  "גבוהה",
  "דחופה",
];

export const PROJECT_TASK_STATUSES: ProjectTaskStatus[] = [
  "פתוחה",
  "בתהליך",
  "הושלמה",
  "בוטלה",
];

export function isProjectTaskPriority(value: string): value is ProjectTaskPriority {
  return PROJECT_TASK_PRIORITIES.includes(value as ProjectTaskPriority);
}

export function isProjectTaskStatus(value: string): value is ProjectTaskStatus {
  return PROJECT_TASK_STATUSES.includes(value as ProjectTaskStatus);
}
