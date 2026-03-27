import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";

export const poeAdapter = new CookieLlmAdapter({
  platform: "poe",
  textUnsupportedMessage:
    "Poe text prompting is scaffolded, but the private browserless web request flow still needs live validation before this command can run reliably.",
  imageUnsupportedMessage:
    "Poe image prompting is scaffolded, but the private upload flow still needs live validation before this command can run reliably.",
  videoUnsupportedMessage:
    "Poe video prompting is not implemented in this CLI because the browserless web video flow is not mapped yet.",
});
