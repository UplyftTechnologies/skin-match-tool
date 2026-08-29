"use client";

import { useState } from "react";
import Image from "next/image";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

function normalizeImages(primaryImage, imageUrls) {
  return [...new Set([primaryImage, ...(imageUrls || [])]
    .filter(Boolean)
    .map((url) => String(url).trim())
    .filter((url) => /^https?:\/\//i.test(url)))];
}

export default function RetailerProductGallery({ imageUrls, primaryImage, productName, children }) {
  const images = normalizeImages(primaryImage, imageUrls);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % images.length);
  };

  return (
    <div className="mx-auto w-full max-w-[340px] sm:max-w-[440px] lg:max-w-none">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm sm:aspect-square sm:rounded-3xl">
        {activeImage ? (
          <Image
            src={activeImage}
            alt={`${productName} — image ${activeIndex + 1}`}
            fill
            priority={activeIndex === 0}
            sizes="(max-width: 639px) 340px, (max-width: 1023px) 440px, 42vw"
            className="object-contain p-3 sm:p-5"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-7xl font-semibold text-rose-200">
            R
          </div>
        )}
        {children}

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Show previous product image"
              className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white sm:left-3 sm:h-9 sm:w-9"
            >
              <FiChevronLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="Show next product image"
              className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white sm:right-3 sm:h-9 sm:w-9"
            >
              <FiChevronRight aria-hidden="true" className="h-5 w-5" />
            </button>
            <span className="absolute bottom-2 right-2 z-10 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white sm:bottom-3 sm:right-3 sm:text-xs">
              {activeIndex + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1.5 sm:gap-2" aria-label="Product images">
          {images.map((image, index) => (
            <button
              type="button"
              key={image}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show product image ${index + 1}`}
              aria-pressed={activeIndex === index}
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition sm:h-16 sm:w-16 sm:rounded-xl ${activeIndex === index ? "border-[#e08a7d]" : "border-transparent hover:border-slate-300"}`}
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
