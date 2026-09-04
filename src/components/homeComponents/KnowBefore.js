'use client'

import BrandSlider from '../BrandSlider'

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
      <div className="relative w-full overflow-hidden">
        <div className="flex w-max animate-announcement-scroll items-center">
          {track.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="flex shrink-0 items-center gap-2 px-2.5 py-1 font-lato text-[7px] font-semibold uppercase leading-none text-white whitespace-nowrap sm:gap-3 sm:px-4 sm:py-1.5 sm:text-[9px]"
            >
              {item}
              <span aria-hidden="true">•</span>
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
          animation: announcement-scroll 18s linear infinite;
        }
        .animate-announcement-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}

export default function KnowBefore() {
  return (
    <div>
      <AnnouncementBar />
      <section className="bg-[#FAF9F6] px-3 ">
        {/* <div className="mx-auto max-w-7xl text-center">
          <h2 className="font-cormorant text-[25px] leading-none tracking-[0.17em] text-black sm:text-[34px] md:text-[42px]">
            Skin <em className="italic">match</em> tool
          </h2>

          <div className="mt-2 flex items-center justify-center gap-1.5 rounded-full  px-3 py-1 mx-auto w-fit">
            <BsPatchCheckFill className="text-[#197a4d] text-[11px] sm:text-[13px]" />
            <span className="font-lato text-[11px] font-semibold uppercase tracking-[0.05em] text-[#197a4d] sm:text-[13px] md:text-sm">
              Doctor Verified Scores
            </span>
          </div>

          <p className="mt-1.5 font-lato text-[8px] leading-tight text-black sm:text-[10px] md:text-xs">
            Skincare Products scored for your skin across 500+ brands
          </p>

          <div className="mt-7 sm:mt-9">
            <BrandSlider />
          </div>
        </div> */}

      </section>

    </div>
  )
}
