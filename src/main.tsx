import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app.tsx";
import "./ui/styles.css";

const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root element in index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker keeps the app for offline use (scripts/service-worker-template.js); production builds
// only. Relative to the page, so the app works at the site root and under a sub-path.
if (import.meta.env.PROD && isSecureContext && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js", { scope: "./", updateViaCache: "none" })
    .catch(() => undefined);
}
