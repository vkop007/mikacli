import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printCookieLlmStatusResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const status = typeof result.data?.status === "string" ? result.data.status : undefined;
  const validated = typeof result.data?.lastValidatedAt === "string" ? result.data.lastValidatedAt : undefined;

  if (status) {
    console.log(`status: ${status}`);
  }
  if (validated) {
    console.log(`validated: ${validated}`);
  }
}

export function printCookieLlmTextResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const outputText = typeof result.data?.outputText === "string" ? result.data.outputText : undefined;
  if (outputText) {
    console.log("");
    console.log(outputText);
  }
}

export function printCookieLlmMediaResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const jobId = typeof result.data?.jobId === "string" ? result.data.jobId : undefined;
  const status = typeof result.data?.status === "string" ? result.data.status : undefined;
  const progress = typeof result.data?.progress === "number" ? result.data.progress : undefined;
  const conversationId = typeof result.data?.conversationId === "string" ? result.data.conversationId : undefined;
  const providerJobId =
    typeof result.data?.videoId === "string"
      ? result.data.videoId
      : typeof result.data?.providerJobId === "string"
        ? result.data.providerJobId
        : undefined;
  const outputText = typeof result.data?.outputText === "string" ? result.data.outputText : undefined;
  const outputUrl = typeof result.data?.outputUrl === "string" ? result.data.outputUrl : undefined;
  const outputUrls = Array.isArray(result.data?.outputUrls)
    ? result.data.outputUrls.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  const outputPaths = Array.isArray(result.data?.outputPaths)
    ? result.data.outputPaths.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];

  if (jobId) {
    console.log(`job: ${jobId}`);
  }
  if (status) {
    console.log(`status: ${status}`);
  }
  if (typeof progress === "number") {
    console.log(`progress: ${progress}`);
  }
  if (conversationId) {
    console.log(`conversation: ${conversationId}`);
  }
  if (providerJobId) {
    console.log(`provider-job: ${providerJobId}`);
  }

  if (outputText) {
    console.log("");
    console.log(outputText);
  }

  if (outputPaths.length > 0) {
    for (const nextPath of outputPaths) {
      console.log(`file: ${nextPath}`);
    }
  }

  if (outputUrl) {
    console.log(`output: ${outputUrl}`);
  } else if (outputUrls.length > 0) {
    for (const nextUrl of outputUrls) {
      console.log(`output: ${nextUrl}`);
    }
  }
}

export function printCookieLlmMediaJobResult(result: AdapterActionResult, json: boolean): void {
  printCookieLlmMediaResult(result, json);
}
