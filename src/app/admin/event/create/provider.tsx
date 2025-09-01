'use client';

import { type ReactNode, createContext, useRef, useContext } from 'react';
import { useStore } from 'zustand';

import {
  createEventStore,
  type CreateEventStore,
} from '@/app/admin/event/create/state';

export type CreateEventStoreApi = ReturnType<typeof createEventStore>;

export const CreateEventStoreContext = createContext<
  CreateEventStoreApi | undefined
>(undefined);

export interface CreateEventStoreProviderProps {
  children: ReactNode;
}

export function CreateEventStoreProvider({
  children,
}: CreateEventStoreProviderProps) {
  const storeRef = useRef<CreateEventStoreApi | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createEventStore();
  }

  return (
    <CreateEventStoreContext.Provider value={storeRef.current}>
      {children}
    </CreateEventStoreContext.Provider>
  );
}

export const useCreateEventStore = <T,>(
  selector: (store: CreateEventStore) => T,
): T => {
  const createEventStoreContext = useContext(CreateEventStoreContext);

  if (!createEventStoreContext) {
    throw new Error(
      `useCreateEventStore must be used within CreateEventStoreProvider`,
    );
  }

  return useStore(createEventStoreContext, selector);
};
