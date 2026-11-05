// Names of the coded player values, a part of the UI texts beside text.ts. Development types and styles
// are named after the growth curves they pick in fifa.db; the game names no body type.
export type CodedKey = "bodyType" | "developmentType" | "developmentStyle";

const CODE_PREFIXES: Readonly<Record<CodedKey, string>> = {
  bodyType: "typ",
  developmentType: "typ",
  developmentStyle: "styl",
};

// Curves "Early Bloomer", "Regular", "Late Bloomer" and "Normal", "Good", "Elite", "Short Career", "Sudden Rise".
const CODE_NAMES: Readonly<Record<CodedKey, Readonly<Partial<Record<number, string>>>>> = {
  bodyType: {},
  developmentType: { 1: "wczesny", 2: "typowy", 3: "późny" },
  developmentStyle: {
    1: "przeciętny",
    2: "dobry",
    3: "elitarny",
    4: "krótka kariera",
    5: "nagły skok",
  },
};

/** A coded value by name, or its code with a prefix when it has none (any body type, an unknown code). */
export const codeName = (key: CodedKey, value: number): string =>
  CODE_NAMES[key][value] ?? `${CODE_PREFIXES[key]} ${String(value)}`;
