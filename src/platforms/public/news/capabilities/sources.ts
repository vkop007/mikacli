import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { newsAdapter } from "../adapter.js";
import { printNewsSourcesResult } from "../output.js";

export const newsSourcesCapability = createAdapterActionCapability({
  id: "sources",
  command: "sources",
  description: "List the supported no-auth news sources",
  spinnerText: "Loading news sources...",
  successMessage: "News sources loaded.",
  action: () => newsAdapter.sources(),
  onSuccess: printNewsSourcesResult,
});
