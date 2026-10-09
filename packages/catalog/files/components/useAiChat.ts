// A conversation with the host's AI (`bridge.ai.chat`): the messages, the
// reply as it streams in, stop, retry. Without the `ai` capability the
// status is 'unavailable' and nothing throws. Unmounting stops the reply in
// flight. Render it with MessageList and Composer.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createAiChatController, type AiChatMessage, type AiChatStatus } from './aiState';
import { ai, type AiError } from './bridge';

export type { AiChatMessage, AiChatStatus } from './aiState';

export interface UseAiChatOptions {
  /** What the conversation is for (`'skin-advice'`); the host routes on it. */
  purpose?: string;
  /** Instructions sent first, as a system message. */
  system?: string;
  /** The conversation so far, read once on mount. */
  initialMessages?: AiChatMessage[];
}

export interface AiChat {
  messages: AiChatMessage[];
  status: AiChatStatus;
  /** The assistant message being written while `status` is 'streaming': MessageList's `streamingId`. */
  streamingId: string | null;
  /** Why the last call failed; null otherwise. */
  error: AiError | null;
  /** With `rate_limited`, how long the host asks to wait. */
  retryAfterMs: number | null;
  /** Adds the user's message and streams the reply. False when nothing was added (blank text, or a reply still streaming). */
  send: (text: string) => boolean;
  /** Stops the reply and keeps what has arrived. */
  stop: () => void;
  /** Asks again for the reply to the last user message (after an error, a stop or a reply). */
  retry: () => void;
  /** Stops and empties the conversation. */
  reset: () => void;
}

export default function useAiChat(options: UseAiChatOptions = {}): AiChat {
  const latest = useRef(options);
  latest.current = options;
  const [controller] = useState(() =>
    createAiChatController({
      host: ai,
      purpose: () => latest.current.purpose,
      system: () => latest.current.system,
      messages: options.initialMessages,
    }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  useEffect(() => () => controller.stop(), [controller]);
  return {
    messages: state.messages,
    status: state.status,
    streamingId: state.streamingId,
    error: state.error,
    retryAfterMs: state.retryAfterMs,
    send: controller.send,
    stop: controller.stop,
    retry: controller.retry,
    reset: controller.reset,
  };
}
