'use client'

import { useEffect, useRef, useState } from 'react'


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
