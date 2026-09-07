'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { FiUserCheck, FiCheckSquare, FiTag, FiShoppingBag, FiBell } from 'react-icons/fi'

const HEADINGS = [
    'Know your skin match',
    'Build your best routine',
    'Compare prices',
    'Choose where to buy',
    'Save wishlist and get price alerts',
]

const HEADING_COLORS = ['#0f766e','#0f766e','#0f766e','#0f766e','#0f766e']
const HEADING_ICONS = [FiUserCheck, FiCheckSquare, FiTag, FiShoppingBag, FiBell]

const HOLD_DURATION = 1.6     
const TRANSITION_DURATION = 0.35 
const INITIAL_DELAY = 1.2      
export default function Animation2({ className = '', prefix = '' }) {
     const rootRef = useRef(null)
    const trackRef = useRef(null)

    useEffect(() => {
        const media = gsap.matchMedia()

        media.add('(prefers-reduced-motion: no-preference)', () => {
            const track = trackRef.current
            const timeline = gsap.timeline({ repeat: -1 })

            HEADINGS.forEach((_, index) => {
                timeline.to(track, {
                    yPercent: -((index + 1) * 100) / (HEADINGS.length + 1),
                    duration: TRANSITION_DURATION,
                    ease: 'power4.out',
                }, index * HOLD_DURATION + INITIAL_DELAY)
            })
            timeline.set(track, { yPercent: 0 })
        }, rootRef)

        return () => media.revert()
    }, [])

    return (
        <span ref={rootRef} className={`concern-animation ${className}`}>
            <span className="accessible-copy">
                {prefix ? `${prefix} ` : ''}{HEADINGS.join(', ')}
            </span>
            {prefix && <span aria-hidden="true" className="prefix">{prefix}</span>}
            <span className="word-window" aria-hidden="true">
                <span ref={trackRef} className="word-track">
                    {[...HEADINGS, HEADINGS[0]].map((heading, index) => {
                        const Icon = HEADING_ICONS[index % HEADINGS.length]
                        return (
                        <span
                            className="word"
                            key={`${heading}-${index}`}
                            style={{ color: HEADING_COLORS[index % HEADINGS.length] }}
                        >
                            <span className="heading-icon"><Icon aria-hidden="true" focusable="false" /></span>
                            <span className="heading-text">{heading}</span>
                        </span>
                        )
                    })}
                </span>
                
            </span>
            <style jsx>{`
                .concern-animation {
                    --row-height: 1.80em;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: center;
                    column-gap: 0.3em;
                    width: 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                    padding: 0px 10px;
                    text-align: center;
                    vertical-align: middle;
                    font-family: lato;
                    font-size: 22px;
                    line-height: 1.5;
                    letter-spacing: 0;
                    background-color: #FAF9F6;
                }
                .prefix { color: #858585; }
              .word-window {
    display: inline-block;
    height: var(--row-height);
    width: min(36rem, 100%);   /* was: width: 36rem; max-width: 100%; */
    min-width: 0;
    overflow: hidden;
    mask-image: linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent);
    font-family: Lato, Arial, sans-serif;
    font-weight: 600;
}
                .word-track {
                    display: grid;
                    background-color: #FAF9F6;
                }
                .word {
                    display: flex;
                    gap: 0.45em;
                    align-items: center;
                    justify-content: center;
                    height: var(--row-height);
                    line-height: 1.5;
                    white-space: normal;
                    overflow-wrap: anywhere;
                    text-wrap: balance;
                }
                .heading-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex: 0 0 1.15em;
                    width: 1.15em;
                    height: 1.15em;
                    font-size: 1.05em;
                }
                .heading-text { min-width: 0; }
                @media (max-width: 520px) {
                    .concern-animation {
                        --row-height: 1.80em;
                        padding: 0px 12px;
                        font-size: 16px;
                    }
                }
                .accessible-copy {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip-path: inset(50%);
                    white-space: nowrap;
                    border: 0;
                }
            `}</style>
        </span>
    )
}
