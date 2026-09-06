'use client';

import { createContext, useContext } from 'react';

export type PublicInstance = {
  name: string;
  faviconUrl: string | null;
  publicUrl: string;
  siteUrl: string;
  hue: number;
  saturation: number;
};

const InstanceContext = createContext<PublicInstance | null>(null);

export function InstanceProvider({
  instance,
  children,
}: {
  instance: PublicInstance;
  children: React.ReactNode;
}) {
  return (
    <InstanceContext.Provider value={instance}>
      {children}
    </InstanceContext.Provider>
  );
}

export function useInstance() {
  const instance = useContext(InstanceContext);
  if (!instance) throw new Error('InstanceProvider is missing');
  return instance;
}
