"use client";

import { useState } from "react";

export default function ProductImage({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-6xl font-extrabold text-[#f3a99a] sm:text-8xl">
        R
      </div>
    );
  }

  return (
    <img
      alt={alt}
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
      src={src}
    />
  );
}
