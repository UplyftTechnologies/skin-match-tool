'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import RequireQuizModal from '@/components/RequireQuizModal'
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
  const quizAnswers = useQuizAnswers()
  const [showQuizModal, setShowQuizModal] = useState(false)

  const handleBrandClick = (brand) => {
    if (!quizAnswers) {
      setShowQuizModal(true)
      return
    }
    router.push(brandHref(brand))
  }

  return (
    <div className="bg-[#EBDFED] py-6 px-4 md:py-10">
      <RequireQuizModal open={showQuizModal} onClose={() => setShowQuizModal(false)} />
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
                onClick={() => handleBrandClick(brand.brand)}
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
        </Swiper>
      </div>
    </div>
  )
}