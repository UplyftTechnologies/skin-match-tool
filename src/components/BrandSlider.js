'use client'

const brands = [
  {
    name: 'The Ordinary.',
    className: 'font-serif text-[13px] font-bold leading-none text-black sm:text-base md:text-lg',
  },
  {
    name: 'LANEIGE',
    className: 'font-sans text-[12px] font-semibold leading-none tracking-[0.12em] text-[#6c9fdb] sm:text-base md:text-lg',
  },
  {
    name: 'SKIN1004',
    className: 'font-sans text-[9px] font-bold leading-none tracking-[0.3em] text-black sm:text-xs md:text-sm',
    subtitle: 'THE UNTOUCHED NATURE',
  },
  {
    name: 'Anua',
    className: 'font-sans text-base font-medium leading-none text-[#786a71] sm:text-xl md:text-2xl',
  },
  {
    name: 'COSRX',
    className: 'font-sans text-xs font-semibold leading-none tracking-wide text-black sm:text-base md:text-lg',
  },
  {
    name: 'Beauty of Joseon',
    className: 'font-serif text-xs italic leading-none text-black sm:text-base md:text-lg',
  },
]

export default function BrandSlider() {
  const track = [...brands, ...brands]

  return (
    <div className="w-full overflow-hidden border-y border-[#e8e0e8] bg-[#EBDFED] py-1">
      <div className="relative w-full overflow-hidden">
        <div className="flex w-max animate-brand-scroll items-center">
          {track.map((brand, index) => (
            <div
              key={`${brand.name}-${index}`}
              className="mx-4 flex min-w-[72px] shrink-0 flex-col items-center justify-center whitespace-nowrap sm:mx-7 md:mx-10"
            >
              <span className={brand.className}>{brand.name}</span>
              {brand.subtitle && (
                <span className="mt-0.5 text-[4px] leading-none tracking-[0.18em] text-gray-500 sm:text-[6px] md:text-[7px]">
                  {brand.subtitle}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes brand-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-brand-scroll {
          animation: brand-scroll 22s linear infinite;
        }
        .animate-brand-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
