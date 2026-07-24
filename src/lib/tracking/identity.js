// lib/tracking/identity.js
// NOTE: this file didn't exist in what you sent me — your client tracking
// service imported getVisitorId/getSessionId/getLoggedInUser* from
// './tracking.js', which wasn't in the upload. This is a fresh implementation
// of the same idea. Everything here is client-only (localStorage/
// sessionStorage), so only import this from "use client" files.

const VISITOR_ID_KEY = 'app_visitor_id';
const SESSION_ID_KEY = 'app_session_id';
const USER_STORAGE_KEY = 'app_user'; // <-- point this at wherever your auth flow stores the logged-in user

function safeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Persistent per-browser id. Survives refreshes and new tabs. */
export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = safeUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Per-tab id. Regenerates on a fresh tab, cleared when the tab closes. */
export function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = safeUUID();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Call this from your login/signup flow once the user is authenticated, e.g:
 *   setLoggedInUser({ id: user.id, name: user.name, phone: user.phone })
 * Call with null on logout.
 */
export function setLoggedInUser(user) {
  try {
    if (!user) {
      localStorage.removeItem(USER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function getLoggedInUserId() {
  return readStoredUser()?.id || null;
}

export function getLoggedInUserName() {
  return readStoredUser()?.name || '';
}

export function getLoggedInUserPhone() {
  return readStoredUser()?.phone || '';
}

/**
 * Pushes the current identity into every connected analytics tool so events
 * from before and after login get stitched to the same person. Safe to call
 * even if a given tool isn't loaded yet.
 */
export function identifyAcrossTools() {
  if (typeof window === 'undefined') return;

  const userId = getLoggedInUserId();
  if (!userId) return;

  try {
    window.gtag?.('set', { user_id: userId });
  } catch {
    /* ignore */
  }

  try {
    window.clarity?.('set', 'user_id', userId);
  } catch {
    /* ignore */
  }

  try {
    const amplitude = window.amplitude;
    amplitude?.setUserId?.(userId);
  } catch {
    /* ignore */
  }
}