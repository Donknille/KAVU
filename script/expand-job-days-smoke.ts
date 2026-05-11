import assert from "node:assert/strict";
import { expandJobIntoWorkdays } from "../client/src/features/planning/expandJobDays.ts";

type SmokeCase = {
  name: string;
  run: () => void;
};

const smokeCases: SmokeCase[] = [
  {
    name: "no plannedDuration -> single day",
    run: () => {
      assert.deepEqual(expandJobIntoWorkdays("2026-05-11", null), ["2026-05-11"]);
      assert.deepEqual(expandJobIntoWorkdays("2026-05-11", undefined), ["2026-05-11"]);
      assert.deepEqual(expandJobIntoWorkdays("2026-05-11", 0), ["2026-05-11"]);
    },
  },
  {
    name: "duration <= 8h -> single day",
    run: () => {
      assert.deepEqual(expandJobIntoWorkdays("2026-05-11", 60), ["2026-05-11"]);
      assert.deepEqual(expandJobIntoWorkdays("2026-05-11", 480), ["2026-05-11"]);
    },
  },
  {
    name: "duration 9h -> two days (rounding up)",
    run: () => {
      assert.deepEqual(expandJobIntoWorkdays("2026-05-11", 540), ["2026-05-11", "2026-05-12"]);
    },
  },
  {
    name: "duration 24h on a Monday -> Mon/Tue/Wed",
    run: () => {
      // 2026-05-11 is a Monday in the Gregorian calendar.
      assert.deepEqual(
        expandJobIntoWorkdays("2026-05-11", 24 * 60),
        ["2026-05-11", "2026-05-12", "2026-05-13"],
      );
    },
  },
  {
    name: "weekends are skipped after the first day",
    run: () => {
      // Friday 2026-05-15 + 24h -> Fri, Mon, Tue (skipping Sat/Sun).
      assert.deepEqual(
        expandJobIntoWorkdays("2026-05-15", 24 * 60),
        ["2026-05-15", "2026-05-18", "2026-05-19"],
      );
    },
  },
  {
    name: "weekend start day is honored even if subsequent weekends are skipped",
    run: () => {
      // Saturday 2026-05-16 + 16h -> Sat, Mon (skipping Sun).
      assert.deepEqual(
        expandJobIntoWorkdays("2026-05-16", 16 * 60),
        ["2026-05-16", "2026-05-18"],
      );
    },
  },
  {
    name: "skipWeekends: false yields contiguous calendar days",
    run: () => {
      assert.deepEqual(
        expandJobIntoWorkdays("2026-05-15", 24 * 60, { skipWeekends: false }),
        ["2026-05-15", "2026-05-16", "2026-05-17"],
      );
    },
  },
];

let failures = 0;
for (const testCase of smokeCases) {
  try {
    testCase.run();
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${testCase.name}`);
    console.error(error);
  }
}

if (failures > 0) {
  console.error(`${failures} expand-job-days smoke check(s) failed.`);
  process.exit(1);
}

console.log(`Verified ${smokeCases.length} expand-job-days smoke checks.`);
