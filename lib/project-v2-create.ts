import type { ProjectStage } from "@/lib/buildings-cloud";

export function validateNewProjectForm(form: {
  projectName: string;
  elevatorCount: string;
  projectStage: string;
}): string | null {
  if (!form.projectName.trim()) {
    return "שם הפרויקט הוא שדה חובה.";
  }

  const count = Number(form.elevatorCount);
  if (form.elevatorCount.trim() && (!Number.isFinite(count) || count < 0)) {
    return "מספר מעליות חייב להיות מספר תקין.";
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

  return null;
}

export function mapNewProjectStage(
  value: string
): ProjectStage | null {
  if (!value.trim()) return "הצעת מחיר";
  return value as ProjectStage;
}
