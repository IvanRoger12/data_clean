import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css"; // Assurez-vous que ce fichier importe les directives Tailwind
import { DataCleaningAgent } from "./DataCleaningAgent"; // <- CORRIGÉ

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DataCleaningAgent /> {/* <- CORRIGÉ */}
  </React.StrictMode>
);
