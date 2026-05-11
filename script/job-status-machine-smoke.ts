import assert from "node:assert/strict";
import {
  canTransitionJobStatus,
  getAllowedTransitions,
  isJobStatus,
  JOB_STATUSES,
} from "../shared/jobStatusMachine.ts";

type SmokeCase = {
  name: string;
  run: () => void;
};

const smokeCases: SmokeCase[] = [
  {
    name: "isJobStatus accepts every enum value",
    run: () => {
      for (const status of JOB_STATUSES) {
        assert.equal(isJobStatus(status), true, `expected ${status} to be a valid status`);
      }
    },
  },
  {
    name: "isJobStatus rejects unknown strings",
    run: () => {
      assert.equal(isJobStatus("nope"), false);
      assert.equal(isJobStatus(""), false);
      assert.equal(isJobStatus(null), false);
      assert.equal(isJobStatus(undefined), false);
      assert.equal(isJobStatus(42), false);
    },
  },
  {
    name: "planned can move to in_progress or problem only",
    run: () => {
      assert.deepEqual(getAllowedTransitions("planned"), ["in_progress", "problem"]);
    },
  },
  {
    name: "in_progress can move to completed or problem",
    run: () => {
      assert.deepEqual(getAllowedTransitions("in_progress"), ["completed", "problem"]);
    },
  },
  {
    name: "billable can only step back to completed",
    run: () => {
      assert.deepEqual(getAllowedTransitions("billable"), ["completed"]);
    },
  },
  {
    name: "no status can transition to itself",
    run: () => {
      for (const status of JOB_STATUSES) {
        assert.equal(canTransitionJobStatus(status, status), false, `${status} -> ${status} must be blocked`);
      }
    },
  },
  {
    name: "blocked transition: planned cannot jump directly to billable",
    run: () => {
      assert.equal(canTransitionJobStatus("planned", "billable"), false);
    },
  },
  {
    name: "blocked transition: planned cannot skip to completed",
    run: () => {
      assert.equal(canTransitionJobStatus("planned", "completed"), false);
    },
  },
  {
    name: "happy path: planned -> in_progress -> completed -> reviewed -> billable",
    run: () => {
      assert.equal(canTransitionJobStatus("planned", "in_progress"), true);
      assert.equal(canTransitionJobStatus("in_progress", "completed"), true);
      assert.equal(canTransitionJobStatus("completed", "reviewed"), true);
      assert.equal(canTransitionJobStatus("reviewed", "billable"), true);
    },
  },
  {
    name: "problem is reachable from every active state",
    run: () => {
      const fromStates = ["planned", "in_progress", "completed", "reviewed"] as const;
      for (const from of fromStates) {
        assert.equal(canTransitionJobStatus(from, "problem"), true, `${from} -> problem should be allowed`);
      }
    },
  },
  {
    name: "problem can route back to planned, in_progress or completed",
    run: () => {
      assert.deepEqual(getAllowedTransitions("problem"), ["planned", "in_progress", "completed"]);
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
  console.error(`${failures} job-status-machine smoke check(s) failed.`);
  process.exit(1);
}

console.log(`Verified ${smokeCases.length} job-status-machine smoke checks.`);
