import { useLayoutEffect, useRef, useState } from 'react';
import { type DragEvent } from 'react';

type SortableItem = { id: string };

type UseSortableListParams<T extends SortableItem> = {
  items: T[];
  onReorder?: (activeId: string, overId: string) => void;
  isEnabled?: (item: T) => boolean;
};

export function useSortableList<T extends SortableItem>({
  items,
  onReorder,
  isEnabled = () => true,
}: UseSortableListParams<T>) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const previousTops = useRef<Map<string, number>>(new Map());
  const lastMoveRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const currentTops = new Map<string, number>();

    for (const [id, element] of itemRefs.current.entries()) {
      currentTops.set(id, element.getBoundingClientRect().top);
    }

    for (const [id, newTop] of currentTops.entries()) {
      const prevTop = previousTops.current.get(id);
      const element = itemRefs.current.get(id);

      if (!element || prevTop === undefined) continue;

      const deltaY = prevTop - newTop;
      if (deltaY === 0) continue;

      const rowHeight = element.getBoundingClientRect().height || 40;
      const maxAnimatedDelta = rowHeight * 1.2;

      if (Math.abs(deltaY) > maxAnimatedDelta) {
        element.style.transition = '';
        element.style.transform = '';
        continue;
      }

      element.style.transition = 'none';
      element.style.transform = `translateY(${deltaY}px)`;

      requestAnimationFrame(() => {
        element.style.transition = 'transform 220ms ease';
        element.style.transform = '';
      });
    }

    previousTops.current = currentTops;
  }, [items]);

  function getItemProps(item: T) {
    const enabled = isEnabled(item);

    return {
      ref: (element: HTMLLIElement | null) => {
        if (element) {
          itemRefs.current.set(item.id, element);
        } else {
          itemRefs.current.delete(item.id);
        }
      },
      draggable: enabled,
      onDragStart: () => {
        if (!enabled) return;

        const initialTops = new Map<string, number>();
        for (const [id, element] of itemRefs.current.entries()) {
          initialTops.set(id, element.getBoundingClientRect().top);
        }
        previousTops.current = initialTops;

        setDraggedId(item.id);
        lastMoveRef.current = null;
      },
      onDragOver: (e: DragEvent<HTMLLIElement>) => {
        if (!enabled) return;
        e.preventDefault();
        if (!draggedId || draggedId === item.id) return;

        setHoveredId(item.id);

        const fromIndex = items.findIndex((t) => t.id === draggedId);
        const toIndex = items.findIndex((t) => t.id === item.id);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const middleY = rect.top + rect.height / 2;
        const isMovingDown = fromIndex < toIndex;

        if (isMovingDown && e.clientY < middleY) return;
        if (!isMovingDown && e.clientY > middleY) return;

        const moveKey = `${fromIndex}->${toIndex}`;
        if (lastMoveRef.current === moveKey) return;

        lastMoveRef.current = moveKey;
        onReorder?.(draggedId, item.id);
      },
      onDragEnter: () => {
        if (!enabled || !draggedId) return;
        if (item.id !== draggedId) {
          setHoveredId(item.id);
        }
      },
      onDragLeave: () => {
        if (hoveredId === item.id) {
          setHoveredId(null);
        }
      },
      onDrop: () => {
        setHoveredId(null);
        lastMoveRef.current = null;
      },
      onDragEnd: () => {
        setDraggedId(null);
        setHoveredId(null);
        lastMoveRef.current = null;
      },
    };
  }

  return {
    draggedId,
    hoveredId,
    getItemProps,
  };
}
