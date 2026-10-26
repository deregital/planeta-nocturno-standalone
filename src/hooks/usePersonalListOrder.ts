'use client';

import { arrayMove } from '@dnd-kit/sortable';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import { useSortableList } from '@/hooks/useSortableList';
import { type EventListScope } from '@/lib/event-list-order';
import { trpc } from '@/server/trpc/client';

type SortLockApi = {
  locked: boolean;
  setSourceLocked: (id: string, locked: boolean) => void;
};

const EventListSortLockContext = createContext<SortLockApi | null>(null);

export function EventListSortLockProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [sources, setSources] = useState<ReadonlySet<string>>(new Set());
  const setSourceLocked = useCallback((id: string, locked: boolean) => {
    setSources((current) => {
      if (current.has(id) === locked) return current;
      const next = new Set(current);
      if (locked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ locked: sources.size > 0, setSourceLocked }),
    [setSourceLocked, sources],
  );

  return createElement(EventListSortLockContext.Provider, { value }, children);
}

type OrderItem = { kind: 'folder' | 'event'; id: string };

function orderKey(items: OrderItem[]) {
  return items.map((item) => `${item.kind}:${item.id}`).join('|');
}

function applyOrderIds<T extends { id: string }>(
  items: T[],
  orderIds: string[],
) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const next: T[] = [];
  for (const id of orderIds) {
    const item = byId.get(id);
    if (item) next.push(item);
  }
  if (next.length === items.length) return next;

  const seen = new Set(orderIds);
  for (const item of items) {
    if (!seen.has(item.id)) next.push(item);
  }
  return next;
}

export function usePersonalListOrder<T extends { id: string }>({
  items,
  enabled,
  scope,
  containerKey,
  toInput,
}: {
  items: T[];
  enabled: boolean;
  scope?: EventListScope;
  containerKey: string;
  toInput: (items: T[]) => OrderItem[];
}) {
  const toInputRef = useRef(toInput);
  toInputRef.current = toInput;

  const [orderIds, setOrderIds] = useState<string[] | null>(null);
  const ordered = useMemo(
    () => (orderIds ? applyOrderIds(items, orderIds) : items),
    [items, orderIds],
  );
  const latestRef = useRef(ordered);
  latestRef.current = ordered;
  const snapshotRef = useRef(ordered);
  const committedKeyRef = useRef(orderKey(toInput(items)));
  const revertRef = useRef<(message: string) => void>(() => {});

  const mutation = trpc.events.reorderMyList.useMutation();
  const sortLock = useContext(EventListSortLockContext);
  const sortSourceId = useId();
  const setSourceLocked = sortLock?.setSourceLocked;

  useEffect(() => {
    if (!setSourceLocked) return;
    setSourceLocked(sortSourceId, mutation.isPending);
    return () => setSourceLocked(sortSourceId, false);
  }, [mutation.isPending, setSourceLocked, sortSourceId]);

  const interactionLocked = (sortLock?.locked ?? false) || mutation.isPending;

  revertRef.current = (message: string) => {
    toast.error(message);
    const snapshot = snapshotRef.current;
    latestRef.current = snapshot;
    setOrderIds(snapshot.map((item) => item.id));
  };

  const sortable = useSortableList({
    items: ordered,
    handleOnly: true,
    isEnabled: () => enabled && Boolean(scope) && !interactionLocked,
    onDragStarted: () => {
      snapshotRef.current = latestRef.current;
    },
    onReorder: (activeId, overId) => {
      const current = latestRef.current;
      const fromIndex = current.findIndex((item) => item.id === activeId);
      const toIndex = current.findIndex((item) => item.id === overId);
      if (fromIndex === -1 || toIndex === -1) return;
      const next = arrayMove(current, fromIndex, toIndex);
      latestRef.current = next;
      setOrderIds(next.map((item) => item.id));
    },
    onDragFinished: () => {
      if (!enabled || !scope) return;
      const next = latestRef.current;
      const payload = toInputRef.current(next);
      if (payload.length === 0) return;
      const nextKey = orderKey(payload);
      if (nextKey === committedKeyRef.current) return;
      committedKeyRef.current = nextKey;
      mutation.mutate(
        { scope, containerKey, items: payload },
        {
          onError: (error) => {
            committedKeyRef.current = orderKey(
              toInputRef.current(snapshotRef.current),
            );
            revertRef.current(error.message);
          },
        },
      );
    },
  });

  useEffect(() => {
    if (mutation.isPending || sortable.draggedId) return;
    const incomingKey = orderKey(toInputRef.current(items));
    if (incomingKey !== committedKeyRef.current) return;
    setOrderIds(null);
  }, [items, mutation.isPending, sortable.draggedId]);

  return {
    ordered,
    draggedId: sortable.draggedId,
    hoveredId: sortable.hoveredId,
    getItemProps: sortable.getItemProps,
    getHandleProps: sortable.getHandleProps,
  };
}
