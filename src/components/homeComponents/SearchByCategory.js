'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import Face from '@/assets/images/face.webp'
import Body from '@/assets/images/body.webp'
import lips from '@/assets/images/lips.webp'
import eyes from '@/assets/images/eyes.webp'
import OtpModal from '@/components/auth/otp-modal'
import { supabase } from '@/lib/supabase/client'


const categories = [
    {
        id: 1,
        name: 'Face',
        image: Face,
        filters: ['Face'],
    },
    { id: 2, name: 'Body', image: Body, filters: ['Body'] },
    { id: 3, name: 'Lips', image: lips, filters: ['Lips'] },
    { id: 4, name: 'Eyes', image: eyes, filters: ['Eyes'] }
]

function categoryHref(filters) {
    const params = new URLSearchParams()
    filters.forEach((category) => params.append('category', category))
    return `/AllProducts?${params}`
}

export default function SearchByCategory() {
    const router = useRouter()
    const [isLoginOpen, setIsLoginOpen] = useState(false)
    const [pendingHref, setPendingHref] = useState('')

    const handleCategoryClick = async (filters) => {
        const href = categoryHref(filters)
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
            router.push(href)
            return
        }

        setPendingHref(href)
        setIsLoginOpen(true)
    }

    return (
        <>
            <div className="bg-[#dbe6e2] py-6 px-4">
                <h2 style={{ letterSpacing: '0.1em' }} className="font-lato text-lg uppercase md:text-3xl text-center tracking- mb-1">
                    Search by Category
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
                        {categories.map((cat) => (
                            <SwiperSlide key={cat.id} className="!w-auto">
                                <button
                                    type="button"
                                    onClick={() => handleCategoryClick(cat.filters)}
                                    className="flex flex-col items-center gap-3 cursor-pointer"
                                    aria-label={`View ${cat.name} products`}
                                >
                                    <div className="relative w-[120px] h-[120px] md:w-32 md:h-32 rounded-lg overflow-hidden border-2 border-white shadow-sm">
                                        <Image
                                            src={cat.image}
                                            alt={cat.name}
                                            fill
                                            sizes="(max-width: 767px) 120px, 128px"
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

            <OtpModal
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
                onSuccess={() => {
                    setIsLoginOpen(false)
                    if (pendingHref) router.push(pendingHref)
                }}
            />
        </>
    )
}
