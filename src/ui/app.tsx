import type { JSX } from "react";
import { TEXT } from "./text.ts";

export const App = (): JSX.Element => (
  <main>
    <h1>{TEXT.appTitle}</h1>
  </main>
);
