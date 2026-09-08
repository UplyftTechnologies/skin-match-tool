'use client'

import Animation2 from '../Animation2'
import SkincareCharacter from './SkincareCharacter'
export default function KnowBefore() {
  return (
      <section aria-labelledby="skin-match-heading" className="relative overflow-hidden bg-[#FAF7F2] bg-[linear-gradient(120deg,#FAF7F2_0%,#F5F6F1_45%,#D8E7E6_100%)] px-4 py-1 sm:px-6 sm:py-2">
        {/* <div className="pointer-events-none mx-auto mb-2 h-24 w-24 sm:h-28 sm:w-28 lg:absolute lg:left-[max(16px,calc(50%-590px))] lg:top-1/2 lg:mb-0 lg:h-48 lg:w-48 lg:-translate-y-1/2">
          <SkincareCharacter />
        </div> */}
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          {/* <div className="skin-match-tagline mb-1.5 flex w-full items-center justify-center gap-2 text-[clamp(7px,2.1vw,10px)] font-semibold uppercase leading-relaxed tracking-[0.06em] text-[#69796f] sm:mb-3 sm:gap-3 sm:text-[11px] sm:tracking-[0.22em]">
            <span aria-hidden="true" className="hidden h-px w-10 shrink-0 bg-[#b8c8bd] sm:block" />
            <span className="whitespace-nowrap">Your skin. Your match score. Better choices.</span>
            <span aria-hidden="true" className="hidden h-px w-10 shrink-0 bg-[#b8c8bd] sm:block" />
          </div> */}
          <h2 id="skin-match-heading" className="whitespace-nowrap font-cormorant text-[clamp(1.5rem,8vw,3.5rem)] font-medium leading-[1.12] tracking-[-0.025em] text-[#253b33] sm:text-[clamp(2rem,5vw,3.5rem)]">
            <span className="heading-intro">Know your</span>{' '}<em className="relative inline-block whitespace-nowrap font-normal italic text-[#0f766e]">
              skin match
              <svg aria-hidden="true" viewBox="0 0 220 16" preserveAspectRatio="none" className="absolute -bottom-2.5 left-0 h-2.5 w-full text-[#aac4ae]">
                <path className="skin-match-underline" pathLength="1" d="M4 11 C58 5 139 3 216 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </em>
          </h2>
          <div className="mt-3 w-full max-w-[420px] sm:mt-6">
            <Animation2 className="concern-animation-home" />
          </div>
        </div>
        <style jsx>{`
          @media (max-width: 639px) {
            .skin-match-tagline {
              margin-bottom: 7px;
              font-family: var(--font-lato), Arial, sans-serif;
              font-size: clamp(8px, 2.3vw, 10px);
              letter-spacing: 0.045em;
              color: #596b62;
            }

            #skin-match-heading {
              font-size: clamp(26px, 8.8vw, 44px);
              letter-spacing: -0.035em;
              line-height: 1.08;
            }

            #skin-match-heading svg {
              bottom: -6px;
              height: 7px;
            }
          }

          .skin-match-underline {
            stroke-dasharray: 1 1;
            stroke-dashoffset: 0;
            animation: draw-underline 6s cubic-bezier(0.22, 1, 0.36, 1) infinite;
          }

          @keyframes draw-underline {
            0% { stroke-dashoffset: 1; opacity: 0; }
            3% { opacity: 1; }
            28%, 76% { stroke-dashoffset: 0; opacity: 1; }
            93% { stroke-dashoffset: -1; opacity: 0; }
            100% { stroke-dashoffset: -1; opacity: 0; }
          }

          @media (prefers-reduced-motion: reduce) {
            .skin-match-underline {
              animation: none;
            }
          }
        `}</style>
      </section>
  )
}
