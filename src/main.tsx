import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app.tsx";
import "./ui/styles.css";

const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root element in index.html");

// The service worker keeps the app for offline use (scripts/service-worker-template.js); production builds
// only. Relative to the page, so the app works at the site root and under a sub-path. A failed
// registration reaches the update prompt, which says the app does not work offline.
const registering =
  import.meta.env.PROD && isSecureContext && "serviceWorker" in navigator
    ? navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" })
    : null;

createRoot(container).render(
  <StrictMode>
    <App registering={registering} />
  </StrictMode>,
);
