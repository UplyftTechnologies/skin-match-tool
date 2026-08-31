'use client'

import { useEffect, useState } from 'react'
import { getSavedRoutine } from '@/lib/routine-storage'
import { STEPS_BY_TIME } from '@/lib/routine-steps'

// Only counts (time, step) pairs that are still valid slots — a saved
// routine can carry entries from an earlier version of STEPS_BY_TIME (e.g.
// "sunscreen" was once a PM step too), and those orphaned entries should not
// inflate the badge past what the AM/PM tabs actually show.
function countRoutineItems(routine) {
    if (!routine) return 0
    return Object.entries(STEPS_BY_TIME).reduce(
        (total, [time, ids]) => total + ids.filter((id) => Boolean(routine[time]?.[id])).length,
        0,
    )
}

// Mirrors useQuizAnswers' shape (deferred localStorage read + a custom event
// for same-tab updates) so the header badge reflects an "Add to Routine" pick
// immediately, without a full page reload.
export function useRoutineCount() {
    const [count, setCount] = useState(0)

    useEffect(() => {
        const update = () => setCount(countRoutineItems(getSavedRoutine()?.routine))
        const timer = setTimeout(update, 0)
        window.addEventListener('roopsee-routine-updated', update)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('roopsee-routine-updated', update)
        }
    }, [])

    return count
}
