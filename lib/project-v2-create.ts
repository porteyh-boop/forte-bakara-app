import type { ProjectStage } from "@/lib/buildings-cloud";
import type { ProjectTypeId } from "@/lib/project-type-config";
import { PROJECT_TYPE_IDS } from "@/lib/project-type-config";
import type { ServiceType } from "@/lib/service-type";
import { validateServiceTypeFields } from "@/lib/service-type";

export function validateNewProjectForm(form: {
  projectName: string;
  projectType: ProjectTypeId;
  elevatorCount: string;
  projectStage: string;
  serviceType: ServiceType | "";
  serviceTypeOther: string;
}): string | null {
  if (!form.projectName.trim()) {
    return "שם הפרויקט הוא שדה חובה.";
  }

  if (!PROJECT_TYPE_IDS.includes(form.projectType)) {
    return "סוג פרויקט לא תקין.";
  }

  if (form.projectType === "standard") {
    const count = Number(form.elevatorCount);
    if (form.elevatorCount.trim() && (!Number.isFinite(count) || count < 0)) {
      return "מספר מעליות חייב להיות מספר תקין.";
    }
  }

  if (
    form.projectStage &&
    ![
      "הצעת מחיר",
      "משא ומתן",
      "הזמנה",
      "תכנון",
      "ביצוע",
      "מסירה",
      "פרויקט סגור",
    ].includes(form.projectStage)
  ) {
    return "שלב פרויקט לא תקין.";
  }

  const serviceTypeError = validateServiceTypeFields(
    form.serviceType,
    form.serviceTypeOther
  );
  if (serviceTypeError) return serviceTypeError;

  return null;
}

export function mapNewProjectStage(
  value: string
): ProjectStage | null {
  if (!value.trim()) return "הצעת מחיר";
  return value as ProjectStage;
}
