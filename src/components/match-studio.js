"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { trackingService } from '@/lib/tracking/trackingClient';
import { EVENTS } from '@/lib/tracking/events';
import { DEFAULT_PROFILE } from "@/lib/default-profile";
import { productPath } from "@/lib/site";

const options = {
  skinTypes: ["Oily", "Dry", "Normal", "Combination"],
  sensitivityOptions: ["No", "Yes"],
  concerns: [
    "Acne",
    "Body Acne",
    "Dryness",
    "Open Pores",
    "Uneven Skin Tone",
    "Dark Spots/Pigmentation",
    "Melasma",
    "Barrier Repair",
    "Comedones",
    "Wrinkles/Fine lines",
    "Redness/Irritation",
    "Dehydration",
    "Dullness",
    "Tanning",
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
  if (score >= 80) return { label: "Good", className: "good" };
  if (score >= 60) return { label: "Present", className: "present" };
  return { label: "Weak", className: "weak" };
}

function formatPrice(product) {
  const value = product.selling_price || product.mrp;
  return value ? `Rs. ${value}` : "Price unavailable";
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

function ProductCard({ product, onVisit }) {
  const band = scoreBand(product.score);
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <ProductImage product={product} />
        <div className={`score-badge score-${band.className}`}>
          <div>{product.score}<small>{band.label}</small></div>
        </div>
      </div>
      <div className="product-body">
        <div>
          <h3>{product.product_name}</h3>
          <p className="product-meta">{product.brand_name} · {product.category} · {product.product_type}</p>
        </div>
        <div className="price-row">
          <span>{formatPrice(product)}</span>
          {product.mrp && product.selling_price && product.mrp !== product.selling_price
            ? <del>Rs. {product.mrp}</del>
            : null}
        </div>
        <div className="tagline">
          <span className="tag">{rangeLabel(scoreRange(product.score))}</span>
          <span className="tag">{product.when_to_use || "Routine"}</span>
          <span className="tag">{product.size || "Size unavailable"}</span>
        </div>
        <Link
          className="details-link"
          href={productPath(product.product_uid)}
          onClick={() => onVisit(product)}
        >
          View product details
        </Link>
      </div>
    </article>
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
      <div className={`routine-score score-${band.className}`}>{product.score}</div>
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
              <div className="detail-box"><span>Score</span><strong className={`score-${band.className}`}>{product.score} · {band.label}</strong></div>
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
              <Link className="details-link" href={productPath(product.product_uid)}>
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
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("products");
  const [modalProduct, setModalProduct] = useState(null);
  const [filters, setFilters] = useState({ score: "all", category: "all", type: "all", sheet: "all" });
  const [limit, setLimit] = useState(initialData?.returned || 24);

  // Page view — fires once on mount, same pattern as your other Roopsee pages.
  const recommend = useCallback(async (nextProfile, nextLimit = 24) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/recommend?limit=${nextLimit}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextProfile),
      });
      const payload = await response.json();
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

  const products = useMemo(() => (data?.products || []).filter((product) => {
    if (filters.score !== "all" && scoreRange(product.score) !== filters.score) return false;
    if (filters.category !== "all" && product.category !== filters.category) return false;
    if (filters.type !== "all" && product.product_type !== filters.type) return false;
    if (filters.sheet !== "all" && product.source_sheet !== filters.sheet) return false;
    return true;
  }), [data, filters]);

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
      selectedSpecialConditions: specials.length ? specials : ["None"],
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
    update("selectedSpecialConditions", next.length ? next : ["None"]);
    trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
      field: "special_condition",
      question: "Special condition",
      answer: item,
      value: item,
    });
  }

  // Every product-card / routine-card open funnels through here so the
  // click event always carries which product and its score.
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

  async function handleRefresh() {
    trackingService.trackEvent(EVENTS.QUIZ_UPDATED, {
      ...profile,
      quizAnswerSummary: [
        profile.selectedSkinType,
        profile.selectedSensitive ? "Sensitive" : "Not sensitive",
        ...profile.selectedFaceBodyConcerns,
        ...profile.selectedSpecialConditions,
        profile.age,
        profile.selectedGender,
      ].join(" | "),
    });
    await recommend(profile, 24);
    window.requestAnimationFrame(() => {
      document.getElementById("results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleLoadMore() {
    const nextLimit = Math.min(limit + 24, data?.total_matches || limit + 24);
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
    setView("products");
    setModalProduct(null);
    trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
      field: "skincare_guide",
      question: "Skincare guide",
      answer: guide.label,
      value: guide.slug,
    });
    recommend(nextProfile, 24);
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
    trackingService.trackPageLoad(EVENTS.PAGE_VIEWED_SHOP_PRODUCTS, {
      page_type: "match_studio",
    });

    const selectedGuide = new URLSearchParams(window.location.search).get("guide");
    const guide = guideLinks.find((item) => item.slug === selectedGuide);
    if (!guide) return undefined;

    const applyTimer = window.setTimeout(() => applyGuide(guide, false), 0);
    return () => window.clearTimeout(applyTimer);
  }, [applyGuide]);

  function handleFilterChange(filterKey, value) {
    setFilters((current) => ({ ...current, [filterKey]: value }));
    trackingService.trackEvent(EVENTS.CLICKED_FILTER_OPTION, {
      filter_type: filterKey,
      value,
    });
  }

  return (
    <>
      <header>
        <div className="eyebrow">Personalised skincare product matcher</div>
        <h1>Find skincare products for your skin profile</h1>
        {/* <p>
          Select your skin type, sensitivity, age and main concern. Roopsee compares applicable
          catalog scores and ranks products for a practical morning, night and weekly routine.
        </p> */}
      </header>

      <main id="matcher">
        <section className="panel profile-panel quiz-panel">
          <div className="section-title">Skin Type *</div>
          <ChipGroup
            isActive={(item) => profile.selectedSkinType === item}
            items={options.skinTypes}
            onSelect={(item) => {
              update("selectedSkinType", item);
              trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
                field: "skin_type",
                question: "Skin type",
                answer: item,
                value: item,
              });
            }}
          />

          <div className="section-title">Sensitive? *</div>
          <ChipGroup
            isActive={(item) => profile.selectedSensitive === (item === "Yes")}
            items={options.sensitivityOptions}
            onSelect={(item) => {
              update("selectedSensitive", item === "Yes");
              trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
                field: "sensitivity",
                question: "Sensitive skin",
                answer: item,
                value: item,
              });
            }}
          />

          <div className="section-title">Skin Concern (Choose 1) *</div>
          <ChipGroup
            isActive={(item) => profile.selectedFaceBodyConcerns.includes(item)}
            items={options.concerns}
            onSelect={(item) => {
              update("selectedFaceBodyConcerns", [item]);
              trackingService.trackEvent(EVENTS.CLICKED_QUIZ_OPTION, {
                field: "skin_concern",
                question: "Skin concern",
                answer: item,
                value: item,
              });
            }}
          />

          <div className="section-title">Special Conditions *</div>
          <ChipGroup
            isActive={(item) => profile.selectedSpecialConditions.includes(item)}
            items={availableSpecials}
            onSelect={selectSpecial}
          />

          <div className="row">
            <div>
              <div className="section-title">Age</div>
              <select
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
                <option>Teen</option>
                <option>Adult</option>
              </select>
            </div>
            <div>
              <div className="section-title">Gender</div>
              <select value={profile.selectedGender} onChange={(event) => selectGender(event.target.value)}>
                <option>female</option>
                <option>male</option>
                <option>other</option>
                <option>prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="actions">
            <button className="primary" disabled={loading} onClick={handleRefresh} type="button">
              {loading ? "Loading Product Preview..." : "Refresh Product Preview"}
            </button>
          </div>

          <details className="payload-details">
            <summary>Testing payload</summary>
            <pre className="json-box">{JSON.stringify(profile, null, 2)}</pre>
          </details>

          <div className="profile-guides">
            <div className="routine-section-title">Explore skincare guides</div>
            <div className="tagline">
              {guideLinks.map((guide) => (
                <Link
                  className="tag"
                  href={`/skincare-for/${guide.slug}`}
                  key={guide.slug}
                  onClick={(event) => handleGuideClick(event, guide)}
                >
                  {guide.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="panel shop-panel" id="results">
          <div className="studio-toolbar">
            <div className="studio-title">
              <h2>Recommended for this profile</h2>
              {/* <p>
                {view === "routine"
                  ? "Routine picks are split into Premium and Value Fit, using score plus effective price."
                  : `Showing ${products.length} of ${data?.total_matches || 0} matching catalog products. Any -100 component stays a hard blocker.`}
              </p> */}
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
              {/* <div className="summary-grid">
                <Metric label="Showing" value={products.length} />
                <Metric label="90-100" value={counts["90_100"]} />
                <Metric label="80-89" value={counts["80_89"]} />
                <Metric label="70-79" value={counts["70_79"]} />
                <Metric label="60-69" value={counts["60_69"]} />
                <Metric label="50-59" value={counts["50_59"]} />
                <Metric label="Below 50" value={counts.below50} />
              </div> */}

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
                <label>
                  Score Sheet
                  <select value={filters.sheet} onChange={(event) => handleFilterChange("sheet", event.target.value)}>
                    <option value="all">All sheets</option>
                    {filterValues("source_sheet").map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
              </div>

              {products.length ? (
                <div className="product-grid">
                  {products.map((product) => (
                    <ProductCard key={product.product_uid} onVisit={handleVisitProduct} product={product} />
                  ))}
                </div>
              ) : <div className="empty">No matching catalog products found for this profile.</div>}
              {data?.returned < data?.total_matches ? (
                <div className="actions">
                  <button className="secondary" disabled={loading} onClick={handleLoadMore} type="button">
                    Load 24 more products
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
      </main>

      {/* <main>
        <aside className="panel profile-panel">
          <div className="studio-title">
            <h2>How Roopsee matching works</h2>
          </div>
          <p>
            Each product is compared using the score components applicable to its product type.
            These can include age, concern, skin type, sensitivity and selected special conditions.
          </p>
          <p>
            Applicable scores are averaged and rounded. A -100 component remains a hard blocker,
            so an unsuitable condition is not hidden by otherwise positive scores.
          </p>
          <div className="warnings">
            This tool supports product discovery and does not diagnose or treat a skin condition.
            Seek qualified medical advice for persistent, painful, severe or worsening symptoms.
          </div>
        </aside>

        <section className="panel shop-panel">
          <div className="studio-title">
            <h2>Skincare matching questions</h2>
            <p>Clear answers about how to use the recommendations.</p>
          </div>
          <section>
            <div className="routine-section-title">What does a higher match score mean?</div>
            <p>
              A higher score means the product aligns more closely with the selected profile using
              the applicable catalog score components. It does not guarantee a clinical outcome.
            </p>
          </section>
          <section>
            <div className="routine-section-title">Why do different product types use different scores?</div>
            <p>
              Cleansers, serums, moisturisers and sunscreens play different roles, so the matcher
              applies product-specific rules instead of treating every product identically.
            </p>
          </section>
          <section>
            <div className="routine-section-title">How should I start a new routine?</div>
            <p>
              Introduce products gradually, follow their directions and patch test when appropriate.
              Stop a product that causes persistent irritation and obtain professional advice when needed.
            </p>
          </section>
          <p><small>Catalog and matching guidance updated July 2026.</small></p>
          </section>
      </main> */}

      <ProductModal onClose={() => setModalProduct(null)} product={modalProduct} />
    </>
  );
}
