'use client'

import Link from 'next/link'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

// The "quiz completed" bar shown above the product grid once a shopper has
// answers on file — a checkmark + label, an Update Quiz action, an optional
// expand/collapse chevron, and (guests only) a Save Quiz link into login so
// the quiz they just took gets attached to their account instead of
// vanishing next time the session resets. Used by MatchMySkin and
// AllProducts, which render this exact bar identically.
export default function QuizAnswersBar({
    label = 'Quiz answers',
    isLoggedIn,
    redirectPath = '/',
    onUpdateQuiz,
    updateDisabled = false,
    expanded,
    onToggle,
    source,
    compact = false,
}) {
    const buttonClassName = compact ? 'quiz-update-btn inline-flex !min-h-8 items-center !px-4 !py-1.5' : 'quiz-update-btn'

    return (
        <section
            className={`quiz-answers-disclosure ${expanded ? 'quiz-answers-disclosure-open' : ''}`}
            aria-label="Completed skin quiz answers"
        >
            <div className={`quiz-answers-bar ${compact ? '!px-4 !py-2.5' : ''}`}>
                <span className="quiz-complete-message">
                    <span className="quiz-complete-check" aria-hidden="true">&#10003;</span>
                    <span>{label}</span>
                </span>
                <div className="flex items-center gap-1 lg:gap-2">
                    {!isLoggedIn ? (
                        <Link
                            href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
                            className={buttonClassName}
                            onClick={() => trackingService.trackEvent(EVENTS.CLICKED_LOGIN, { method: 'save_quiz', source })}
                        >
                            Save Quiz
                        </Link>
                    ) : null}
                    <button
                        className={buttonClassName}
                        type="button"
                        disabled={updateDisabled}
                        onClick={onUpdateQuiz}
                    >
                        Update Quiz
                    </button>
                    {onToggle ? (
                        <button
                            className={`quiz-answers-toggle ${compact ? '!h-8 !w-8' : ''}`}
                            type="button"
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Collapse quiz answers' : 'Expand quiz answers'}
                            onClick={onToggle}
                        >
                            <svg className="quiz-answers-chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none">
                                <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    ) : null}
                </div>
            </div>
        </section>
    )
}
