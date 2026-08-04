'use client'
import { useState } from 'react'
import { useRouter } from "next/navigation";
import Image from 'next/image'
import { FiSearch } from 'react-icons/fi'
import Serum from '@/assets/images/serum.png'

const products = [
    {
        id: 1,
        name: 'The ordinary xyz serum- AHA BHA 10%',
        image: Serum,
        originalPrice: 399,
        price: 350,
    },
    {
        id: 2,
        name: 'The ordinary xyz serum- AHA BHA 10%',
        image: Serum,
        originalPrice: 399,
        price: 350,
    },
    {
        id: 3,
        name: 'The ordinary xyz serum- AHA BHA 10%',
        image: Serum,
        originalPrice: 399,
        price: 350,
    },
    {
        id: 4,
        name: 'The ordinary xyz serum- AHA BHA 10%',
        image: Serum,
        originalPrice: 399,
        price: 350,
    },
    {
        id: 3,
        name: 'The ordinary xyz serum- AHA BHA 10%',
        image: Serum,
        originalPrice: 399,
        price: 350,
    },
    {
        id: 4,
        name: 'The ordinary xyz serum- AHA BHA 10%',
        image: Serum,
        originalPrice: 399,
        price: 350,
    },

]

function ProductCard({ product }) {
    return (
        <div className="bg-white rounded-lg p-3 flex flex-col">
            <div className="relative w-full aspect-[3/2] lg:aspect-[3/2] mb-3">
                <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-contain"
                />
            </div>

            <p className="text-sm font-lato text-gray-800 leading-snug mb-2">{product.name}</p>

            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-400 line-through">₹{product.originalPrice}</span>
                <span className="text-sm font-semibold text-gray-900">₹{product.price}</span>
            </div>

            <button style={{ fontSize: '11px' }} className="mt-auto w-[90%] mx-auto font-semibold   text-[#e08a7d]
       border border-[#e08a7d] rounded-full py-[8px] hover:bg-[#e08a7d] hover:text-white transition-colors duration-200">
                Save my match
            </button>
        </div>
    )
}

export default function Products() {
    const [search, setSearch] = useState('')
  const router = useRouter();

    return (
        <div className="bg-[#FAF9F6]">
        <div className="max-w-6xl lg:max-w-[80%] mx-auto px-3  py-6">
            <h1 style={{ letterSpacing: '0.1em' }} className="font-lato uppercase text-2xl md:text-3xl text-center tracking- mb-1">
                Products
            </h1>

            <div className="relative max-w-xl mx-auto mb-2 mt-3">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#e08a7d]" size={18} />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for Cleansers"
                    className="w-full pl-11 pr-4 py-3 rounded-full border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#e08a7d] shadow-sm"
                />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 mt-3 lg:mt-5 md:gap-6">
                {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>

            <button
                type="button"
                onClick={() => router.push('/AllProducts')}
                className="block w-full lg:w-[70%] font-lato mt-5 mx-auto text-sm tracking-widest capitalize 
                     text-[#ff7e67] border-1 border-[#e08a7d] rounded-[20px] py-2 hover:bg-[#d17a6d] hover:text-white
                      transition-colors duration-300"
            >
                Login to view all
            </button>
        </div>
        </div>
    )
}