import cron from "node-cron";
import { checkAllActiveSavedSearches } from "../services/savedSearchChecker.js";

const EVERY_THREE_HOURS = "0 */3 * * *";

let checkInProgress = false;

export function startScheduledFlightChecks() {
  cron.schedule(EVERY_THREE_HOURS, async () => {
    if (checkInProgress) {
      console.log("Skipping scheduled flight check because another check is still running.");
      return;
    }

    checkInProgress = true;

    try {
      const summary = await checkAllActiveSavedSearches();

      console.log(
        `Scheduled flight check complete: checked ${summary.checkedCount} saved alerts, created ${summary.batchesCreated} result batches.`
      );
    } catch (error) {
      console.error("Scheduled flight check failed.", error);
    } finally {
      checkInProgress = false;
    }
  });

  console.log("Scheduled flight checks enabled: running every 3 hours.");
}
