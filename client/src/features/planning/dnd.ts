import type {
  ActiveDrag,
  PlanningBlock,
  PlanningDropData,
} from "./types.ts";

type CollisionLike = {
  id: string | number;
  data?: {
    current?: PlanningDropData;
  };
};

type BlockRectLike = {
  left: number;
  width: number;
};

type DropDateResolutionInput = {
  overId: string;
  activeType: ActiveDrag["type"];
  overData?: PlanningDropData | null;
  targetBlock?: Pick<PlanningBlock, "startDate" | "endDate" | "days"> | null;
  activeCenterX?: number | null;
  overRect?: BlockRectLike | null;
};

/**
 * Keep the DnD preference rules pure so layout work cannot silently change them.
 */
export function preferCollisionHits<T extends CollisionLike>(
  activeId: string,
  hits: readonly T[]
): T[] {
  const prefersBlocks = activeId.startsWith("employee:");
  const preferred = hits.filter((hit) => {
    const dropType = hit.data?.current?.dropType;
    if (dropType) {
      return prefersBlocks ? dropType === "block" : (dropType === "employee-day" || dropType === "day");
    }

    const hitId = String(hit.id);
    return prefersBlocks ? hitId.startsWith("block:") : (hitId.startsWith("day:") || hitId.startsWith("employee-day:"));
  });

  if (preferred.length > 0) {
    return [...preferred];
  }

  return [...hits];
}

/**
 * Resolve the logical drop date from the current drop target.
 * This is the critical rule that keeps drops onto occupied days stable.
 */
export function resolveDropDateForTarget({
  overId,
  activeType,
  overData,
  targetBlock,
  activeCenterX,
  overRect,
}: DropDateResolutionInput): string | null {
  if (overData?.dropType === "day") {
    return overData.date;
  }

  if (overData?.dropType === "employee-day") {
    return overData.date;
  }

  if (overData?.dropType === "block") {
    targetBlock = overData;
  }

  if (overId.startsWith("day:")) {
    return overId.slice(4);
  }

  if ((!overId.startsWith("block:") && overData?.dropType !== "block") || !targetBlock) {
    return null;
  }

  if (activeType === "block-resize-start") {
    return targetBlock.startDate;
  }

  if (activeType === "block-resize-end") {
    return targetBlock.endDate;
  }

  if (
    activeCenterX === null ||
    activeCenterX === undefined ||
    !overRect ||
    targetBlock.days.length === 0 ||
    overRect.width <= 0
  ) {
    return targetBlock.startDate;
  }

  const relativeX = Math.min(Math.max(activeCenterX - overRect.left, 0), overRect.width);
  const dayWidth = overRect.width / targetBlock.days.length;
  if (!Number.isFinite(dayWidth) || dayWidth <= 0) {
    return targetBlock.startDate;
  }

  const dayOffset = Math.min(
    targetBlock.days.length - 1,
    Math.max(0, Math.floor(relativeX / dayWidth))
  );

  return targetBlock.days[dayOffset] ?? targetBlock.startDate;
}
