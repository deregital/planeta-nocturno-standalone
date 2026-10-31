import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

type SortableItem = { id: string };

type UseSortableListParams<T extends SortableItem> = {
  items: T[];
  onReorder?: (activeId: string, overId: string) => void;
  isEnabled?: (item: T) => boolean;
  /** Solo el asa inicia el arrastre; la fila sigue siendo el destino. */
  handleOnly?: boolean;
  onDragStarted?: () => void;
  onDragFinished?: () => void;
};

export type SortableHandleProps = {
  draggable: boolean;
  disabled: boolean;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: DragEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

/** Long enough to read on screen; reorder is throttled so this can actually finish. */
const FLIP_DURATION_MS = 420;
const FLIP_EASING = 'cubic-bezier(0.34, 1.22, 0.58, 1)';

/** Lets FLIP run between store updates instead of every dragover killing the previous tween. */
const REORDER_MIN_INTERVAL_MS = 95;

function flushLayout(element: HTMLElement) {
  void element.offsetHeight;
}

function isEventFromNestedList(event: DragEvent<HTMLElement>) {
  if (!(event.target instanceof Element)) return false;
  const nested = event.target.closest('[data-sortable-nested]');
  return Boolean(
    nested &&
      nested !== event.currentTarget &&
      event.currentTarget.contains(nested),
  );
}

export function useSortableList<T extends SortableItem>({
  items,
  onReorder,
  isEnabled = () => true,
  handleOnly = false,
  onDragStarted,
  onDragFinished,
}: UseSortableListParams<T>) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const previousTops = useRef<Map<string, number>>(new Map());
  const lastMoveRef = useRef<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const flipAnimByIdRef = useRef<Map<string, Animation>>(new Map());
  const lastReorderAtRef = useRef(0);
  const orderKeyRef = useRef<string | null>(null);
  const pendingReorderRef = useRef<{ active: string; over: string } | null>(
    null,
  );
  const reorderFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  function cancelFlipAnimations() {
    for (const anim of flipAnimByIdRef.current.values()) {
      anim.cancel();
    }
    flipAnimByIdRef.current.clear();
  }

  function clearInlineTransformStyles() {
    for (const element of itemRefs.current.values()) {
      element.style.transition = '';
      element.style.transform = '';
    }
  }

  function flushPendingReorder() {
    reorderFlushTimerRef.current = null;
    const p = pendingReorderRef.current;
    pendingReorderRef.current = null;
    if (!p || !draggedIdRef.current || p.active !== draggedIdRef.current)
      return;
    lastReorderAtRef.current = performance.now();
    onReorder?.(p.active, p.over);
  }

  function scheduleOrInvokeReorder(active: string, over: string) {
    if (!onReorder) return;

    const now = performance.now();
    const elapsed = now - lastReorderAtRef.current;

    if (elapsed >= REORDER_MIN_INTERVAL_MS) {
      if (reorderFlushTimerRef.current) {
        clearTimeout(reorderFlushTimerRef.current);
        reorderFlushTimerRef.current = null;
      }
      pendingReorderRef.current = null;
      lastReorderAtRef.current = now;
      onReorder(active, over);
      return;
    }

    pendingReorderRef.current = { active, over };
    if (reorderFlushTimerRef.current) {
      clearTimeout(reorderFlushTimerRef.current);
    }
    const wait = Math.max(0, REORDER_MIN_INTERVAL_MS - elapsed);
    reorderFlushTimerRef.current = setTimeout(flushPendingReorder, wait);
  }

  useLayoutEffect(() => {
    lastMoveRef.current = null;

    const elements = itemRefs.current;
    if (elements.size === 0) return;

    const nextOrderKey = items.map((item) => item.id).join('|');
    const orderChanged = orderKeyRef.current !== nextOrderKey;
    orderKeyRef.current = nextOrderKey;

    if (orderChanged) {
      cancelFlipAnimations();
      clearInlineTransformStyles();
    }

    const firstEl = elements.values().next().value;
    if (firstEl) flushLayout(firstEl);

    const currentTops = new Map<string, number>();
    for (const [id, element] of elements.entries()) {
      currentTops.set(id, element.getBoundingClientRect().top);
    }

    if (!orderChanged) {
      previousTops.current = currentTops;
      return;
    }

    const activeDragId = draggedIdRef.current;

    for (const [id, newTop] of currentTops.entries()) {
      const prevTop = previousTops.current.get(id);
      const element = elements.get(id);

      if (!element || prevTop === undefined) continue;

      const deltaY = prevTop - newTop;
      if (deltaY === 0) continue;

      if (id === activeDragId) continue;

      const anim = element.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: 'translateY(0)' },
        ],
        {
          duration: FLIP_DURATION_MS,
          easing: FLIP_EASING,
          fill: 'none',
        },
      );

      flipAnimByIdRef.current.set(id, anim);
      anim.onfinish = () => {
        flipAnimByIdRef.current.delete(id);
        element.style.transform = '';
      };
      anim.oncancel = () => {
        flipAnimByIdRef.current.delete(id);
        element.style.transform = '';
      };
    }

    previousTops.current = currentTops;
  }, [items]);

  function beginDrag(item: T, event?: DragEvent<HTMLElement>) {
    if (!isEnabled(item)) return;

    if (event) {
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.id);
        const row = event.currentTarget.closest('li');
        if (row instanceof HTMLElement) {
          const rect = row.getBoundingClientRect();
          event.dataTransfer.setDragImage(
            row,
            Math.max(0, event.clientX - rect.left),
            Math.max(0, event.clientY - rect.top),
          );
        }
      }
    }

    cancelFlipAnimations();
    clearInlineTransformStyles();

    const first = itemRefs.current.values().next().value;
    if (first) flushLayout(first);

    const initialTops = new Map<string, number>();
    for (const [id, element] of itemRefs.current.entries()) {
      initialTops.set(id, element.getBoundingClientRect().top);
    }
    previousTops.current = initialTops;

    draggedIdRef.current = item.id;
    setDraggedId(item.id);
    lastMoveRef.current = null;
    lastReorderAtRef.current = 0;
    pendingReorderRef.current = null;
    if (reorderFlushTimerRef.current) {
      clearTimeout(reorderFlushTimerRef.current);
      reorderFlushTimerRef.current = null;
    }
    onDragStarted?.();
  }

  function finishDrag() {
    if (reorderFlushTimerRef.current) {
      clearTimeout(reorderFlushTimerRef.current);
      reorderFlushTimerRef.current = null;
    }
    const pending = pendingReorderRef.current;
    pendingReorderRef.current = null;
    const stillDragging = draggedIdRef.current;
    if (pending && stillDragging === pending.active) {
      onReorder?.(pending.active, pending.over);
    }
    onDragFinished?.();

    draggedIdRef.current = null;
    setDraggedId(null);
    setHoveredId(null);
    lastMoveRef.current = null;
  }

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
      draggable: handleOnly ? false : enabled,
      onDragStart: () => {
        if (handleOnly) return;
        beginDrag(item);
      },
      onDragOver: (e: DragEvent<HTMLLIElement>) => {
        if (isEventFromNestedList(e)) return;
        if (!enabled) return;
        e.preventDefault();
        const active = draggedIdRef.current;
        if (!active || active === item.id) return;

        setHoveredId(item.id);

        const fromIndex = items.findIndex((t) => t.id === active);
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
        scheduleOrInvokeReorder(active, item.id);
      },
      onDragEnter: (e: DragEvent<HTMLLIElement>) => {
        if (isEventFromNestedList(e)) return;
        if (!enabled || !draggedIdRef.current) return;
        if (item.id !== draggedIdRef.current) {
          setHoveredId(item.id);
        }
      },
      onDragLeave: () => {
        if (hoveredId === item.id) {
          setHoveredId(null);
        }
      },
      onDrop: (e: DragEvent<HTMLLIElement>) => {
        if (isEventFromNestedList(e)) return;
        setHoveredId(null);
        lastMoveRef.current = null;
      },
      onDragEnd: () => {
        if (handleOnly) return;
        finishDrag();
      },
    };
  }

  function getHandleProps(item: T): SortableHandleProps {
    const enabled = isEnabled(item);

    return {
      draggable: enabled,
      disabled: !enabled,
      onDragStart: (event) => {
        if (!enabled) {
          event.preventDefault();
          return;
        }
        beginDrag(item, event);
      },
      onDragEnd: (event) => {
        event.stopPropagation();
        finishDrag();
      },
      onPointerDown: (event) => {
        event.stopPropagation();
      },
      onClick: (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
    };
  }

  return {
    draggedId,
    hoveredId,
    getItemProps,
    getHandleProps,
  };
}
