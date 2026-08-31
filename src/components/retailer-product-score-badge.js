'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import { quizAnswersToScoringProfile } from '@/lib/quiz-profile'
import { getSavedSkinProfile } from '@/lib/profile-storage'
import { getScoreBand } from '@/lib/score-band'

// Mirrors the profile shape /api/retailer-products/catalog expects (built
// from URL params in use-retailer-catalog.js's buildQuery) — the scoring
// engine keys on `skinType`/`concern`/`specialConditions`, not the
// `selectedSkinType`/... shape quizAnswersToScoringProfile returns.
function toCatalogScoringProfile(profile) {
    if (!profile?.selectedSkinType) return null
    const concern = [
        ...(profile.selectedFaceBodyConcerns || []),
        ...(profile.selectedLipsEyesConcerns || []),
    ].find((item) => item && item !== 'None')
    const specialConditions = (profile.selectedSpecialConditions || []).filter(Boolean)

    return {
        skinType: profile.selectedSkinType,
        sensitive: Boolean(profile.selectedSensitive),
        age: profile.age || 'Adult',
        concern: concern || 'None',
        specialConditions: specialConditions.length ? specialConditions : ['None'],
    }
}

export default function RetailerProductScoreBadge({ productUrl, restricted, fallbackUrls }) {
    const quizAnswers = useQuizAnswers()
    const [savedProfile, setSavedProfile] = useState(null)
    const [scoring, setScoring] = useState(null)

    useEffect(() => {
        const timer = setTimeout(() => {
            setSavedProfile(getSavedSkinProfile()?.profile || null)
        }, 0)
        return () => clearTimeout(timer)
    }, [quizAnswers])

    // No quiz/saved profile means there is nothing real to score against, so
    // the badge stays hidden rather than showing a number scored against a
    // generic default profile that isn't actually this shopper's skin.
    const scoringProfile = useMemo(() => {
        if (quizAnswers) return quizAnswersToScoringProfile(quizAnswers)
        return savedProfile?.selectedSkinType ? savedProfile : null
    }, [quizAnswers, savedProfile])

    const catalogProfile = useMemo(() => toCatalogScoringProfile(scoringProfile), [scoringProfile])

    useEffect(() => {
        if (!catalogProfile || !productUrl) {
            setScoring(null)
            return undefined
        }

        const controller = new AbortController()
        fetch('/api/retailer-products/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productUrl, fallbackUrls, restricted, profile: catalogProfile }),
            signal: controller.signal,
        })
            .then((response) => response.json())
            .then((payload) => setScoring(payload.scoring || null))
            .catch((error) => {
                if (error.name !== 'AbortError') setScoring(null)
            })

        return () => controller.abort()
    }, [productUrl, fallbackUrls, restricted, catalogProfile])

    if (!scoring || !Number.isFinite(Number(scoring.score))) return null

    const score = Math.max(0, Math.min(100, Math.round(Number(scoring.score))))
    const band = getScoreBand(score)

    return (
        <div className={`score-badge score-${band.key}`} style={{ backgroundColor: band.fill }}>
            <div>
                {scoring.blocked ? '—' : score}
                <small>{scoring.blocked ? 'Blocked' : band.label}</small>
            </div>
        </div>
    )
}
