import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printDataActionResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  console.log(result.message);

  const outputPath = typeof result.data?.outputPath === "string" ? result.data.outputPath : undefined;
  if (outputPath) {
    console.log(`output: ${outputPath}`);
  }

  const content = typeof result.data?.content === "string" ? result.data.content : undefined;
  if (content) {
    console.log("");
    console.log(content);
    return;
  }

  if (result.data && Object.keys(result.data).length > 0) {
    const { outputPath: _outputPath, ...rest } = result.data;
    if (Object.keys(rest).length > 0) {
      console.log("");
      printJson(rest);
    }
  }
}
