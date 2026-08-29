'use client'

import { useEffect, useState } from 'react'
import { quizAnswersToScoringProfile } from '@/lib/quiz-profile'

let unscoredProductsPromise = null
const scoredProductsByProfile = new Map()

async function readJson(response) {
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to score products.')
    return payload
}

function fetchUnscoredProducts() {
    if (!unscoredProductsPromise) {
        unscoredProductsPromise = fetch('/api/products?summary=1')
            .then(readJson)
            .catch((error) => {
                unscoredProductsPromise = null
                throw error
            })
    }
    return unscoredProductsPromise
}

function fetchScoredProducts(profile) {
    const key = JSON.stringify(profile)
    if (!scoredProductsByProfile.has(key)) {
        const request = fetch('/api/recommend?limit=1000&summary=1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile),
        })
            .then(readJson)
            .catch((error) => {
                scoredProductsByProfile.delete(key)
                throw error
            })
        scoredProductsByProfile.set(key, request)
    }
    return scoredProductsByProfile.get(key)
}

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

        let active = true

        async function loadScoredProducts() {
            try {
                setLoading(true)
                const payload = quizAnswers
                    ? await fetchScoredProducts(quizAnswersToScoringProfile(quizAnswers))
                    : await fetchUnscoredProducts()

                if (!active) return
                setProducts(payload.products || [])
                setRoutine(payload.routine || null)
                setError('')
            } catch (fetchError) {
                if (active) {
                    setError(fetchError.message)
                }
            } finally {
                if (active) setLoading(false)
            }
        }

        loadScoredProducts()
        return () => {
            active = false
        }
    }, [quizAnswers])

    return { products, routine, loading, error, quizAnswers }
}
