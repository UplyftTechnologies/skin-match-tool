"use client";

import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

export default function ProductGallery({ images = [], alt, children }) {
  const gallery = images.filter(Boolean);
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(() => new Set());

  const activeIndex = failed.has(selected)
    ? gallery.findIndex((_, index) => !failed.has(index))
    : selected;
  const current = activeIndex >= 0 ? gallery[activeIndex] : null;

  function markFailed(index) {
    setFailed((prev) => new Set(prev).add(index));
  }

  function renderThumb(src, index) {
    return (
      <button
        aria-current={index === activeIndex}
        aria-label={`Show image ${index + 1} of ${gallery.length}`}
        className={`relative aspect-square w-full overflow-hidden rounded-xl border bg-white transition ${
          index === activeIndex
            ? "border-[#e08a7d] ring-2 ring-[#f3a99a]"
            : "border-slate-100 hover:border-[#f3a99a]"
        }`}
        onClick={() => setSelected(index)}
        type="button"
      >
        {failed.has(index) ? (
          <div className="flex h-full w-full items-center justify-center text-lg font-extrabold text-[#f3a99a]">
            R
          </div>
        ) : (
          <img
            alt={`${alt} thumbnail ${index + 1}`}
            className="h-full w-full object-contain p-1"
            onError={() => markFailed(index)}
            src={src}
          />
        )}
      </button>
    );
  }

  return (
    <>
      <div className="pdp-product-image relative aspect-[1.42] w-full overflow-hidden bg-white p-0 sm:aspect-square sm:rounded-3xl sm:border sm:border-slate-100 sm:p-6 sm:shadow-sm">
        {current ? (
          <img
            alt={alt}
            className="h-full w-full object-contain"
            onError={() => markFailed(activeIndex)}
            src={current}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl font-extrabold text-[#f3a99a] sm:text-8xl">
            R
          </div>
        )}
        {children}
      </div>

      {gallery.length > 1 ? (
        <div className="mt-3">
          <Swiper
            spaceBetween={8}
            slidesPerView={4.3}
            breakpoints={{
              640: { slidesPerView: 5, spaceBetween: 10 },
              1024: { slidesPerView: 6, spaceBetween: 12 },
            }}
          >
            {gallery.map((src, index) => (
              <SwiperSlide key={`${src}-${index}`}>{renderThumb(src, index)}</SwiperSlide>
            ))}
          </Swiper>
        </div>
      ) : null}
    </>
  );
}