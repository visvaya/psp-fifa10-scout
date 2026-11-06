import { useEffect, useRef } from "react";
import type { JSX } from "react";

// The description of the tool is written once, as static HTML in index.html, so search engines read it without
// running a script. React replaces the page's placeholder when the app starts; this keeps the node and puts it
// back on the start screen. Read when the module loads, while the placeholder still holds it.
const description = document.getElementById("about");

export const About = (): JSX.Element => {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (description !== null) host.current?.append(description);
  }, []);
  return <div ref={host} />;
};
