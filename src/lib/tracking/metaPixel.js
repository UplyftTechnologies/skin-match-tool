'use client';

function callFbq(...args) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  try {
    window.fbq(...args);
  } catch (error) {
    console.warn('[meta-pixel] call failed:', error);
  }
}

/** e.g. trackMetaPixelCustom('quiz_started') */
export function trackMetaPixelCustom(eventName, params) {
  callFbq('trackCustom', eventName, params);
}

/** For Meta's standard events (PageView, CompleteRegistration, ...). */
export function trackMetaPixelStandard(eventName, params) {
  callFbq('track', eventName, params);
}
