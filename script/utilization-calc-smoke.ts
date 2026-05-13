import assert from "node:assert/strict";
import {
  calculateEmployeeUtilization,
  listWorkdays,
} from "../shared/utilizationCalc.ts";

type SmokeCase = { name: string; run: () => void };

const smokeCases: SmokeCase[] = [
  {
    name: "listWorkdays excludes weekends",
    run: () => {
      assert.deepEqual(
        listWorkdays("2026-05-11", "2026-05-17"),
        ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"],
      );
    },
  },
  {
    name: "empty range with no plan: green, 0/0",
    run: () => {
      const u = calculateEmployeeUtilization({
        rangeDays: [],
        weeklyHours: 40,
        holidayDates: [],
        vacationDates: [],
        plannedMinutesByDate: {},
      });
      assert.equal(u.availableHours, 0);
      assert.equal(u.plannedHours, 0);
      assert.equal(u.level, "green");
    },
  },
  {
    name: "full week, nothing booked: 40h available, 0 planned, green",
    run: () => {
      const u = calculateEmployeeUtilization({
        rangeDays: ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"],
        weeklyHours: 40,
        holidayDates: [],
        vacationDates: [],
        plannedMinutesByDate: {},
      });
      assert.equal(u.availableHours, 40);
      assert.equal(u.plannedHours, 0);
      assert.equal(u.utilizationRatio, 0);
      assert.equal(u.level, "green");
    },
  },
  {
    name: "one holiday and one vacation day reduce available by two workdays",
    run: () => {
      const u = calculateEmployeeUtilization({
        rangeDays: ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"],
        weeklyHours: 40,
        holidayDates: ["2026-05-14"],
        vacationDates: ["2026-05-15"],
        plannedMinutesByDate: {},
      });
      assert.equal(u.availableHours, 24);
    },
  },
  {
    name: "weekend days inside rangeDays are ignored",
    run: () => {
      const u = calculateEmployeeUtilization({
        rangeDays: [
          "2026-05-09",
          "2026-05-10",
          "2026-05-11",
          "2026-05-12",
          "2026-05-13",
          "2026-05-14",
          "2026-05-15",
        ],
        weeklyHours: 40,
        holidayDates: [],
        vacationDates: [],
        plannedMinutesByDate: {},
      });
      assert.equal(u.availableHours, 40);
    },
  },
  {
    name: "planned 80% -> yellow",
    run: () => {
      const u = calculateEmployeeUtilization({
        rangeDays: ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"],
        weeklyHours: 40,
        holidayDates: [],
        vacationDates: [],
        plannedMinutesByDate: {
          "2026-05-11": 480,
          "2026-05-12": 480,
          "2026-05-13": 480,
          "2026-05-14": 480,
        },
      });
      assert.equal(u.plannedHours, 32);
      assert.equal(u.utilizationRatio, 0.8);
      assert.equal(u.level, "yellow");
    },
  },
  {
    name: "planned > available -> red",
    run: () => {
      const u = calculateEmployeeUtilization({
        rangeDays: ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"],
        weeklyHours: 40,
        holidayDates: [],
        vacationDates: [],
        plannedMinutesByDate: {
          "2026-05-11": 600,
          "2026-05-12": 600,
          "2026-05-13": 600,
          "2026-05-14": 600,
          "2026-05-15": 600,
        },
      });
      assert.equal(u.plannedHours, 50);
      assert.equal(u.level, "red");
    },
  },
  {
    name: "part-time weeklyHours scales available hours",
    run: () => {
      const u = calculateEmployeeUtilization({
        rangeDays: ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"],
        weeklyHours: 20,
        holidayDates: [],
        vacationDates: [],
        plannedMinutesByDate: {},
      });
      assert.equal(u.availableHours, 20);
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
  console.error(`${failures} utilization-calc smoke check(s) failed.`);
  process.exit(1);
}
console.log(`Verified ${smokeCases.length} utilization-calc smoke checks.`);
