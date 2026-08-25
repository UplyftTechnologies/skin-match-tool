'use client'

import { useEffect, useState } from 'react'
import { quizAnswersToScoringProfile } from '@/lib/quiz-profile'

export function useScoredProducts() {
    const [quizAnswers, setQuizAnswers] = useState(undefined)
    const [products, setProducts] = useState([])
    const [routine, setRoutine] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

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

    useEffect(() => {
        if (quizAnswers === undefined) return

        const controller = new AbortController()

        async function loadScoredProducts() {
            try {
                setLoading(true)
                const response = quizAnswers
                    ? await fetch('/api/recommend?limit=1000', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(quizAnswersToScoringProfile(quizAnswers)),
                        signal: controller.signal,
                    })
                    : await fetch('/api/products', { signal: controller.signal })
                const payload = await response.json()

                if (!response.ok) {
                    throw new Error(payload.error || 'Unable to score products.')
                }

                setProducts(payload.products || [])
                setRoutine(payload.routine || null)
                setError('')
            } catch (fetchError) {
                if (fetchError.name !== 'AbortError') {
                    setError(fetchError.message)
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }

        loadScoredProducts()
        return () => controller.abort()
    }, [quizAnswers])

    return { products, routine, loading, error, quizAnswers }
}
