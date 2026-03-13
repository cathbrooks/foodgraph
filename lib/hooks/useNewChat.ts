"use client";

import { useEffect, useCallback, useSyncExternalStore } from "react";

const EVENT_NAME = "foodclaw:new-chat";
let _seq = 0;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return _seq;
}

function emitNewChat() {
  _seq += 1;
  listeners.forEach((cb) => cb());
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function useNewChatTrigger() {
  return useCallback(() => emitNewChat(), []);
}

export function useNewChatListener(onReset: () => void) {
  const seq = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (seq > 0) onReset();
  }, [seq, onReset]);
}
