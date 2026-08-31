'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import RequireQuizModal from '@/components/RequireQuizModal'

const SHOWN_KEY = 'roopsee-quiz-prompt-shown'

export default function GlobalQuizPrompt() {
    const pathname = usePathname()
    const quizAnswers = useQuizAnswers()
    const [open, setOpen] = useState(false)
    const [quizEditing, setQuizEditing] = useState(false)

    const skipPage = pathname?.startsWith('/login')

    useEffect(() => {
        const updateQuizEditing = (event) => {
            setQuizEditing(Boolean(event.detail))
            if (event.detail) setOpen(false)
        }

        setQuizEditing(document.documentElement.hasAttribute('data-quiz-editing'))
        window.addEventListener('roopsee-quiz-editing', updateQuizEditing)
        return () => window.removeEventListener('roopsee-quiz-editing', updateQuizEditing)
    }, [])

    // useEffect(() => {
    //     if (skipPage || quizEditing || quizAnswers !== null) return undefined
    //     if (sessionStorage.getItem(SHOWN_KEY)) return undefined

    //     const timer = window.setTimeout(() => {
    //         if (!document.documentElement.hasAttribute('data-quiz-editing')) setOpen(true)
    //     }, 20000)
    //     return () => window.clearTimeout(timer)
    // }, [skipPage, quizAnswers, quizEditing])

    const handleClose = () => {
        setOpen(false)
        sessionStorage.setItem(SHOWN_KEY, '1')
    }

    return <RequireQuizModal open={open && !quizAnswers && !quizEditing} onClose={handleClose} />
}
