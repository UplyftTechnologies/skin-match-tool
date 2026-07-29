"use client";

import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";

export default function BackButton({ fallbackHref = "/" }) {
  const router = useRouter();

  const handleClick = (e) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <a
      href={fallbackHref}
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-sky-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
    >
      <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
      Back to matches
    </a>
  );
}