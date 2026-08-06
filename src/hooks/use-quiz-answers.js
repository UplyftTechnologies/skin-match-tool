'use client'

import { useEffect, useState } from 'react'

// Mirrors the sessionStorage read in useScoredProducts, but without the
// products fetch — for components that only need to know whether the quiz
// has been completed yet.
export function useQuizAnswers() {
    const [quizAnswers, setQuizAnswers] = useState(undefined)

    useEffect(() => {
        const restoreTimer = setTimeout(() => {
            try {
                setQuizAnswers(JSON.parse(sessionStorage.getItem('roopsee-quiz-answers') || 'null'))
            } catch {
                sessionStorage.removeItem('roopsee-quiz-answers')
                setQuizAnswers(null)
            }
        }, 0)

        const updateAnswers = (event) => setQuizAnswers(event.detail)
        window.addEventListener('roopsee-quiz-answers-updated', updateAnswers)

        return () => {
            clearTimeout(restoreTimer)
            window.removeEventListener('roopsee-quiz-answers-updated', updateAnswers)
        }
    }, [])

    return quizAnswers
}
