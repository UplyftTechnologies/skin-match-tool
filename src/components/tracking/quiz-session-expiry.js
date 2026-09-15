'use client'

import { useEffect } from 'react'
import { getLoggedInUserId } from '@/lib/tracking/identity'

const QUIZ_ANSWERS_KEY = 'roopsee-quiz-answers'
const PROFILE_KEY = 'roopsee_skin_profile'
const LAST_HIDDEN_KEY = 'roopsee-quiz-last-hidden-at'
const EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

// Mobile browsers keep a tab alive in the background when the user just
// switches apps (Home, another app, a call) rather than actually closing it,
// so the sessionStorage reset in profile-storage.js never fires in that
// case — the tab never dies. This adds a soft timeout on top of that: if the
// tab sat hidden for longer than EXPIRY_MS, the guest's saved quiz/profile is
// cleared the next time the tab becomes visible again, same as if they'd
// closed and reopened it. Logged-in users are exempt — their quiz is backed
// by the server (see quiz-rehydrator.js) and shouldn't need retaking just
// because the app sat in the background.
export default function QuizSessionExpiry() {
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        try {
          sessionStorage.setItem(LAST_HIDDEN_KEY, String(Date.now()))
        } catch {
          // ignore
        }
        return
      }

      try {
        const hiddenAt = Number(sessionStorage.getItem(LAST_HIDDEN_KEY))
        sessionStorage.removeItem(LAST_HIDDEN_KEY)
        if (!Number.isFinite(hiddenAt) || hiddenAt <= 0) return
        if (Date.now() - hiddenAt < EXPIRY_MS) return
        if (getLoggedInUserId()) return

        sessionStorage.removeItem(QUIZ_ANSWERS_KEY)
        sessionStorage.removeItem(PROFILE_KEY)
        window.dispatchEvent(new CustomEvent('roopsee-quiz-answers-updated', { detail: null }))
      } catch {
        // ignore
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return null
}
