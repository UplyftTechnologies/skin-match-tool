'use client'

import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import Face from '@/assets/images/face.webp'
import Body from '@/assets/images/body.webp'
import lips from '@/assets/images/lips.webp'
import eyes from '@/assets/images/eyes.webp'


const categories = [
    { id: 1, name: 'Face', image: Face },
    { id: 2, name: 'Body', image: Body },
    { id: 3, name: 'Lips', image: lips },
    { id: 4, name: 'Eyes', image: eyes }
]

export default function SearchByCategory() {
    return (
        <div className="bg-[#dbe6e2] py-6 px-4">
            <h1 style={{ letterSpacing: '0.1em' }} className="font-lato text-2xl uppercase md:text-3xl text-center tracking- mb-1">
                Search by Category
            </h1>

            <div className="max-w-2xl lg:max-w-5xl mx-auto mt-5 lg:mt-8">
                <Swiper
                    modules={[FreeMode]}
                    slidesPerView={3}
                    spaceBetween={24}
                    freeMode={true}
                    breakpoints={{
                        480: { slidesPerView: 3, spaceBetween: 24 },
                        768: { slidesPerView: 4, spaceBetween: 32 },
                        1024: { slidesPerView: 4, spaceBetween: 56 },
                    }}
                >
                    {categories.map((cat) => (
                        <SwiperSlide key={cat.id} className="!w-auto">
                            <button className="flex flex-col items-center gap-3">
                                <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-3 border-white shadow-sm">
                                    <Image
                                        src={cat.image}
                                        alt={cat.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <span className="text-sm md:text-base tracking-wide text-gray-800">
                                    {cat.name}
                                </span>
                            </button>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </div>
    )
}
