/**
 * A value made on its first use and kept, for objects too costly to build while the app loads: an Intl
 * object loads its locale data, a long task at the start of a slow phone.
 */
export const lazy = <T>(make: () => T): (() => T) => {
  let made: { readonly value: T } | null = null;
  return () => {
    made ??= { value: make() };
    return made.value;
  };
};
