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
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'
import P1 from '@/assets/Shopbyproducts/p1.png'
import P2 from '@/assets/Shopbyproducts/p2.png'
import P3 from '@/assets/Shopbyproducts/p3.png'
import P4 from '@/assets/Shopbyproducts/p4.png'
import P5 from '@/assets/Shopbyproducts/p5.png'

// `type` must match the catalog's product_type values exactly (see
// data/products.csv) so /AllProducts?type=... actually filters something.
const productTypes = [
    { id: 1, name: 'Cleanser', image: P1, type: 'Cleanser' },
    { id: 2, name: 'Toner', image: P2, type: 'Toner' },
    { id: 3, name: 'Serum', image: P3, type: 'Serum' },
    { id: 4, name: 'Moisturiser', image: P4, type: 'moisturiser' },
    { id: 5, name: 'Mask', image: P5, type: 'Mask' },
]

function productTypeHref(type) {
    const params = new URLSearchParams()
    params.append('type', type)
    return `/AllProducts?${params}`
}

export default function SearchByProducts() {
    const router = useRouter()
    const quizAnswers = useQuizAnswers()
    const [showQuizModal, setShowQuizModal] = useState(false)

    const handleProductClick = (product) => {
        trackingService.trackEvent(EVENTS.CLICKED_SEARCH_BY_PRODUCT_TYPE, {
            productType: product.type,
            productName: product.name,
            section: 'search_by_products',
        })

        if (!quizAnswers) {
            setShowQuizModal(true)
            return
        }
        router.push(productTypeHref(product.type))
    }

    return (
        <div className="bg-[#f8eeeb] py-6 px-4 md:py-10">
            <RequireQuizModal open={showQuizModal} onClose={() => setShowQuizModal(false)} />
            <h2 style={{ letterSpacing: '0.1em' }} className="font-lato text-lg uppercase md:text-3xl text-center tracking- mb-1">
                Search by Product
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
                    {productTypes.map((product) => (
                        <SwiperSlide key={product.id} className="!w-auto">
                            <button
                                type="button"
                                onClick={() => handleProductClick(product)}
                                className="flex flex-col items-center gap-3 cursor-pointer"
                                aria-label={`Shop ${product.name}`}
                            >
                                <div className="relative w-[150px] h-[150px] sm:w-44 sm:h-44 lg:w-52 lg:h-52 rounded-2xl overflow-hidden border-2 border-white shadow-md transition-transform duration-200 hover:scale-[1.03]">
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        sizes="(max-width: 639px) 150px, (max-width: 1023px) 176px, 208px"
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