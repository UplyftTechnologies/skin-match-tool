"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native-app";

const APP_HOSTS = new Set(["roopsee.com", "www.roopsee.com"]);

function isExternalUrl(href) {
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return !APP_HOSTS.has(url.hostname) && url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

// Wires the site into the native shell: hides the splash, handles the Android
// back button, routes deep links, and opens retailer and other external links
// in an in-app browser tab instead of replacing the app's WebView. Renders
// nothing and does nothing in a regular browser.
export default function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    document.documentElement.classList.add("native-app");

    let cancelled = false;
    const listeners = [];
    let openExternal = (url) => window.location.assign(url);

    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || !isExternalUrl(anchor.href)) return;
      event.preventDefault();
      openExternal(anchor.href);
    };
    document.addEventListener("click", onClick, true);

    const originalOpen = window.open;
    window.open = (url, ...rest) => {
      if (url && isExternalUrl(String(url))) {
        openExternal(new URL(String(url), window.location.href).toString());
        return null;
      }
      return originalOpen.call(window, url, ...rest);
    };

    (async () => {
      const [{ App }, { Browser }, { SplashScreen }, { StatusBar, Style }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
      ]);
      if (cancelled) return;

      openExternal = (url) => Browser.open({ url, toolbarColor: "#fff9f2" });

      SplashScreen.hide().catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});

      listeners.push(
        await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        }),
        await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const target = new URL(url);
            if (APP_HOSTS.has(target.hostname)) {
              router.push(`${target.pathname}${target.search}${target.hash}`);
            }
          } catch {
            // Not a URL we route.
          }
        }),
      );
      if (cancelled) listeners.forEach((listener) => listener.remove());
    })().catch((error) => console.warn("[native] bridge setup failed:", error));

    return () => {
      cancelled = true;
      document.removeEventListener("click", onClick, true);
      window.open = originalOpen;
      listeners.forEach((listener) => listener.remove());
    };
  }, [router]);

  return null;
}
