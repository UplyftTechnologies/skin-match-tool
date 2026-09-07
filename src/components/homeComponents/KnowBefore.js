'use client'

import { BsPatchCheckFill } from 'react-icons/bs'
import BrandSlider from '../BrandSlider'
import Animation2 from '../Animation2'

const announcements = [
  'Free Registration',
  'Save Skin Profile',
  'Save Wishlist',
  'Price Drop Alert',
  'Compare Prices',
  'Choose Shop & Buy',
]

function AnnouncementBar() {
  const track = [...announcements, ...announcements]

  return (
    <div className="w-full overflow-hidden bg-black ring-1 ring-inset ring-[#ca58ff]">
      {/* screen-reader accessible copy, marquee itself is aria-hidden */}
      <span className="sr-only">{announcements.join(', ')}</span>

      <div className="relative w-full overflow-hidden" aria-hidden="true">
        <div className="flex w-max animate-announcement-scroll items-center">
          {track.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="flex shrink-0 items-center gap-2 px-3 py-2 font-lato text-[11px] font-semibold uppercase leading-none tracking-wide text-white whitespace-nowrap sm:gap-3 sm:px-4 sm:py-2 sm:text-[12px] md:text-[13px]"
            >
              {item}
              <span className="text-[#ca58ff]" aria-hidden="true">•</span>
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes announcement-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-announcement-scroll {
          animation: announcement-scroll 22s linear infinite;
        }
        .animate-announcement-scroll:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-announcement-scroll {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}

export default function KnowBefore() {
  return (
    <div>
      <AnnouncementBar />
      <section className="bg-[#FAF9F6] px-4 py-4 sm:px-6 sm:py-6 md:py-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-cormorant text-[28px] leading-[1.1]
           tracking-[0.14em] text-black sm:text-[36px] md:text-[46px]">
            Skin <em className="italic">match</em> tool
          </h2>

          <Animation2 className="concern-animation-home" />

        </div>
      </section>
    </div>
  )
}