// lib/profile-storage.js
const PROFILE_KEY = "roopsee_skin_profile";

export function saveSkinProfile(profile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ profile, savedAt: new Date().toISOString() })
    );
  } catch {
    // ignore write failures (private browsing, storage full, etc.)
  }
}

export function getSavedSkinProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}