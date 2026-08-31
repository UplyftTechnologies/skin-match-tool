'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'
import { useQuizGate } from '@/hooks/use-quiz-gate'
import RequireQuizModal from '@/components/RequireQuizModal'
import { FiArrowRight } from 'react-icons/fi'
import B1 from '@/assets/Kbeauty/k1.png'
import B2 from '@/assets/Kbeauty/k2.png'
import B3 from '@/assets/Kbeauty/k3.png'
import B4 from '@/assets/Kbeauty/k4.png'
import B5 from '@/assets/Kbeauty/k5.png'
import B6 from '@/assets/Kbeauty/k6.png'
import B7 from '@/assets/Kbeauty/k7.png'

// `brand` must match the catalog's brand_name values exactly (see
// data/products.csv) so /AllProducts?brand=... actually filters something.
const brands = [
  { id: 1, name: 'Laneige', image: B1, brand: 'Laneige' },
  { id: 2, name: 'Innisfree', image: B2, brand: 'Innisfree' },
  { id: 3, name: 'Celimax', image: B3, brand: 'Celimax' },
  { id: 4, name: 'COSRX', image: B4, brand: 'COSRX' },
  { id: 5, name: 'Some By Mi', image: B5, brand: 'SOME BY MI' },
  { id: 6, name: 'The Face Shop', image: B6, brand: 'The Face Shop' },
  { id: 7, name: 'Anua', image: B7, brand: 'Anua' },
]

function brandHref(brand) {
  const params = new URLSearchParams()
  params.append('brand', brand)
  return `/AllProducts?${params}`
}

export default function SearchByBrands() {
  const router = useRouter()
  const { guard, modalOpen, closeModal } = useQuizGate()

  const handleBrandClick = (brand) => {
    trackingService.trackEvent(EVENTS.CLICKED_SEARCH_K_BEAUTY_BRAND, {
      brand: brand.brand,
      brandName: brand.name,
      section: 'search_k_beauty',
    })

    guard(() => router.push(brandHref(brand.brand)))
  }

  const handleViewAll = () => {
    trackingService.trackEvent(EVENTS.CLICKED_VIEW_ALL_PRODUCTS, {
      source: 'search_k_beauty',
    })
    guard(() => router.push('/brands'))
  }

  return (
    <div className="bg-[#EBDFED] py-6 px-4 md:py-10">
      <h2 style={{ letterSpacing: '0.1em' }} className="font-lato text-lg uppercase md:text-3xl text-center tracking- mb-1">
        SEARCH K-BEAUTY
      </h2>

      <div className="max-w-6xl mx-auto mt-5 lg:mt-8">
        <Swiper
          modules={[FreeMode]}
          slidesPerView="auto"
          spaceBetween={16}
          freeMode={true}
          breakpoints={{
            480: { spaceBetween: 18 },
            768: { spaceBetween: 20 },
            1024: { spaceBetween: 28 },
            1280: { spaceBetween: 28 },
          }}
        >
          {brands.map((brand) => (
            <SwiperSlide key={brand.id} className="!w-auto">
              <button
                type="button"
                onClick={() => handleBrandClick(brand)}
                className="flex flex-col items-center gap-3 cursor-pointer"
                aria-label={`Shop ${brand.name}`}
              >
                <div className="relative w-[200px] h-[150px] sm:w-44 sm:h-44 lg:w-[352px] lg:h-52 rounded-2xl overflow-hidden border-2 border-white shadow-md transition-transform duration-200 hover:scale-[1.03]">
                  <Image
                    src={brand.image}
                    alt={brand.name}
                    fill
                    sizes="(max-width: 639px) 200px, (max-width: 1023px) 176px, 352px"
                    className="object-cover"
                  />
                </div>
              </button>
            </SwiperSlide>
          ))}
          <SwiperSlide className="!w-auto">
            <button
              type="button"
              onClick={handleViewAll}
              className="flex flex-col items-center gap-3 cursor-pointer"
              aria-label="View all brands"
            >
              <div className="relative flex w-[200px] h-[150px] sm:w-44 sm:h-44 lg:w-[352px] lg:h-52 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#EBDFED] bg-white/60 text-[#6b4c73] transition-transform duration-200 hover:scale-[1.03] hover:bg-white">
                <FiArrowRight aria-hidden="true" className="h-6 w-6" />
                <span className="text-sm font-semibold tracking-wide">View all</span>
              </div>
            </button>
          </SwiperSlide>
        </Swiper>
      </div>
      <RequireQuizModal open={modalOpen} onClose={closeModal} />
    </div>
  )
}
