import type {
  ElevatorStatusOption,
  SaveElevatorInput,
} from "./buildings-cloud";

export type NewBuildingElevatorDraft = {
  elevatorId: string;
  elevatorName: string;
  elevatorType: string;
  status: ElevatorStatusOption;
};

export function emptyNewBuildingElevatorDraft(): NewBuildingElevatorDraft {
  return {
    elevatorId: "",
    elevatorName: "",
    elevatorType: "",
    status: "פעילה",
  };
}

export function validateNewBuildingElevators(
  drafts: NewBuildingElevatorDraft[]
): { ok: true } | { ok: false; message: string } {
  if (drafts.length === 0) {
    return { ok: false, message: "יש להוסיף לפחות מעלית אחת לבניין." };
  }

  const names = new Set<string>();
  const ids = new Set<string>();

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const name = draft.elevatorName.trim();
    if (!name) {
      return {
        ok: false,
        message: `שם/מספר מעלית הוא שדה חובה (מעלית ${i + 1}).`,
      };
    }
    if (names.has(name)) {
      return { ok: false, message: "שמות מעליות חייבים להיות ייחודיים בבניין." };
    }
    names.add(name);

    const manualId = draft.elevatorId.trim();
    if (manualId) {
      if (ids.has(manualId)) {
        return {
          ok: false,
          message: "מזההי מעליות חייבים להיות ייחודיים בבניין.",
        };
      }
      ids.add(manualId);
    }
  }

  return { ok: true };
}

export function resolveNewBuildingElevatorId(
  buildingId: string,
  draft: NewBuildingElevatorDraft,
  index: number,
  usedIds: Set<string>
): string {
  const manual = draft.elevatorId.trim();
  if (manual) return manual;

  let n = index + 1;
  let candidate = `${buildingId}-e${n}`;
  while (usedIds.has(candidate)) {
    n += 1;
    candidate = `${buildingId}-e${n}`;
  }
  return candidate;
}

export function toSaveElevatorInputs(
  buildingId: string,
  drafts: NewBuildingElevatorDraft[]
): SaveElevatorInput[] {
  const usedIds = new Set<string>();
  return drafts.map((draft, index) => {
    const elevatorId = resolveNewBuildingElevatorId(
      buildingId,
      draft,
      index,
      usedIds
    );
    usedIds.add(elevatorId);
    return {
      buildingId,
      elevatorId,
      elevatorName: draft.elevatorName.trim(),
      elevatorType: draft.elevatorType.trim() || undefined,
      status: draft.status ?? "פעילה",
    };
  });
}
