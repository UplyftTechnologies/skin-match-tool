"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { trackingService } from '@/lib/tracking/trackingClient';
import { EVENTS } from '@/lib/tracking/events';
import { DEFAULT_PROFILE } from "@/lib/default-profile";
import { productPath, scoredProductPath } from "@/lib/site";
import { supabase } from "@/lib/supabase/client";
import { BiHeart } from "react-icons/bi";
import { BsHeartFill } from "react-icons/bs";
import { useWishlist } from "@/context/WishlistContext";
import ProductCard from "./ProductCard";
import { getSessionId, getVisitorId, setLoggedInUser } from "@/lib/tracking/identity";
import { saveSkinProfile } from "@/lib/profile-storage";
import Header from "./header";

const options = {
  skinTypes: ["Oily", "Dry", "Normal", "Combination"],
  sensitivityOptions: ["No", "Yes"],
  concerns: [
    "Acne",
    "Body Acne",
    "Dryness",
    "Open Pores",

    "Dark Spots",
    "Redness",
    "Tanning",
    "Dullness",

    "Uneven Skin Tone",
    "Comedones",
    "Wrinkles",
    "Melasma",


    "Dehydration",

    "Barrier Repair",


    "None"
  ],
  specials: ["Excessive Dryness", "Pregnant", "Breastfeeding", "None"],

};

const guideLinks = [
  {
    slug: "oily-skin-acne",
    label: "Oily skin and acne",
    profile: {
      selectedSkinType: "Oily",
      selectedSensitive: false,
      selectedFaceBodyConcerns: ["Acne"],
      selectedSpecialConditions: ["None"],
    },
  },
  {
    slug: "dry-sensitive-skin",
    label: "Dry and sensitive skin",
    profile: {
      selectedSkinType: "Dry",
      selectedSensitive: true,
      selectedFaceBodyConcerns: ["Dryness"],
      selectedSpecialConditions: ["Excessive Dryness"],
    },
  },
  {
    slug: "pigmentation",
    label: "Pigmentation and dark spots",
    profile: {
      selectedSkinType: "Combination",
      selectedSensitive: false,
      selectedFaceBodyConcerns: ["Dark Spots/Pigmentation"],
      selectedSpecialConditions: ["None"],
    },
  },
  {
    slug: "teen-acne",
    label: "Teen acne",
    profile: {
      age: "Teen",
      selectedSkinType: "Oily",
      selectedSensitive: false,
      selectedFaceBodyConcerns: ["Acne"],
      selectedSpecialConditions: ["None"],
    },
  },
  {
    slug: "dull-skin",
    label: "Dull-looking skin",
    profile: {
      selectedSkinType: "Normal",
      selectedSensitive: false,
      selectedFaceBodyConcerns: ["Dullness"],
      selectedSpecialConditions: ["None"],
    },
  },
  {
    slug: "barrier-repair",
    label: "Skin barrier support",
    profile: {
      selectedSkinType: "Dry",
      selectedSensitive: true,
      selectedFaceBodyConcerns: ["Barrier Repair"],
      selectedSpecialConditions: ["None"],
    },
  },
];

const EMPTY_PROFILE = {
  selectedSkinType: "",
  selectedSensitive: null,
  selectedFaceBodyConcerns: [],
  selectedSpecialConditions: [],
  age: "",
  selectedGender: "",
};

const MATCHER_HISTORY_KEY = "roopsee_matcher_history";
const SCROLL_POS_KEY = "roopsee_home_scroll_pos";

function isCompleteStoredProfile(profile) {
  return Boolean(
    profile?.selectedSkinType
    && profile.selectedSensitive !== null
    && profile.selectedFaceBodyConcerns?.length
    && profile.selectedSpecialConditions?.length
    && profile.age
    && profile.selectedGender
  );
}

async function claimGuestQuizResults(session) {
  if (!session?.access_token) return;

  try {
    const response = await fetch("/api/quiz-results", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ guestSessionId: getSessionId() }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.warn(
        "[match-studio] Unable to attach phone number to quiz results:",
        result.error || response.statusText,
      );
    }
  } catch (error) {
    console.warn("[match-studio] Quiz result claim request failed:", error.message);
  }
}

async function claimGuestEventLogs(session) {
  if (!session?.access_token) return;

  try {
    const response = await fetch("/api/events", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: getSessionId(),
        visitorId: getVisitorId(),
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.warn(
        "[match-studio] Unable to attach user to event records:",
        result.error || response.statusText,
      );
    }
  } catch (error) {
    console.warn("[match-studio] Event identity claim request failed:", error.message);
  }
}

function syncTrackingIdentity(session) {
  const user = session?.user;
  if (!user) {
    setLoggedInUser(null);
    return;
  }

  const metadata = user.user_metadata || {};
  setLoggedInUser({
    id: user.id,
    name: metadata.full_name || metadata.name || "",
    phone: user.phone || metadata.phone_no || metadata.phone || "",
  });
}

function scoreRange(score) {
  if (score >= 90) return "90_100";
  if (score >= 80) return "80_89";
  if (score >= 70) return "70_79";
  if (score >= 60) return "60_69";
  if (score >= 50) return "50_59";
  return "below50";
}

function rangeLabel(key) {
  return {
    "90_100": "90-100",
    "80_89": "80-89",
    "70_79": "70-79",
    "60_69": "60-69",
    "50_59": "50-59",
    below50: "Below 50",
  }[key] || "All";
}

function scoreBand(score) {
  if (score >= 80) return { label: "Great", className: "great" };
  if (score >= 60) return { label: "Caution", className: "caution" };
  return { label: "Poor", className: "poor" };
}

function displayScore(score) {
  return Math.max(0, score);
}

function formatPrice(product) {
  const value = product.selling_price || product.mrp;
  return value ? `Rs. ${Math.ceil(value)}` : "Price unavailable";
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  if (!product.image || failed) return <div className="image-fallback">R</div>;
  return (
    <img
      alt={product.product_name}
      loading="lazy"
      onError={() => setFailed(true)}
      src={product.image}
    />
  );
}

function ChipGroup({ items, isActive, onSelect }) {
  return (
    <div className="chips">
      {items.map((item) => (
        <button
          className={`chip ${isActive(item) ? "active" : ""}`}
          key={item}
          onClick={() => onSelect(item)}
          type="button"
        >
          {item}
        </button>
      ))}
    </div>
  );
}


function RoutineCard({ item, onOpen }) {
  const product = item.product;
  if (!product) {
    return (
      <article className="routine-card routine-missing">
        <div>
          <span className="routine-step">{item.label}</span>
          <h4>No {item.label.toLowerCase()} found</h4>
          <p>No matching catalog product is available for this routine slot.</p>
        </div>
      </article>
    );
  }
  const band = scoreBand(product.score);
  return (
    <article
      className="routine-card"
      data-product-uid={product.product_uid}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen(product);
      }}
      onClick={() => onOpen(product)}
      role="button"
      tabIndex={0}
    >
      <div className="routine-image"><ProductImage product={product} /></div>
      <div>
        <span className="routine-step">{item.label}</span>
        <h4>{product.product_name}</h4>
        <p>{product.brand_name} · {product.product_type} · {product.when_to_use || "Routine"}</p>
      </div>
      <div className={`routine-score score-${band.className}`}>{displayScore(product.score)}</div>
    </article>
  );
}

function RoutineSection({ title, items, onOpen }) {
  return (
    <div>
      <div className="routine-section-title">{title}</div>
      <div className="routine-list">
        {items.map((item) => (
          <RoutineCard item={item} key={`${item.period}-${item.slot}`} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function RoutineView({ routine, onOpen }) {
  const tiers = ["premium", "value_fit"].map((key) => routine?.tiers?.[key]).filter(Boolean);
  return (
    <div className="routine-board">
      {tiers.map((tier) => (
        <section className="routine-column" key={tier.label}>
          <h3>{tier.label}</h3>
          <p>{tier.description}</p>
          <RoutineSection items={tier.am || []} onOpen={onOpen} title="AM Routine" />
          <RoutineSection items={tier.pm || []} onOpen={onOpen} title="PM Routine" />
        </section>
      ))}
      <section className="routine-column">
        <h3>Weekly Routine</h3>
        <p>Top 2 mask products for this profile, selected by score from the live catalog.</p>
        <RoutineSection items={routine?.weekly || []} onOpen={onOpen} title="Once or Twice Weekly" />
      </section>
    </div>
  );
}

function ProductModal({ product, onClose }) {
  useEffect(() => {
    if (!product) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [product, onClose]);

  if (!product) return null;
  const band = scoreBand(product.score);
  return (
    <div
      aria-hidden="false"
      className="modal open"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div aria-labelledby="modalTitle" aria-modal="true" className="modal-card" role="dialog">
        <div className="modal-grid">
          <div className="modal-image"><ProductImage product={product} /></div>
          <div className="modal-content">
            <div className="modal-top">
              <div>
                <span className="tag">{product.match_label}</span>
                <h2 id="modalTitle">{product.product_name}</h2>
                <p>{product.brand_name} · {product.category} · {product.product_type}</p>
              </div>
              <button aria-label="Close product details" className="close-button" onClick={onClose} type="button">×</button>
            </div>
            <div className="detail-grid">
              <div className="detail-box"><span>Score</span><strong className={`score-${band.className}`}>{displayScore(product.score)} · {band.label}</strong></div>
              <div className="detail-box"><span>Price</span><strong>{formatPrice(product)}</strong></div>
              <div className="detail-box"><span>Size</span><strong>{product.size || "Unavailable"}</strong></div>
              <div className="detail-box"><span>Use</span><strong>{product.when_to_use || "Routine"}</strong></div>
              <div className="detail-box"><span>Hero</span><strong>{product.hero_ingredient || "Not listed"}</strong></div>
              <div className="detail-box"><span>Source</span><strong>{product.source_sheet}</strong></div>
            </div>
            {product.warnings?.length ? <div className="warnings">{product.warnings.join(" ")}</div> : null}
            {product.routine_notes?.length ? <div className="warnings">{product.routine_notes.join(" ")}</div> : null}
            <p><strong>Why this score:</strong> {product.explanation}</p>
            {product.usage_instructions ? <p><strong>Usage:</strong> {product.usage_instructions}</p> : null}
            <p><strong>Secondary ingredients:</strong> {product.secondary_hero_ingredients || "Not listed"}</p>
            <div className="section-title">Score components</div>
            <ul className="component-list">
              {product.component_scores?.map((component) => (
                <li key={`${component.name}-${component.source_column}`}>
                  <span>{component.name} <small>({component.source_column})</small></span>
                  <strong>{component.score}</strong>
                </li>
              ))}
            </ul>
            <div className="actions">
              <Link
                className="details-link"
                href={scoredProductPath(product.product_uid, product.score)}
              >
                Open crawlable product page
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MatchStudio({ initialData }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("products");
  const [modalProduct, setModalProduct] = useState(null);
  const [isQuizEditing, setIsQuizEditing] = useState(false);
  const { wishlistIds } = useWishlist();

  // NEW: Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ score: "all", category: "all", type: "all", sheet: "all" });

  const [limit, setLimit] = useState(initialData?.returned || 500);
  const [historyRestored, setHistoryRestored] = useState(false);
  const [touched, setTouched] = useState({
    skinType: false,
    concern: false,
    sensitive: false,
    special: false,
    age: false,
    gender: false,
  });

  // NEW: Becomes true once the user tries to submit the quiz — turns on inline per-question errors
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // NEW: Check if all quiz fields are selected
  const isQuizComplete = Boolean(
    profile.selectedSkinType &&
    profile.selectedSensitive !== null &&
    profile.selectedFaceBodyConcerns.length > 0 &&
    profile.selectedSpecialConditions.length > 0 &&
    profile.age &&
    profile.selectedGender
  );

  // NEW: Returns the label of the first quiz field that hasn't been answered yet, or null if complete
  function getMissingFieldLabel() {
    if (!profile.selectedSkinType) return "Skin Type";
    if (profile.selectedSensitive === null) return "Sensitive Skin";
    if (profile.selectedFaceBodyConcerns.length === 0) return "Skin Concern";
    if (profile.selectedSpecialConditions.length === 0) return "Special Condition";
    if (!profile.age) return "Age Group";
    if (!profile.selectedGender) return "Gender";
    return null;
  }

  // NEW: Only the first missing field's label, computed once a submit has been attempted
  const missingFieldLabel = attemptedSubmit ? getMissingFieldLabel() : null;

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  // Auth state
  const [userSession, setUserSession] = useState(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;

      setUserSession(session);
      syncTrackingIdentity(session);
      if (session) {
        void claimGuestQuizResults(session);
        void claimGuestEventLogs(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserSession(session);
      syncTrackingIdentity(session);
      if (session) {
        void claimGuestQuizResults(session);
        void claimGuestEventLogs(session);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const recommend = useCallback(async (nextProfile, nextLimit = 500) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/recommend?limit=${nextLimit}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextProfile),
      });
      const responseText = await response.text();
      let payload = {};
      try {
        payload = JSON.parse(responseText);
      } catch {
        // Handle non-JSON responses
      }
      if (!response.ok) throw new Error(payload.error || "Unable to load recommendations.");
      setData(payload);
      setLimit(nextLimit);
    } catch (requestError) {
      setError(requestError.message);
      trackingService.trackError("match_studio_recommend_failed", {
        message: requestError.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // useEffect(() => {
  //   const restoreTimer = window.setTimeout(async () => {
  //     const selectedGuide = new URLSearchParams(window.location.search).get("guide");
  //     if (selectedGuide) {
  //       setHistoryRestored(true);
  //       return;
  //     }

  //     try {
  //       const savedValue = sessionStorage.getItem(MATCHER_HISTORY_KEY);
  //       const savedState = savedValue ? JSON.parse(savedValue) : null;

  //       if (savedState?.profile) setProfile(savedState.profile);
  //       if (savedState?.filters) setFilters(savedState.filters);
  //       if (typeof savedState?.searchQuery === "string") setSearchQuery(savedState.searchQuery);
  //       if (["products", "routine"].includes(savedState?.view)) setView(savedState.view);
  //       if (Number.isFinite(savedState?.limit)) setLimit(savedState.limit);

  //       // UPDATED: restore the actual saved results directly — no API call needed
  //       if (savedState?.data) {
  //         setData(savedState.data);
  //       }
  //     } catch (restoreError) {
  //       console.warn("[match-studio] Unable to restore matcher history:", restoreError.message);
  //       sessionStorage.removeItem(MATCHER_HISTORY_KEY);
  //     } finally {
  //       setHistoryRestored(true);
  //     }
  //   }, 0);

  //   return () => window.clearTimeout(restoreTimer);
  // }, [recommend]);

  useLayoutEffect(() => {
  const selectedGuide = new URLSearchParams(window.location.search).get("guide");
  if (selectedGuide) {
    setHistoryRestored(true);
    return;
  }

  try {
    const savedValue = sessionStorage.getItem(MATCHER_HISTORY_KEY);
    const savedState = savedValue ? JSON.parse(savedValue) : null;

    if (savedState?.profile) setProfile(savedState.profile);
    if (savedState?.filters) setFilters(savedState.filters);
    if (typeof savedState?.searchQuery === "string") setSearchQuery(savedState.searchQuery);
    if (["products", "routine"].includes(savedState?.view)) setView(savedState.view);
    if (Number.isFinite(savedState?.limit)) setLimit(savedState.limit);
    if (savedState?.data) setData(savedState.data);
  } catch (restoreError) {
    console.warn("[match-studio] Unable to restore matcher history:", restoreError.message);
    sessionStorage.removeItem(MATCHER_HISTORY_KEY);
  } finally {
    setHistoryRestored(true);
  }
}, []);
  useEffect(() => {
    if (!historyRestored) return;

    try {
      sessionStorage.setItem(MATCHER_HISTORY_KEY, JSON.stringify({
        profile,
        filters,
        searchQuery,
        view,
        limit,
        data, // UPDATED: store actual results, not just a "hasResults" flag
      }));
    } catch (saveError) {
      console.warn("[match-studio] Unable to save matcher history:", saveError.message);
    }
  }, [data, filters, historyRestored, limit, profile, searchQuery, view]);



  // UPDATED: Added search functionality to useMemo
  const products = useMemo(() => (data?.products || []).filter((product) => {
    if (filters.score !== "all" && scoreRange(product.score) !== filters.score) return false;
    if (filters.category !== "all" && product.category !== filters.category) return false;
    if (filters.type !== "all" && product.product_type !== filters.type) return false;
    if (filters.sheet !== "all" && product.source_sheet !== filters.sheet) return false;

    if (searchQuery.trim() !== "") {
      const term = searchQuery.toLowerCase();
      const matchesName = product.product_name?.toLowerCase().includes(term);
      const matchesBrand = product.brand_name?.toLowerCase().includes(term);
      if (!matchesName && !matchesBrand) return false;
    }

    return true;
  }), [data, filters, searchQuery]);

  const filterValues = (field) => [
    ...new Set((data?.products || []).map((product) => product[field]).filter(Boolean)),
  ].sort();

  const availableSpecials = profile.selectedGender === "male"
    ? options.specials.filter((item) => !["Pregnant", "Breastfeeding"].includes(item))
    : options.specials;

  function update(key, value) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function selectGender(gender) {
    const specials = gender === "male"
      ? profile.selectedSpecialConditions.filter((item) => !["Pregnant", "Breastfeeding"].includes(item))
      : profile.selectedSpecialConditions;
    setProfile({
      ...profile,
      selectedGender: gender,
      selectedSpecialConditions: specials,
    });
    trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
      field: "gender",
      question: "Gender",
      answer: gender,
      value: gender,
    });
  }

  function selectSpecial(item) {
    if (item === "None") {
      update("selectedSpecialConditions", ["None"]);
      trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
        field: "special_condition",
        question: "Special condition",
        answer: "None",
        value: "None",
      });
      return;
    }
    const current = profile.selectedSpecialConditions.filter((value) => value !== "None");
    const next = current.includes(item)
      ? current.filter((value) => value !== item)
      : [...current, item].slice(-2);
    update("selectedSpecialConditions", next);
    trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
      field: "special_condition",
      question: "Special condition",
      answer: item,
      value: item,
    });
  }

  function handleOpenProduct(product) {
    trackingService.trackEvent(EVENTS.CLICKED_PRODUCT_CARD, {
      productId: product.product_uid,
      productName: product.product_name,
      brand: product.brand_name,
      price: product.selling_price || product.mrp,
      section: view,
      score: product.score,
      view,
    });
    setModalProduct(product);
  }

  function handleVisitProduct(product) {
    trackingService.trackEvent(EVENTS.CLICKED_PRODUCT_CARD, {
      productId: product.product_uid,
      productName: product.product_name,
      brand: product.brand_name,
      price: product.selling_price || product.mrp,
      section: "product_results",
      score: product.score,
      destination: productPath(product.product_uid),
    });
  }

  function handleViewChange(nextView) {
    setView(nextView);
    trackingService.trackEvent(EVENTS.CLICKED_ROUTINE_MODE_TOGGLE, { view: nextView });
  }

  async function saveQuizResult(nextProfile) {
    const headers = { "Content-Type": "application/json" };
    if (userSession?.access_token) {
      headers.Authorization = `Bearer ${userSession.access_token}`;
    }

    const response = await fetch("/api/quiz-results", {
      method: "POST",
      headers,
      body: JSON.stringify({
        profile: nextProfile,
        guestSessionId: getSessionId(),
      }),
    });
    const result = await response.json().catch(() => ({
      error: "The quiz-results API returned an invalid response",
    }));
    if (!response.ok) {
      return {
        ok: false,
        error: result.error || "Unable to save quiz result",
      };
    }
    return result;
  }

  async function handleRefresh() {
    // NEW: Turn on inline per-question errors; block submission if any quiz option is missing
    setAttemptedSubmit(true);
    const missingField = getMissingFieldLabel();
    if (missingField) {
      return;
    }

    // Keep this marker separate from QUIZ_SUBMITTED_KEY, which only controls
    // the delayed login prompt and is cleared after authentication.
    if (quizCompletedRef.current === null) {
      quizCompletedRef.current = typeof window !== "undefined"
        && localStorage.getItem(QUIZ_COMPLETED_KEY) === "true";
    }

    const quizEvent = quizCompletedRef.current
      ? EVENTS.QUIZ_UPDATED
      : EVENTS.QUIZ_COMPLETED;

    // Set the in-memory marker before sending the event to prevent a rapid
    // second click from recording another completion event.
    if (!quizCompletedRef.current) {
      quizCompletedRef.current = true;
      try {
        localStorage.setItem(QUIZ_COMPLETED_KEY, "true");
      } catch {
        // The ref still prevents duplicate completion events in this session.
      }
    }

    trackingService.trackEvent(quizEvent, {
      ...profile,
      quizAnswerSummary: [
        profile.selectedSkinType,
        profile.selectedSensitive !== null ? (profile.selectedSensitive ? "Sensitive" : "Not sensitive") : "Unknown",
        ...profile.selectedFaceBodyConcerns,
        ...profile.selectedSpecialConditions,
        profile.age,
        profile.selectedGender,
      ].join(" | "),
    });
    await Promise.all([
      recommend(profile, 500),
      saveQuizResult(profile)
        .then((saveResult) => {
          if (saveResult.ok) return;
          console.warn("[match-studio] Quiz result save failed:", saveResult.error);
          trackingService.trackError("quiz_result_save_failed", {
            message: saveResult.error,
          });
        })
        .catch((saveError) => {
          console.warn("[match-studio] Quiz result request failed:", saveError.message);
          trackingService.trackError("quiz_result_save_failed", {
            message: saveError.message,
          });
        }),
    ]);
    saveSkinProfile(profile);
    setIsQuizEditing(false);

    // UPDATED: Added a short timeout to ensure the data loads and #results section renders before scroll.
    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  }

  function handleLoadMore() {
    const nextLimit = Math.min(limit + 500, data?.total_matches || limit + 500);
    trackingService.trackEvent(EVENTS.CLICKED_LOAD_MORE, {
      current_count: data?.returned || 0,
      requested_count: nextLimit,
    });
    recommend(profile, nextLimit);
  }

  const applyGuide = useCallback((guide, shouldScroll = true) => {
    const nextProfile = {
      ...DEFAULT_PROFILE,
      ...guide.profile,
    };
    setProfile(nextProfile);
    setFilters({ score: "all", category: "all", type: "all", sheet: "all" });
    setSearchQuery("");
    setView("products");
    setModalProduct(null);
    setAttemptedSubmit(false); // NEW: clear inline errors when a guide pre-fills the quiz
    trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
      field: "skincare_guide",
      question: "Skincare guide",
      answer: guide.label,
      value: guide.slug,
    });
    recommend(nextProfile, 500);
    if (shouldScroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [recommend]);

  function handleGuideClick(event, guide) {
    if (
      event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) {
      return;
    }

    event.preventDefault();
    applyGuide(guide);
  }

  useEffect(() => {
    trackingService.trackPageLoad(EVENTS.PAGE_VIEWED_SKIN_MATCH_TOOL, {
      page_type: "match_studio",
    });

    const selectedGuide = new URLSearchParams(window.location.search).get("guide");
    const guide = guideLinks.find((item) => item.slug === selectedGuide);
    if (!guide) return undefined;

    const applyTimer = window.setTimeout(() => applyGuide(guide, false), 0);
    return () => window.clearTimeout(applyTimer);
  }, [applyGuide]);

  useEffect(() => {
    const term = searchQuery.trim();
    if (!term) return;

    const debounceTimer = setTimeout(() => {
      trackingService.trackEvent(EVENTS.SEARCH_PERFORMED, {
        query: term,
        results_count: products.length,
      });
    }, 800); // waits 800ms after the user stops typing

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  function handleFilterChange(filterKey, value) {
    setFilters((current) => ({ ...current, [filterKey]: value }));
    trackingService.trackEvent(EVENTS.CLICKED_FILTER_OPTION, {
      filter_type: filterKey,
      value,
    });
  }

  async function handleLogout() {
    trackingService.trackEvent(EVENTS.CLICKED_LOGOUT, {
      source: "profile_page", // or "header" if this button also lives there
    });

    await supabase.auth.signOut();
    setLoggedInUser(null);
    setUserSession(null);
  }

  return (
    <>
      <Header
        userSession={userSession}
        wishlistIds={wishlistIds}
        onLogout={handleLogout}
      />

      <main id="matcher">
        {data && !isQuizEditing ? (
          <section className="panel profile-panel quiz-complete-panel" aria-label="Skin quiz completed">
            <div className="quiz-complete-message">
              <span className="quiz-complete-check" aria-hidden="true">&#10003;</span>
              <span>Skin quiz completed</span>
            </div>
            <button
              className="quiz-update-btn"
              onClick={() => setIsQuizEditing(true)}
              type="button"
            >
              Update Quiz
            </button>
          </section>
        ) : (
        <section className="panel profile-panel quiz-panel">
          {/* <div className="quiz-header">
            <span className="quiz-icon">✨</span>
            <div className="quiz-title-group">
              <h2>Free Skin Match Tool</h2>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: "100%" }}></div>
              </div>
            </div>
          </div> */}

          <div className="quiz-title-group">

            <h2>✨ Free Skin Match Studio</h2>
          </div>
          {/* Question 1: Skin Type */}
          <div className="quiz-section">
            <div className="section-title" style={{ marginBottom: "12px" }}>
              1. YOUR SKIN TYPE
            </div>
            <div className="chips skin-type-grid">
              {options.skinTypes.map((item) => {
                const active = profile.selectedSkinType === item;
                return (
                  <button
                    key={item}
                    type="button"
                    className={`chip skin-type-card ${active ? "active" : ""}`}
                    onClick={() => {
                      update("selectedSkinType", item);
                      trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
                        field: "skin_type",
                        question: "Skin type",
                        answer: item,
                        value: item,
                      });
                    }}
                  >
                    <div className="chip-icon-box">
                      {item === "Oily" && "💧"}
                      {item === "Dry" && "🌵"}
                      {item === "Combination" && "☯️"}
                      {item === "Normal" && "✨"}
                    </div>
                    <span className="chip-label">{item.toUpperCase()}</span>
                    {active && <span className="check-badge">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="sensitivity-row flex items-center justify-center flex-wrap gap-3">
              <span className="inline-label">
                Sensitive Skin?
              </span>

              <div className="sensitivity-toggle">
                {options.sensitivityOptions.map((item) => {
                  const active =
                    profile.selectedSensitive !== null &&
                    profile.selectedSensitive === (item === "Yes");

                  return (
                    <button
                      key={item}
                      type="button"
                      className={`toggle-btn ${active ? "active" : ""}`}
                      onClick={() => {
                        update("selectedSensitive", item === "Yes");
                        trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
                          field: "sensitivity",
                          question: "Sensitive skin",
                          answer: item,
                          value: item,
                        });
                      }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* NEW: Inline errors for skin type / sensitivity, shown after a submit attempt */}
            {missingFieldLabel === "Skin Type" ? (
              <p className="quiz-field-error" role="alert" style={{ fontSize: "13px", marginTop: "6px" }}>
                Please select your skin type
              </p>
            ) : null}
            {missingFieldLabel === "Sensitive Skin" ? (
              <p className="quiz-field-error" role="alert" style={{ fontSize: "13px", marginTop: "6px" }}>
                Please select whether your skin is sensitive
              </p>
            ) : null}
          </div>


          {/* Question 2: Skin Concerns */}
          <div className="quiz-section">
            <div className="section-title" style={{ marginBottom: "8px" }}>2. YOUR SKIN CONCERNS</div>
            <div className="concern-pills-wrap">
              {options.concerns.map((item) => {
                const active = profile.selectedFaceBodyConcerns.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    className={`concern-pill ${active ? "active" : ""}`}
                    onClick={() => {
                      update("selectedFaceBodyConcerns", [item]);
                      trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
                        field: "skin_concern",
                        question: "Skin concern",
                        answer: item,
                        value: item,
                      });
                    }}
                  >
                    {item} {active && <span className="pill-remove">×</span>}
                  </button>
                );
              })}
            </div>
            {/* NEW: Inline error for skin concerns, shown after a submit attempt */}
            {missingFieldLabel === "Skin Concern" ? (
              <p className="quiz-field-error" role="alert" style={{ fontSize: "13px", marginTop: "6px" }}>
                Please select a skin concern
              </p>
            ) : null}
          </div>

          {/* Question 3: Sensitive & Special Conditions */}
          <div className="quiz-section">
            <div className="section-title">3. SPECIAL CONDITIONS</div>
            <div className="special-conditions-wrap" style={{ marginTop: "8px" }}>
              <div className="concern-pills-wrap">
                {availableSpecials.map((item) => {
                  const active = profile.selectedSpecialConditions.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`concern-pill ${active ? "active" : ""}`}
                      onClick={() => selectSpecial(item)}
                    >
                      {item} {active && <span className="pill-remove">×</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* NEW: Inline error for special conditions, shown after a submit attempt */}
            {missingFieldLabel === "Special Condition" ? (
              <p className="quiz-field-error" role="alert" style={{ fontSize: "13px", marginTop: "6px" }}>
                Please select a special condition
              </p>
            ) : null}
          </div>

          {/* Question 4: Age & Gender */}
          {/* <div className="quiz-section"> */}
          {/* <div className="section-title">4. DEMOGRAPHICS</div> */}
          <div className="demographics-grid">
            <div className="select-field">
              {/* <label htmlFor="quiz-age-select">AGE GROUP</label> */}
              <select
                id="quiz-age-select"
                value={profile.age}
                onChange={(event) => {
                  update("age", event.target.value);
                  trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
                    field: "age",
                    question: "Age",
                    answer: event.target.value,
                    value: event.target.value,
                  });
                }}
              >
                <option value="" disabled>Age</option>
                <option value="Teen">Teen</option>
                <option value="Adult">Adult</option>
              </select>
              {/* NEW: Inline error for age group, shown after a submit attempt */}
              {missingFieldLabel === "Age Group" ? (
                <p className="quiz-field-error" role="alert" style={{ fontSize: "13px", marginTop: "6px" }}>
                  Please select age
                </p>
              ) : null}
            </div>

            <div className="select-field">
              {/* <label htmlFor="quiz-gender-select">GENDER IDENTITY</label> */}
              <select
                id="quiz-gender-select"
                value={profile.selectedGender}
                onChange={(event) => selectGender(event.target.value)}
              >
                <option value="" disabled>Gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer not to say">Prefer not to say</option>
              </select>
              {/* NEW: Inline error for gender, shown after a submit attempt */}
              {missingFieldLabel === "Gender" ? (
                <p className="quiz-field-error" role="alert" style={{ fontSize: "13px", marginTop: "6px" }}>
                  Please select gender
                </p>
              ) : null}
            </div>
          </div>
          {/* </div> */}

          <div className="quiz-footer">
            <div className="actions">
              {/* UPDATED: Button stays clickable so the missing-option prompt can show; loading still disables it */}
              <button
                className="primary find-matches-btn"
                disabled={loading}
                onClick={handleRefresh}
                type="button"
              >
                {loading ? "FINDING MATCHES..." : "FIND MY MATCHES"}
              </button>
            </div>
          </div>
        </section>
        )}

        {data ? (
          <section className="panel shop-panel" id="results">
            <div className="studio-toolbar">
              <div className="studio-title">
                <p style={{ textAlign: "center" }}>Your Matches!</p>
              </div>
              <div className="profile-pill">
                {profile.selectedSkinType} · {profile.selectedSensitive ? "Sensitive" : "Non-sensitive"} · {profile.selectedFaceBodyConcerns.join(", ")}
              </div>
            </div>

            <div aria-label="Result view" className="view-tabs">
              <button className={`view-tab ${view === "products" ? "active" : ""}`} onClick={() => handleViewChange("products")} type="button">Products</button>
              <button className={`view-tab ${view === "routine" ? "active" : ""}`} onClick={() => handleViewChange("routine")} type="button">Routine</button>
            </div>

            {error ? <div className="empty">{error}</div> : null}
            {loading ? <div className="empty">Loading Roopsee-style product preview...</div> : null}

            {!loading && !error && view === "products" ? (
              <div className="products-view">

                <div className="search-bar" style={{ marginBottom: "16px" }}>
                  <input
                    type="text"
                    placeholder="Search products or brands..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: "10px",
                      width: "100%",
                      borderRadius: "8px",
                      backgroundColor: "#fff",
                      border: "1px solid #ff0000",
                      fontSize: "15px",
                      fontcolor: "#333",
                    }}
                  />
                </div>

                <div className="filters" style={{ display: "grid" }}>
                  <label>
                    Score Range
                    <select value={filters.score} onChange={(event) => handleFilterChange("score", event.target.value)}>
                      <option value="all">All score ranges</option>
                      <option value="90_100">90-100</option>
                      <option value="80_89">80-89</option>
                      <option value="70_79">70-79</option>
                      <option value="60_69">60-69</option>
                      <option value="50_59">50-59</option>
                      <option value="below50">Below 50</option>
                    </select>
                  </label>
                  <label>
                    Category
                    <select value={filters.category} onChange={(event) => handleFilterChange("category", event.target.value)}>
                      <option value="all">All categories</option>
                      {filterValues("category").map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                  <label>
                    Product Type
                    <select value={filters.type} onChange={(event) => handleFilterChange("type", event.target.value)}>
                      <option value="all">All types</option>
                      {filterValues("product_type").map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                </div>
                {products.length ? (
                  <div className="product-grid">
                    {products.map((product) => (
                      <ProductCard key={product.product_uid} onVisit={handleVisitProduct} product={product} />
                    ))}
                  </div>
                ) : <div className="empty">No matching catalog products found for your criteria.</div>}

                {data?.returned < data?.total_matches && !searchQuery.trim() ? (
                  <div className="actions">
                    <button className="secondary" disabled={loading} onClick={handleLoadMore} type="button">
                      Load 500 more products
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!loading && !error && view === "routine" ? (
              <div className="routine-view">
                <RoutineView onOpen={handleOpenProduct} routine={data?.routine} />
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <ProductModal onClose={() => setModalProduct(null)} product={modalProduct} />
    </>
  );
}
