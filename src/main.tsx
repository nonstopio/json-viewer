import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import {applyBrandToDocument} from "./brand.ts";
import "./index.css";

// The edge function already brands the served HTML per Host; this covers local
// dev, deploy previews and the ?brand= override.
applyBrandToDocument();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
