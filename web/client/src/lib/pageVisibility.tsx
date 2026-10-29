import { createContext, useContext, type ReactNode } from "react";

// Pages stay mounted (hidden) so form drafts survive tab switches; this tells a
// hidden page when it is shown again so it can refresh its lists.
const PageVisibleContext = createContext(true);

export function PageVisibleProvider({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  return <PageVisibleContext.Provider value={visible}>{children}</PageVisibleContext.Provider>;
}

export function usePageVisible(): boolean {
  return useContext(PageVisibleContext);
}
