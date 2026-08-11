"use client";

import { useState } from "react";

const tabs = [
  { id: "description", label: "Description" },
  { id: "ingredients", label: "Ingredients" },
  { id: "usage", label: "How To Use" },
];

export default function MobileProductDetails({ description, ingredients, usageInstructions, heroIngredient, secondaryIngredients = [] }) {
  const [activeTab, setActiveTab] = useState("description");
  const [expanded, setExpanded] = useState(false);

  const ingredientSummary = [heroIngredient, ...secondaryIngredients].filter(Boolean).join(", ");
  const content = activeTab === "ingredients"
    ? ingredients || ingredientSummary || "Ingredient information is not listed for this product."
    : activeTab === "usage"
      ? usageInstructions || "Follow the directions printed on the product packaging."
      : description;

  return (
    <section className="mt-6 border-y border-slate-100 bg-white px-3 py-4 sm:mt-8 sm:rounded-3xl sm:border sm:px-7 sm:py-6 sm:shadow-sm">
      <h2 className="text-center text-[11px] font-semibold tracking-[0.16em] text-slate-800 sm:text-[13px]">PRODUCT DESCRIPTION</h2>
      <div aria-label="Product details" className="mt-3 flex justify-center gap-5 border-b border-slate-100 sm:mt-5 sm:gap-8" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              aria-controls="mobile-product-detail-content"
              aria-selected={isActive}
              className={`border-b pb-2 text-[8px] sm:text-[12px] ${isActive ? "border-[#e08a7d] text-[#d77465]" : "border-transparent text-slate-400"}`}
              id={`mobile-product-detail-tab-${tab.id}`}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setExpanded(false);
              }}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`mobile-product-detail-tab-${activeTab}`}
        className={`mx-auto mt-3 max-w-3xl text-[9px] leading-relaxed text-slate-600 sm:mt-5 sm:text-[13px] ${expanded ? "" : "line-clamp-5"}`}
        id="mobile-product-detail-content"
        role="tabpanel"
      >
        {content}
      </div>
      {content.length > 220 ? (
        <button
          className="mt-2 block w-full text-center text-[9px] text-[#d77465] sm:text-[12px]"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </section>
  );
}
