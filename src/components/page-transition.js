"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function PageTransition({ children }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [showLoader, setShowLoader] = useState(false);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;

    setVisible(false);
    setShowLoader(true);

    const t = setTimeout(() => {
      setShowLoader(false);
      setVisible(true);
    }, 500);

    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      <style>{`
        @keyframes ripple {
          0%  { transform: scale(0.5); opacity: 1; }
          100%{ transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      {/* children always render — keeps the cart bar mounted through the transition */}
      <div style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s ease",
        minHeight: "100%",
        width: "100%",
      }}>
        {children}
      </div>

      {/* Ripple loader overlay */}
      {showLoader && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(3px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 20, zIndex: 500,
          pointerEvents: "none",
        }}>
          <div style={{
            position: "relative", width: 72, height: 72,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              position: "absolute", width: 72, height: 72,
              borderRadius: "50%", border: "2.5px solid #FF4F8B",
              animation: "ripple 1.2s ease-out infinite",
            }} />
            <div style={{
              position: "absolute", width: 72, height: 72,
              borderRadius: "50%", border: "2.5px solid #ff00e6",
              animation: "ripple 1.2s ease-out infinite",
              animationDelay: "0.4s",
            }} />
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: "#FF4F8B",
            }} />
          </div>

          <p style={{
            fontFamily: "sans-serif", fontWeight: 800,
            fontSize: 22, color: "#111", margin: 0,
          }}>
            roopsee<span style={{ color: "#ff00e6", fontSize: 28 }}>.</span>
          </p>
        </div>
      )}
    </>
  );
}
