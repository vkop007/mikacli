import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";

export class ChatGptAdapter extends CookieLlmAdapter {
  constructor() {
    super({
      platform: "chatgpt",
      defaultModel: "auto",
      textUnsupportedMessage:
        "ChatGPT text prompting is scaffolded, but the private web request flow still needs a live session capture because ChatGPT is protected by dynamic challenge and sentinel tokens.",
      imageUnsupportedMessage:
        "ChatGPT image prompting is scaffolded, but the private upload and attachment flow still needs live session capture before this command can run reliably.",
      videoUnsupportedMessage:
        "ChatGPT video prompting is not wired yet in this CLI because the private media-generation flow is still being mapped.",
    });
  }
}

export const chatgptAdapter = new ChatGptAdapter();
