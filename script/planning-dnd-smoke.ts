import assert from "node:assert/strict";
import {
  preferCollisionHits,
  resolveDropDateForTarget,
} from "../client/src/features/planning/dnd.ts";
import {
  getAssignmentsForWorkerAdd,
  getAssignmentsForWorkerRemove,
} from "../client/src/features/planning/utils.ts";
import { buildPlanningBlocks } from "../shared/planningBoard.ts";
import type { PlanningBoardAssignment } from "../shared/planningBoard.ts";

type SmokeCase = {
  name: string;
  run: () => void;
};

const smokeCases: SmokeCase[] = [
  {
    name: "jobs prefer day drop zones when day and block overlap",
    run: () => {
      const hits = [
        { id: "block:block-a", data: { current: { dropType: "block", blockId: "block-a", startDate: "2026-03-09", endDate: "2026-03-11", days: ["2026-03-09", "2026-03-10", "2026-03-11"] } } },
        { id: "day:2026-03-09", data: { current: { dropType: "day", date: "2026-03-09" } } },
      ];
      assert.deepEqual(preferCollisionHits("job:job-a", hits).map((hit) => hit.id), ["day:2026-03-09"]);
    },
  },
  {
    name: "employees prefer block drop zones when day and block overlap",
    run: () => {
      const hits = [
        { id: "day:2026-03-09", data: { current: { dropType: "day", date: "2026-03-09" } } },
        { id: "block:block-a", data: { current: { dropType: "block", blockId: "block-a", startDate: "2026-03-09", endDate: "2026-03-11", days: ["2026-03-09", "2026-03-10", "2026-03-11"] } } },
      ];
      assert.deepEqual(preferCollisionHits("employee:worker-a", hits).map((hit) => hit.id), ["block:block-a"]);
    },
  },
  {
    name: "employees prefer dedicated block drop overlays over day targets",
    run: () => {
      const hits = [
        { id: "day:2026-03-09", data: { current: { dropType: "day", date: "2026-03-09" } } },
        {
          id: "block-employee:block-a",
          data: {
            current: {
              dropType: "block",
              blockId: "block-a",
              startDate: "2026-03-09",
              endDate: "2026-03-10",
              days: ["2026-03-09", "2026-03-10"],
            },
          },
        },
      ];
      assert.deepEqual(preferCollisionHits("employee:worker-a", hits).map((hit) => hit.id), [
        "block-employee:block-a",
      ]);
    },
  },
  {
    name: "drop on empty day resolves directly from the day target",
    run: () => {
      assert.equal(
        resolveDropDateForTarget({
          overId: "day:2026-03-10",
          activeType: "job",
        }),
        "2026-03-10"
      );
    },
  },
  {
    name: "drop over occupied multi-day block resolves the hovered day from pointer position",
    run: () => {
      assert.equal(
        resolveDropDateForTarget({
          overId: "block:block-a",
          activeType: "job",
          overData: {
            dropType: "block",
            blockId: "block-a",
            startDate: "2026-03-10",
            endDate: "2026-03-12",
            days: ["2026-03-10", "2026-03-11", "2026-03-12"],
          },
          targetBlock: {
            startDate: "2026-03-10",
            endDate: "2026-03-12",
            days: ["2026-03-10", "2026-03-11", "2026-03-12"],
          },
          activeCenterX: 250,
          overRect: {
            left: 100,
            width: 300,
          },
        }),
        "2026-03-11"
      );
    },
  },
  {
    name: "block move over a multi-day block can target the last covered day",
    run: () => {
      assert.equal(
        resolveDropDateForTarget({
          overId: "block:block-a",
          activeType: "block-move",
          overData: {
            dropType: "block",
            blockId: "block-a",
            startDate: "2026-03-10",
            endDate: "2026-03-12",
            days: ["2026-03-10", "2026-03-11", "2026-03-12"],
          },
          targetBlock: {
            startDate: "2026-03-10",
            endDate: "2026-03-12",
            days: ["2026-03-10", "2026-03-11", "2026-03-12"],
          },
          activeCenterX: 395,
          overRect: {
            left: 100,
            width: 300,
          },
        }),
        "2026-03-12"
      );
    },
  },
  {
    name: "resize start always anchors to the block start date",
    run: () => {
      assert.equal(
        resolveDropDateForTarget({
          overId: "block:block-a",
          activeType: "block-resize-start",
          targetBlock: {
            startDate: "2026-03-10",
            endDate: "2026-03-12",
            days: ["2026-03-10", "2026-03-11", "2026-03-12"],
          },
          activeCenterX: 390,
          overRect: {
            left: 100,
            width: 300,
          },
        }),
        "2026-03-10"
      );
    },
  },
  {
    name: "resize end always anchors to the block end date",
    run: () => {
      assert.equal(
        resolveDropDateForTarget({
          overId: "block:block-a",
          activeType: "block-resize-end",
          targetBlock: {
            startDate: "2026-03-10",
            endDate: "2026-03-12",
            days: ["2026-03-10", "2026-03-11", "2026-03-12"],
          },
          activeCenterX: 110,
          overRect: {
            left: 100,
            width: 300,
          },
        }),
        "2026-03-12"
      );
    },
  },
  {
    name: "block targets fall back to the start day when geometry is missing",
    run: () => {
      assert.equal(
        resolveDropDateForTarget({
          overId: "block:block-a",
          activeType: "job",
          targetBlock: {
            startDate: "2026-03-10",
            endDate: "2026-03-12",
            days: ["2026-03-10", "2026-03-11", "2026-03-12"],
          },
        }),
        "2026-03-10"
      );
    },
  },
  {
    name: "worker add supports specific selected days on multi-day blocks",
    run: () => {
      const assignments = [
        { id: "a-1", assignmentDate: "2026-03-09", status: "planned" },
        { id: "a-2", assignmentDate: "2026-03-10", status: "planned" },
        { id: "a-3", assignmentDate: "2026-03-11", status: "planned" },
      ];

      assert.deepEqual(
        getAssignmentsForWorkerAdd(assignments as any, "2026-03-09", {
          mode: "specific-days",
          dates: ["2026-03-09", "2026-03-11"],
        }).map((assignment) => assignment.assignmentDate),
        ["2026-03-09", "2026-03-11"]
      );
    },
  },
  {
    name: "worker removal supports specific selected open days",
    run: () => {
      const worker = { id: "worker-1", firstName: "Jonas", lastName: "Richter" };
      const assignments = [
        { id: "a-1", assignmentDate: "2026-03-09", status: "on_site", workers: [worker] },
        { id: "a-2", assignmentDate: "2026-03-10", status: "planned", workers: [worker] },
        { id: "a-3", assignmentDate: "2026-03-11", status: "planned", workers: [worker] },
      ];

      assert.deepEqual(
        getAssignmentsForWorkerRemove(assignments as any, "2026-03-09", "worker-1", {
          mode: "specific-days",
          dates: ["2026-03-09", "2026-03-10", "2026-03-11"],
        }).map((assignment) => assignment.assignmentDate),
        ["2026-03-10", "2026-03-11"]
      );
    },
  },
];

const legacyCompatibleSmokeCases: SmokeCase[] = [
  {
    name: "worker add respects a later partial-assignment start date on multi-day blocks",
    run: () => {
      const assignments = [
        { id: "a-1", assignmentDate: "2026-03-09", status: "planned" },
        { id: "a-2", assignmentDate: "2026-03-10", status: "planned" },
        { id: "a-3", assignmentDate: "2026-03-11", status: "planned" },
      ];

      assert.deepEqual(
        getAssignmentsForWorkerAdd(assignments as any, "2026-03-09", {
          mode: "from-date",
          startDate: "2026-03-10",
        }).map(
          (assignment) => assignment.assignmentDate
        ),
        ["2026-03-10", "2026-03-11"]
      );
    },
  },
];

// --- Lane allocation smoke tests (core feature: 3+ parallel assignments) ---

function makeAssignment(id: string, jobId: string, date: string): PlanningBoardAssignment {
  return {
    id,
    jobId,
    assignmentDate: date,
    sortOrder: 0,
    status: "planned",
    job: { id: jobId, title: `Job ${jobId}`, jobNumber: jobId, customerName: "Test", status: "planned" },
  };
}

const laneCases: SmokeCase[] = [
  {
    name: "3 different jobs on the same day get 3 separate lanes",
    run: () => {
      const days = ["2026-03-23"];
      const assignments = [
        makeAssignment("a1", "job-1", "2026-03-23"),
        makeAssignment("a2", "job-2", "2026-03-23"),
        makeAssignment("a3", "job-3", "2026-03-23"),
      ];
      const blocks = buildPlanningBlocks(assignments, days);
      assert.equal(blocks.length, 3, "should produce 3 blocks");
      const lanes = blocks.map((b) => b.lane).sort();
      assert.deepEqual(lanes, [0, 1, 2], "blocks must be on lanes 0, 1, 2");
    },
  },
  {
    name: "5 different jobs on the same day get 5 separate lanes",
    run: () => {
      const days = ["2026-03-23"];
      const assignments = Array.from({ length: 5 }, (_, i) =>
        makeAssignment(`a${i}`, `job-${i}`, "2026-03-23"),
      );
      const blocks = buildPlanningBlocks(assignments, days);
      assert.equal(blocks.length, 5, "should produce 5 blocks");
      const lanes = new Set(blocks.map((b) => b.lane));
      assert.equal(lanes.size, 5, "all 5 blocks must be on different lanes");
    },
  },
  {
    name: "10 jobs on the same day get 10 separate lanes (scale test)",
    run: () => {
      const days = ["2026-03-23"];
      const assignments = Array.from({ length: 10 }, (_, i) =>
        makeAssignment(`a${i}`, `job-${i}`, "2026-03-23"),
      );
      const blocks = buildPlanningBlocks(assignments, days);
      assert.equal(blocks.length, 10, "should produce 10 blocks");
      const maxLane = Math.max(...blocks.map((b) => b.lane));
      assert.equal(maxLane, 9, "highest lane must be 9 (0-indexed)");
    },
  },
  {
    name: "multi-day block reuses lane when previous block ends",
    run: () => {
      const days = ["2026-03-23", "2026-03-24", "2026-03-25"];
      const assignments = [
        makeAssignment("a1", "job-1", "2026-03-23"),
        makeAssignment("a1b", "job-1", "2026-03-24"),
        makeAssignment("a2", "job-2", "2026-03-23"),
        makeAssignment("a3", "job-3", "2026-03-25"), // starts after job-2 ends
      ];
      const blocks = buildPlanningBlocks(assignments, days);
      // job-1 spans 23-24 (lane 0), job-2 on 23 (lane 1), job-3 on 25 (lane 0 or 1 — reused)
      const job3Block = blocks.find((b) => b.jobId === "job-3");
      assert.ok(job3Block, "job-3 block must exist");
      assert.ok(job3Block!.lane <= 1, "job-3 should reuse lane 0 or 1, not create lane 2");
    },
  },
];

const allCases = [...smokeCases, ...legacyCompatibleSmokeCases, ...laneCases];
for (const smokeCase of allCases) {
  smokeCase.run();
  console.log(`PASS ${smokeCase.name}`);
}

console.log(`Verified ${allCases.length} planning DnD smoke checks.`);
