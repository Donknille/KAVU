import { startServer } from "./app.js";

startServer().catch((error) => {
  console.error("Server start failed:", error);
  process.exit(1);
});
