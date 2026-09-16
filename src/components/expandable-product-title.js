'use client'

import { useEffect, useRef, useState } from 'react'

// Clamps the product title to 3 lines and only shows the toggle when the
// title actually overflows that clamp — measured via scrollHeight vs
// clientHeight rather than a character-count guess, since the same title
// wraps differently at the mobile vs sm:+ font size.
export default function ExpandableProductTitle({ text, className = '' }) {
    const [expanded, setExpanded] = useState(false)
    const [overflowing, setOverflowing] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const checkOverflow = () => {
            if (expanded) return
            setOverflowing(el.scrollHeight > el.clientHeight + 1)
        }

        checkOverflow()
        window.addEventListener('resize', checkOverflow)
        return () => window.removeEventListener('resize', checkOverflow)
    }, [text, expanded])

    return (
        <div>
            <h2 ref={ref} className={`${className} ${expanded ? '' : 'line-clamp-3'}`}>
                {text}
            </h2>
            {overflowing ? (
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="mt-1 text-xs font-semibold text-[#e08a7d] hover:underline"
                >
                    {expanded ? 'Show less' : 'Read more'}
                </button>
            ) : null}
        </div>
    )
}
