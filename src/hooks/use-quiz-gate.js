'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import { getSavedSkinProfile } from '@/lib/profile-storage'

// Guards a click action (navigating to a filtered product list, in practice)
// behind the skin quiz — for home-page tiles like Search by Category/Product,
// K-Beauty and Indian Rockstar, where clicking through without a profile used
// to land on a product page that hid its own products with no context. This
// shows the existing "Find the products to avoid" prompt right where the
// shopper clicked instead.
export function useQuizGate() {
    const quizAnswers = useQuizAnswers()
    const [savedProfile, setSavedProfile] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setSavedProfile(getSavedSkinProfile()?.profile || null)
        }, 0)
        return () => clearTimeout(timer)
    }, [quizAnswers])

    const hasProfile = useMemo(
        () => Boolean(quizAnswers) || Boolean(savedProfile?.selectedSkinType),
        [quizAnswers, savedProfile],
    )

    function guard(action) {
        if (hasProfile) {
            action()
            return
        }
        setModalOpen(true)
    }

    return { guard, modalOpen, closeModal: () => setModalOpen(false) }
}
