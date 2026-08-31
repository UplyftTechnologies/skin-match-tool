'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import { getSavedSkinProfile } from '@/lib/profile-storage'
import MatchMySkin from '@/components/homeComponents/MatchMySkin'

// Blocks its children — a product grid, a brand list, a product detail view —
// until the shopper has a real quiz answer or saved profile. Nothing renders
// until both signals have loaded, so a visitor without a profile never sees a
// flash of gated products before this replaces them with the quiz prompt.
export default function RequireQuizGate({ children, title, description, hideCta = false, navigateToHomeQuiz = false }) {
    const quizAnswers = useQuizAnswers()
    const [savedProfile, setSavedProfile] = useState(null)
    const [savedProfileLoaded, setSavedProfileLoaded] = useState(false)
    const [quizOpen, setQuizOpen] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setSavedProfile(getSavedSkinProfile()?.profile || null)
            setSavedProfileLoaded(true)
        }, 0)
        return () => clearTimeout(timer)
    }, [quizAnswers])

    const hasProfile = useMemo(
        () => Boolean(quizAnswers) || Boolean(savedProfile?.selectedSkinType),
        [quizAnswers, savedProfile],
    )
    const resolved = quizAnswers !== undefined && savedProfileLoaded

    if (!resolved) return null
    if (hasProfile) return children

    return (
        <div className="mx-auto max-w-2xl px-4 py-14 text-center">
            <h2 className="font-lato text-xl font-semibold text-gray-900 sm:text-2xl">
                {title || 'Take the skin quiz to see products'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                {description || 'Answer a few quick questions so every product here is scored for your skin.'}
            </p>
            {hideCta ? null : navigateToHomeQuiz ? (
                <Link
                    href="/MatchStudio#match-my-skin"
                    className="mt-6 inline-block rounded-xl bg-[#171717] px-6 py-3 text-sm font-semibold text-white hover:bg-[#333]"
                >
                    Take the Quiz
                </Link>
            ) : quizOpen ? (
                <div className="mt-6 border-y border-[#ead8d3] bg-white text-left">
                    <MatchMySkin startEditing onComplete={() => setQuizOpen(false)} />
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setQuizOpen(true)}
                    className="mt-6 rounded-xl bg-[#171717] px-6 py-3 text-sm font-semibold text-white hover:bg-[#333]"
                >
                    Take the Quiz
                </button>
            )}
        </div>
    )
}
