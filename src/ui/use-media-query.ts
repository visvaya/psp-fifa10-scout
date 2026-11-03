import { useSyncExternalStore } from "react";

/** Whether a CSS media query matches, following changes. */
export const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    (onChange) => {
      const list = globalThis.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    () => globalThis.matchMedia(query).matches,
  );
