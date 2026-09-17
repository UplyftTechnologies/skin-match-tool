"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

// True only inside the Android/iOS Capacitor shell. The shell loads the live
// site, so the same bundle runs in browsers and in the app; branch on this.
export function isNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

const subscribe = () => () => {};

// The server snapshot is false, so hydration matches the server markup and
// React re-renders with the real value on the client.
export function useIsNativeApp() {
  return useSyncExternalStore(subscribe, isNativeApp, () => false);
}
