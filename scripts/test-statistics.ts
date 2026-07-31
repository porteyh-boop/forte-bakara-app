/**
 * Unit checks for lib/statistics.ts — run: npx tsx scripts/test-statistics.ts
 */
import {
  buildStatisticsSnapshot,
  filterFaultRowsByPeriod,
  getFaultTypeColor,
} from "../lib/statistics";

const NOW = new Date("2026-07-15T12:00:00.000Z");

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testEmptyFaults() {
  const snapshot = buildStatisticsSnapshot([], "b1", "all", NOW);
  assert(snapshot.totalFaults === 0, "empty: totalFaults");
  assert(snapshot.monthly.length === 12, "empty: 12 months");
  assert(snapshot.monthly.every((m) => m.count === 0), "empty: all months zero");
  assert(snapshot.byType.length === 0, "empty: byType");
  assert(snapshot.byElevator.length === 0, "empty: byElevator");
}

function testSingleFault() {
  const snapshot = buildStatisticsSnapshot(
    [
      {
        created_at: "2026-03-10T10:00:00.000Z",
        fault_type: "דלת לא נסגרת",
        elevator_name: "מעלית A",
      },
    ],
    "b1",
    "all",
    NOW
  );
  assert(snapshot.totalFaults === 1, "single: total");
  assert(snapshot.monthly[2]?.count === 1, "single: march count");
  assert(snapshot.byType[0]?.percentage === 100, "single: 100%");
  assert(snapshot.byElevator[0]?.elevatorName === "מעלית A", "single: elevator");
}

function testMultipleElevatorsAndTypes() {
  const rows = [
    {
      created_at: "2026-01-05T10:00:00.000Z",
      fault_type: "דלת לא נסגרת",
      elevator_name: "מעלית B",
    },
    {
      created_at: "2026-02-05T10:00:00.000Z",
      fault_type: "תאורה לא עובדת",
      elevator_name: "מעלית A",
    },
    {
      created_at: "2026-02-20T10:00:00.000Z",
      fault_type: "דלת לא נסגרת",
      elevator_name: "מעלית A",
    },
    {
      created_at: "2026-06-01T10:00:00.000Z",
      fault_type: null,
      elevator_name: "מעלית C",
    },
  ];

  const snapshot = buildStatisticsSnapshot(rows, "b2", "year", NOW);
  assert(snapshot.totalFaults === 4, "multi: total");
  assert(snapshot.byElevator[0]?.elevatorName === "מעלית A", "multi: top elevator");
  assert(snapshot.byElevator[0]?.count === 2, "multi: top elevator count");
  assert(snapshot.byType.length === 3, "multi: type count includes unspecified");
  assert(getFaultTypeColor("דלת לא נסגרת") === "#0d1b3e", "color: doors");
}

function testPeriodFilter30Days() {
  const rows = [
    { created_at: "2026-07-10T10:00:00.000Z", fault_type: "אחר", elevator_name: "A" },
    { created_at: "2026-05-01T10:00:00.000Z", fault_type: "אחר", elevator_name: "A" },
  ];
  const filtered = filterFaultRowsByPeriod(rows, "30d", NOW);
  assert(filtered.length === 1, "30d filter keeps recent fault only");
}

function testFixedColorsNotRandom() {
  const a = getFaultTypeColor("דלת לא נסגרת");
  const b = getFaultTypeColor("דלת לא נסגרת");
  assert(a === b, "colors are deterministic");
  assert(a !== getFaultTypeColor("תאורה לא עובדת"), "different types differ in color");
}

function main() {
  testEmptyFaults();
  testSingleFault();
  testMultipleElevatorsAndTypes();
  testPeriodFilter30Days();
  testFixedColorsNotRandom();
  console.log("[statistics] all checks passed");
}

main();
