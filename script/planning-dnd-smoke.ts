import assert from "node:assert/strict";
import {
  preferCollisionHits,
  resolveDropDateForTarget,
} from "../client/src/features/planning/dnd.ts";
import {
  getAssignmentsForWorkerAdd,
  getAssignmentsForWorkerRemove,
} from "../client/src/features/planning/utils.ts";

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

for (const smokeCase of [...smokeCases, ...legacyCompatibleSmokeCases]) {
  smokeCase.run();
  console.log(`PASS ${smokeCase.name}`);
}

console.log(`Verified ${smokeCases.length + legacyCompatibleSmokeCases.length} planning DnD smoke checks.`);
