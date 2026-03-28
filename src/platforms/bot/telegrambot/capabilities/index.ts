import { telegrambotChatsCapability, telegrambotGetChatCapability, telegrambotMeCapability, telegrambotUpdatesCapability } from "./me.js";
import { telegrambotLoginCapability } from "./login.js";
import { telegrambotDeleteCapability, telegrambotEditCapability } from "./messages.js";
import {
  telegrambotSendAudioCapability,
  telegrambotSendCapability,
  telegrambotSendDocumentCapability,
  telegrambotSendPhotoCapability,
  telegrambotSendVideoCapability,
  telegrambotSendVoiceCapability,
} from "./messages.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const telegrambotCapabilities: readonly PlatformCapability[] = [
  telegrambotLoginCapability,
  telegrambotMeCapability,
  telegrambotGetChatCapability,
  telegrambotChatsCapability,
  telegrambotUpdatesCapability,
  telegrambotSendCapability,
  telegrambotSendPhotoCapability,
  telegrambotSendDocumentCapability,
  telegrambotSendVideoCapability,
  telegrambotSendAudioCapability,
  telegrambotSendVoiceCapability,
  telegrambotEditCapability,
  telegrambotDeleteCapability,
];
