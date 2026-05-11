import assert from "node:assert/strict";
import {
  calcUtilization,
  utilizationDetailLabel,
  utilizationLabel,
} from "../client/src/lib/utilization.ts";

type SmokeCase = {
  name: string;
  run: () => void;
};

const smokeCases: SmokeCase[] = [
  {
    name: "all employees free -> level green",
    run: () => {
      const u = calcUtilization(5, 0);
      assert.equal(u.busy, 0);
      assert.equal(u.free, 5);
      assert.equal(u.total, 5);
      assert.equal(u.freeRatio, 1);
      assert.equal(u.level, "green");
    },
  },
  {
    name: "all employees busy -> level red",
    run: () => {
      const u = calcUtilization(5, 5);
      assert.equal(u.busy, 5);
      assert.equal(u.free, 0);
      assert.equal(u.level, "red");
    },
  },
  {
    name: "exactly 50% free -> level green (lower boundary)",
    run: () => {
      const u = calcUtilization(4, 2);
      assert.equal(u.free, 2);
      assert.equal(u.freeRatio, 0.5);
      assert.equal(u.level, "green");
    },
  },
  {
    name: "exactly 20% free -> level yellow (lower boundary)",
    run: () => {
      const u = calcUtilization(5, 4);
      assert.equal(u.free, 1);
      assert.equal(u.freeRatio, 0.2);
      assert.equal(u.level, "yellow");
    },
  },
  {
    name: "10% free -> level red",
    run: () => {
      const u = calcUtilization(10, 9);
      assert.equal(u.free, 1);
      assert.equal(u.level, "red");
    },
  },
  {
    name: "zero employees -> empty utilization, level green, free=0",
    run: () => {
      const u = calcUtilization(0, 0);
      assert.equal(u.busy, 0);
      assert.equal(u.free, 0);
      assert.equal(u.total, 0);
      assert.equal(u.freeRatio, 1);
      assert.equal(u.level, "green");
    },
  },
  {
    name: "busy clamped to total when given inconsistent inputs",
    run: () => {
      const u = calcUtilization(3, 99);
      assert.equal(u.busy, 3);
      assert.equal(u.free, 0);
      assert.equal(u.level, "red");
    },
  },
  {
    name: "negative inputs are coerced to zero",
    run: () => {
      const u = calcUtilization(-2, -1);
      assert.equal(u.total, 0);
      assert.equal(u.busy, 0);
      assert.equal(u.free, 0);
    },
  },
  {
    name: "utilizationLabel reports humanized free-of-total",
    run: () => {
      assert.equal(utilizationLabel(calcUtilization(5, 3)), "2 von 5 frei");
    },
  },
  {
    name: "utilizationLabel handles empty company",
    run: () => {
      assert.equal(utilizationLabel(calcUtilization(0, 0)), "Keine Mitarbeiter");
    },
  },
  {
    name: "utilizationDetailLabel mentions both busy and free counts",
    run: () => {
      assert.equal(
        utilizationDetailLabel(calcUtilization(5, 3)),
        "3 im Einsatz · 2 frei",
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
  console.error(`${failures} utilization smoke check(s) failed.`);
  process.exit(1);
}

console.log(`Verified ${smokeCases.length} utilization smoke checks.`);
