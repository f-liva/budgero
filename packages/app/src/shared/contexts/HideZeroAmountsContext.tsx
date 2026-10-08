/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

const HideZeroAmountsContext = createContext(false);

export function HideZeroAmountsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <HideZeroAmountsContext.Provider value={enabled}>{children}</HideZeroAmountsContext.Provider>
  );
}

/** Whether zero transaction amounts render as empty cells (Appearance setting). */
export function useHideZeroAmountsEnabled(): boolean {
  return useContext(HideZeroAmountsContext);
}
