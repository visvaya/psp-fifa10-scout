import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { activeRegistration } from "./ui/app-update.ts";
import { App } from "./ui/app.tsx";
import "./ui/styles.css";

const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root element in index.html");

// The service worker keeps the app for offline use (scripts/service-worker-template.js); production builds
// only. Relative to the page, so the app works at the site root and under a sub-path. A failed
// registration, or a first worker that could not store the app, reaches the update prompt, which says the
// app does not work offline. The registration counts once the first worker is active: an update check
// while the app is still being stored would take that worker for a release and stay at "downloading".
const registering =
  import.meta.env.PROD && isSecureContext && "serviceWorker" in navigator
    ? navigator.serviceWorker
        .register("./sw.js", { scope: "./", updateViaCache: "none" })
        .then(async (registration) =>
          activeRegistration(registration, navigator.serviceWorker.ready),
        )
    : null;

createRoot(container).render(
  <StrictMode>
    <App registering={registering} />
  </StrictMode>,
);
