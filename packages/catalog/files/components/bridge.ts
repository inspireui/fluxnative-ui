// The host bridge, when there is one. FluxBuilder's WebView exposes
// `globalThis.flux`; FluxNative provides `storage.get/set` and `ui.toast`;
// the dashboard preview has none. Always optional-chain.

export interface FluxBridge {
  ui?: {
    haptic?: (kind: 'light' | 'selection' | 'medium') => void;
    toast?: (message: string) => void;
  };
  storage?: {
    get?: (key: string) => Promise<string | null> | string | null;
    set?: (key: string, value: string) => Promise<void> | void;
  };
}

export function bridge(): FluxBridge | null {
  const host = globalThis as { flux?: FluxBridge };
  return host.flux ?? null;
}

let reduceMotion = false;

/** Snapshot of the reduce-motion setting; `watchReduceMotion` keeps it fresh. */
export function prefersReducedMotion(): boolean {
  return reduceMotion;
}

export function setReducedMotion(value: boolean): void {
  reduceMotion = value;
}
