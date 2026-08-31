// Persists the shopper's step-by-step routine selections (AM/PM, one product
// per step) across visits — separate from profile-storage.js, which only
// holds quiz answers, not what a shopper picked for each routine step.
const ROUTINE_KEY = 'roopsee_routine'

export function saveRoutine(routine) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ROUTINE_KEY, JSON.stringify({ routine, savedAt: new Date().toISOString() }))
    // Same pattern as roopsee-quiz-answers-updated (use-quiz-answers.js) — lets
    // the header badge update immediately without a full page reload.
    window.dispatchEvent(new CustomEvent('roopsee-routine-updated'))
  } catch {
    // ignore write failures (private browsing, storage full, etc.)
  }
}

export function getSavedRoutine() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ROUTINE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
