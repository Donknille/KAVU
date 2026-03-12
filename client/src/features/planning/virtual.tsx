import { useEffect, useRef, useState, type ReactNode } from "react";

type ViewportState = {
  height: number;
  width: number;
  scrollTop: number;
};

function useVirtualViewport() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ViewportState>({
    height: 0,
    width: 0,
    scrollTop: 0,
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateState = () => {
      setState({
        height: viewport.clientHeight,
        width: viewport.clientWidth,
        scrollTop: viewport.scrollTop,
      });
    };

    updateState();
    viewport.addEventListener("scroll", updateState, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateState();
    });
    resizeObserver.observe(viewport);

    return () => {
      viewport.removeEventListener("scroll", updateState);
      resizeObserver.disconnect();
    };
  }, []);

  return { viewportRef, ...state };
}

export function VirtualStack<T>({
  items,
  itemHeight,
  overscan = 3,
  className,
  gap = 8,
  renderItem,
}: {
  items: T[];
  itemHeight: number;
  overscan?: number;
  className?: string;
  gap?: number;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const { viewportRef, height, scrollTop } = useVirtualViewport();
  const totalItemHeight = itemHeight + gap;
  const visibleCount = Math.max(1, Math.ceil(height / totalItemHeight));
  const startIndex = Math.max(0, Math.floor(scrollTop / totalItemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
  const topSpacer = startIndex * totalItemHeight;
  const bottomSpacer = Math.max(0, (items.length - endIndex) * totalItemHeight);

  return (
    <div ref={viewportRef} className={className}>
      <div style={{ height: topSpacer }} />
      <div className="space-y-2">
        {items.slice(startIndex, endIndex).map((item, index) => renderItem(item, startIndex + index))}
      </div>
      <div style={{ height: bottomSpacer }} />
    </div>
  );
}

export function VirtualGrid<T>({
  items,
  minColumnWidth,
  rowHeight,
  overscan = 2,
  gap = 8,
  className,
  renderItem,
}: {
  items: T[];
  minColumnWidth: number;
  rowHeight: number;
  overscan?: number;
  gap?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const { viewportRef, height, width, scrollTop } = useVirtualViewport();
  const columnCount = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
  const totalRowHeight = rowHeight + gap;
  const rowCount = Math.ceil(items.length / columnCount);
  const visibleRowCount = Math.max(1, Math.ceil(height / totalRowHeight));
  const startRow = Math.max(0, Math.floor(scrollTop / totalRowHeight) - overscan);
  const endRow = Math.min(rowCount, startRow + visibleRowCount + overscan * 2);
  const startIndex = startRow * columnCount;
  const endIndex = Math.min(items.length, endRow * columnCount);
  const topSpacer = startRow * totalRowHeight;
  const bottomSpacer = Math.max(0, (rowCount - endRow) * totalRowHeight);

  return (
    <div ref={viewportRef} className={className}>
      <div style={{ height: topSpacer }} />
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {items.slice(startIndex, endIndex).map((item, index) => renderItem(item, startIndex + index))}
      </div>
      <div style={{ height: bottomSpacer }} />
    </div>
  );
}
