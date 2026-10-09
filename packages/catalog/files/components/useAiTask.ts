// One call to the host's AI at a time, with progress and cancel: identify a
// photo (`describeImage`), generate images (`generateImage`), transcribe a
// recording. `run` receives the host's `ai`, a `{ signal, onProgress }` to
// pass on, and the arguments given to `start`. Without the `ai` capability
// the status is 'unavailable' and nothing throws. Unmounting cancels.
//
//   const scan = useAiTask((ai, { signal }, uri: string) =>
//     ai.describeImage({ uri }, 'Which product is this?', { signal }));
//   scan.start(photo);  // scan.status, scan.result?.text

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createAiTaskController, type AiTaskRun, type AiTaskStatus } from './aiState';
import { ai, type AiError } from './bridge';

export type { AiTaskContext, AiTaskRun, AiTaskStatus } from './aiState';

export interface AiTask<A extends unknown[], T> {
  status: AiTaskStatus;
  /** The last successful result (`{ text }`, `{ uris }`). It stays during a new run and after a cancel or a failure. */
  result: T | null;
  /** 0–1 while running, when the host reports progress; null otherwise. */
  progress: number | null;
  /** Why the last run failed; null otherwise. */
  error: AiError | null;
  /** With `rate_limited`, how long the host asks to wait. */
  retryAfterMs: number | null;
  /** Runs the call; a run still going is aborted first. */
  start: (...args: A) => void;
  /** Aborts the run; the last result stays. */
  cancel: () => void;
  /** Aborts and forgets the result. */
  reset: () => void;
}

export default function useAiTask<A extends unknown[], T>(run: AiTaskRun<A, T>): AiTask<A, T> {
  const latest = useRef(run);
  latest.current = run;
  const [controller] = useState(() => createAiTaskController<A, T>({ host: ai, run: () => latest.current }));
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  useEffect(() => () => controller.cancel(), [controller]);
  return {
    status: state.status,
    result: state.result,
    progress: state.progress,
    error: state.error,
    retryAfterMs: state.retryAfterMs,
    start: controller.start,
    cancel: controller.cancel,
    reset: controller.reset,
  };
}
