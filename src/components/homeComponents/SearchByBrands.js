'use client'

import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import KoreanBrand from '@/assets/brand-images/brand1.png'
import IndianBrand from '@/assets/brand-images/brand2.png'
import InternationalBrand from '@/assets/brand-images/brand3.png'

const concerns = [
  { id: 1, name: 'Korean Brands', image: KoreanBrand },
  { id: 2, name: 'Indian Brands', image: IndianBrand },
  { id: 3, name: 'International Brands', image: InternationalBrand },

]

export default function SearchByBrands() {
  return (
    <div className="bg-[#faf7f2] py-6 px-4">
            <h2 style={{ letterSpacing: '0.1em' }} className="font-lato text-lg uppercase md:text-3xl text-center tracking- mb-1">
        Search By Brands
      </h2>

      <div className="max-w-6xl lg:max-w-3xl mx-auto mt-5 lg:mt-6">
        <Swiper
          modules={[FreeMode]}
          slidesPerView={2.2}
          spaceBetween={16}
          freeMode={true}
          breakpoints={{
            640: { slidesPerView: 2, spaceBetween: 15 },
            1024: { slidesPerView: 4, spaceBetween: 24 },
          }}
        >
          {concerns.map((concern) => (
            <SwiperSlide key={concern.id}>
              <div className="relative w-full aspect-[4/5] lg:aspect-[4/5] rounded-2xl overflow-hidden">
                <Image
                  src={concern.image}
                  alt={concern.name}
                  fill
                  sizes="(min-width: 1024px) 320px, 46vw"
                  className="object-[20% 50%] "
                />

                <div className="absolute bottom-[15px] inset-0 flex flex-col items-center justify-end gap-4 px-3">
                  <button style={{ fontSize: '10px' }} className="flex items-center
     gap-1 bg-white/95 text-gray-900 text-xs md:text-sm font-medium tracking-wide rounded-full px-4 py-[8px]
     hover:bg-white transition-colors duration-200">
                    Start Routine <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  )
}
