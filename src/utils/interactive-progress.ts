type InteractiveProgressHandler = (message: string) => void;

let interactiveProgressHandler: InteractiveProgressHandler | null = null;

export function setInteractiveProgressHandler(handler: InteractiveProgressHandler | null): void {
  interactiveProgressHandler = handler;
}

export function emitInteractiveProgress(message: string): boolean {
  if (!interactiveProgressHandler) {
    return false;
  }

  interactiveProgressHandler(message);
  return true;
}
