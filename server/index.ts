import { startServer } from "./app";

startServer().catch((error) => {
  console.error("Server start failed:", error);
  process.exit(1);
});
