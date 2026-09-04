"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import "../../css/PropertyAnimation.css";

function CardIcon() {
  return <svg viewBox="0 0 82 56" aria-hidden="true"><rect x="2" y="4" width="78" height="50" rx="5" fill="#3156a6"/><path d="M2 15h78v10H2z" fill="#7fa4dc"/><rect x="11" y="34" width="17" height="7" rx="1.5" fill="#fff" opacity=".9"/><path d="M67 5v49" stroke="#244687" strokeWidth="3" opacity=".55"/></svg>;
}

function GiftIcon() {
  return <svg viewBox="0 0 72 66" aria-hidden="true"><path d="M8 25h56v39H8z" fill="#3485ef"/><path d="M3 19h66v14H3z" fill="#f14b6b"/><path d="M32 19h9v45h-9z" fill="#3156a6"/><path d="M35 19C20 18 17 4 25 3c7-1 11 9 11 16Zm2 0C52 18 56 4 48 3c-7-1-11 9-11 16Z" fill="none" stroke="#3156a6" strokeWidth="5" strokeLinejoin="round"/></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 66 82" aria-hidden="true"><circle cx="29" cy="28" r="21" fill="none" stroke="#2678e4" strokeWidth="5"/><path d="m43 45 12 29" stroke="#e63055" strokeWidth="7" strokeLinecap="round"/></svg>;
}

function Confetti() {
  return <div className="property-confetti" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/></div>;
}

export default function AnimatedSkinShowcase() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const context = gsap.context(() => {
      const scenes = gsap.utils.toArray(".property-scene");
      gsap.set(scenes, { autoAlpha: 0 });
      gsap.set(".property-scene--home", { autoAlpha: 1 });
      const tl = gsap.timeline({ repeat: -1, defaults: { ease: "power3.out" } });

      const show = (scene, from, at, stay = 1.55) => {
        tl.set(scenes, { autoAlpha: 0 }, at)
          .set(scene, { autoAlpha: 1 }, at)
          .fromTo(scene, from, { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: .58 }, at)
          .to(scene, { autoAlpha: 0, duration: .28, ease: "power2.in" }, at + stay);
      };

      tl.set(scenes, { autoAlpha: 0 }, 0)
        .set(".property-scene--home", { autoAlpha: 1 }, 0)
        .fromTo(".property-home-copy", { y: 32, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .58 })
        .to(".property-scene--home", { autoAlpha: 0, duration: .28 }, 1.65);

      show(".property-scene--icons", { scale: .35 }, 2, 2.25);
      tl.set(".property-ampersand, .property-confetti", { autoAlpha: 1, scale: 1 }, 2)
        .fromTo(".property-card", { x: -52, rotate: -8 }, { x: 0, rotate: 0, duration: .62 }, 2)
        .fromTo(".property-gift", { x: 52, rotate: 8 }, { x: 0, rotate: 0, duration: .62 }, 2)
        .fromTo(".property-confetti i", { scale: 0, x: 0, y: 0 }, { scale: 1, x: i => [-42,44,-35,38,-26,27,-48,49][i], y: i => [-28,-25,31,29,-39,40,7,9][i], stagger: .035, duration: .45 }, 2.18)
        .to(".property-card", { x: () => -(window.innerWidth / 2 + 100), rotate: -10, duration: .72, ease: "power3.in" }, 3.35)
        .to(".property-gift", { x: () => window.innerWidth / 2 + 100, rotate: 10, duration: .72, ease: "power3.in" }, 3.35)
        .to(".property-ampersand", { scale: .4, autoAlpha: 0, duration: .3, ease: "power2.in" }, 3.38)
        .to(".property-confetti", { autoAlpha: 0, duration: .25 }, 3.48);

      // Reveal the heading from the center while the icons make room for it.
      tl.set(".property-scene--payments", { autoAlpha: 1 }, 3.35)
        .fromTo(".property-payments-copy", {
          scaleX: 0,
          autoAlpha: 0,
          clipPath: "inset(0 50% 0 50%)",
        }, {
          scaleX: 1,
          autoAlpha: 1,
          clipPath: "inset(0 0% 0 0%)",
          duration: .82,
          ease: "power3.out",
        }, 3.4)
        .set(".property-scene--icons", { autoAlpha: 0 }, 4.12)
        .to(".property-scene--payments", { autoAlpha: 0, duration: .28, ease: "power2.in" }, 6.1);

      show(".property-scene--shop", { scale: .72 }, 6.4, 2.2);
      tl.set(".property-scene--shop .property-heading", { clipPath: "inset(0 0 0 0)" }, 6.4)
        .set(".property-shop-line", { autoAlpha: 1 }, 6.4)
        .fromTo(".property-shop-line", { scaleX: 0 }, { scaleX: 1, duration: .55 }, 6.75)
        .to(".property-shop-line", { opacity: .7, duration: .42 }, 6.82);

      tl.set(".property-scene--search", { autoAlpha: 1 }, 8.12)
        .set(".property-scene--search .property-heading", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" }, 8.12)
        .fromTo(".property-search-icon", { x: -190, y: 7, rotate: -28, autoAlpha: 1, scale: 1 }, { x: 220, y: 0, rotate: 8, duration: 1.2, ease: "power2.inOut" }, 8.12)
        .to(".property-scene--shop .property-heading", { clipPath: "inset(0 0 0 100%)", duration: .65, ease: "none" }, 8.12)
        .to(".property-shop-line", { scaleX: 0, autoAlpha: 0, duration: .4 }, 8.18)
        .to(".property-scene--search .property-heading", { clipPath: "inset(0 0% 0 0)", duration: 1.02, ease: "none" }, 8.3)
        .set(".property-scene--shop", { autoAlpha: 0 }, 8.72)
        .to(".property-search-icon", { autoAlpha: 0, scale: .7, duration: .25 }, 9.35);

      tl.set(".property-scene--post", { autoAlpha: 1 }, 10.42)
        .set(".property-scene--post .property-heading", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" }, 10.42)
        .to(".property-scene--search .property-heading", { clipPath: "inset(0 0 0 100%)", duration: .72, ease: "power2.inOut" }, 10.42)
        .to(".property-scene--post .property-heading", { clipPath: "inset(0 0% 0 0)", duration: .82, ease: "power2.inOut" }, 10.52)
        .set(".property-scene--search", { autoAlpha: 0 }, 11.18)
        .fromTo(".property-bracket--left", { x: 38, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .45 }, 11.22)
        .fromTo(".property-bracket--right", { x: -38, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .45 }, 11.22)
        .fromTo(".property-broom", { x: -285, y: 13, rotate: -12 }, { x: 300, y: -8, rotate: 9, duration: 1.12, ease: "power2.inOut" }, 12)
        .to(".property-scene--post .property-heading", { clipPath: "inset(0 0 0 100%)", duration: 1.02, ease: "none" }, 12.03)
        .to(".property-bracket", { autoAlpha: 0, duration: .3 }, 12.42)
        .fromTo(".property-broom-dust i", { scale: 0, autoAlpha: 0 }, { scale: 1.3, autoAlpha: 1, stagger: .06, duration: .22 }, 12.1)
        .to(".property-broom-dust i", { x: -22, y: -13, scale: 0, autoAlpha: 0, stagger: .04, duration: .38 }, 12.32);

    }, root);

    return () => context.revert();
  }, []);

  return (
    <section ref={root} className="property-animation" aria-label="How Roopsee helps you shop for skincare">
      <div className="property-skyline" aria-hidden="true"/>
      <div className="property-scene property-scene--home"><p className="property-heading property-home-copy"><strong>KNOW YOUR</strong> SKIN MATCH</p></div>
      <div className="property-scene property-scene--icons" aria-hidden="true"><span className="property-icon property-card"><CardIcon/></span><span className="property-ampersand">&amp;</span><span className="property-icon property-gift"><GiftIcon/></span><Confetti/></div>
      <div className="property-scene property-scene--payments"><p className="property-heading property-payments-copy"><strong>BUILD YOUR</strong> BEST ROUTINE</p></div>
      <div className="property-scene property-scene--shop"><p className="property-heading"><strong>COMPARE</strong> PRICES</p><span className="property-shop-line" aria-hidden="true"/></div>
      <div className="property-scene property-scene--search"><span className="property-search-icon" aria-hidden="true"><SearchIcon/></span><p className="property-heading"><strong>CHOOSE WHERE</strong> TO BUY</p></div>
      <div className="property-scene property-scene--post">
        <p className="property-heading property-heading--long">
          <strong>SAVE WISHLIST</strong> &amp; GET PRICE ALERTS</p>
          <i className="property-bracket property-bracket--left" aria-hidden="true"/> <i className="property-bracket property-bracket--right" aria-hidden="true"/><span className="property-broom" aria-hidden="true"><span className="property-broom-handle"/><span className="property-broom-head"><i/><i/><i/><i/><i/></span><span className="property-broom-dust"><i/><i/><i/><i/></span></span></div>
    </section>
  );
}
