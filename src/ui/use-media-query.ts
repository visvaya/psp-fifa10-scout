import { useCallback, useSyncExternalStore } from "react";

/** Wide layout (table and side panel) from this width; matches --layout-wide in styles.css. */
export const WIDE_QUERY = "(min-width: 60rem)";

/** Whether a CSS media query matches, following changes; subscribed again only when the query changes. */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = globalThis.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  const getSnapshot = useCallback(() => globalThis.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot);
};
