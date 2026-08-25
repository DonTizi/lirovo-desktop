import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./globals.css";

/**
 * Reserve the macOS traffic lights, once.
 *
 * Published as a CSS variable rather than threaded through as a prop, so no
 * surface needs to know which platform it is on and there is no number to get
 * wrong in a second place.
 */
if (navigator.platform.startsWith("Mac")) {
  document.documentElement.style.setProperty("--liq-traffic-inset", "78px");
}

const root = document.getElementById("root");
if (root === null) throw new Error("no #root in the document");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
