import { app } from "./app.js";
import { env } from "./config/env.js";
import { startScheduledFlightChecks } from "./jobs/scheduledFlightChecks.js";

app.listen(env.PORT, () => {
  console.log(`FarePing API listening on http://localhost:${env.PORT}`);
  startScheduledFlightChecks();
});
