'use client'

import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import DarkCircle from '@/assets/concern-images/dark-circle.jpeg'
import BodyAcne from '@/assets/concern-images/body-acne.jpeg'
import DryChapped from '@/assets/concern-images/dry-chapped.jpeg'
import BodyHyderation from '@/assets/concern-images/body-hyderation.jpeg'
import BodyPigment from '@/assets/concern-images/body-pigment.jpeg'
import LipPigment from '@/assets/concern-images/lip-pigment.jpeg'

const concerns = [
  { id: 1, name: 'Dark Circles', image: DarkCircle },
  { id: 2, name: 'Body Acne', image: BodyAcne },
  { id: 3, name: 'Dryness', image: DryChapped },
  { id: 4, name: 'Body Hyderation', image: BodyHyderation },
    { id: 5, name: 'Body Pigmentation', image: BodyPigment },
  { id: 6, name: 'Lip Pigmentation', image: LipPigment },
]

export default function SearchByBrands() {
  return (
    <div className="bg-[#faf7f2] py-6 px-4">
            <h1 style={{ letterSpacing: '0.1em' }} className="font-lato text-2xl uppercase md:text-3xl text-center tracking- mb-1">
       Search By Brands
      </h1>

      <div className="max-w-6xl mx-auto mt-5">
        <Swiper
          modules={[FreeMode]}
          slidesPerView={2.2}
          spaceBetween={16}
          freeMode={true}
          breakpoints={{
            640: { slidesPerView: 2, spaceBetween: 20 },
            1024: { slidesPerView: 4, spaceBetween: 24 },
          }}
        >
          {concerns.map((concern) => (
            <SwiperSlide key={concern.id}>
              <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden">
                <Image
                  src={concern.image}
                  alt={concern.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/25" />

                <div className="absolute bottom-[15px] inset-0 flex flex-col items-center justify-end gap-4 px-3">
                 

                  <button style={{fontSize:'10px'}} className="flex items-center
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