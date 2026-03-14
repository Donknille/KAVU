import { createRoot } from "react-dom/client";
import App from "./App";
import { registerServiceWorker } from "@/lib/pwa";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./index.css";

registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
