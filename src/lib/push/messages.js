// The rotating notification pool. Shared by the server (web-push) and the
// browser (direct showNotification), so copy only ever lives in one place.
//
// Each entry carries its own `tag`. The service worker passes tag straight to
// showNotification, and two notifications sharing a tag REPLACE one another —
// so a single shared tag would make a burst of test sends look like one
// notification that keeps changing.
export const NOTIFICATION_MESSAGES = [
  {
    id: "welcome",
    title: "Welcome to Roopsee 👋",
    body: "Discover skincare products matched to your skin and your needs.",
    url: "/",
  },
  {
    id: "know-your-skin",
    title: "Know Your Skin 🧴",
    body: "Not sure about your skin type? Take our quick skin quiz and find out.",
    url: "/MatchStudio",
  },
  {
    id: "perfect-match",
    title: "Find Your Perfect Match ✨",
    body: "Let Roopsee help you discover skincare products that suit your skin.",
    url: "/MatchStudio",
  },
  {
    id: "compare-before-buy",
    title: "Compare Before You Buy 💰",
    body: "Find the best prices for your favorite skincare products across marketplaces.",
    url: "/AllProducts",
  },
  {
    id: "deserves-better",
    title: "Your Skin Deserves Better 💖",
    body: "Explore products recommended for your skin concerns and goals.",
    url: "/AllProducts",
  },
  {
    id: "ingredients",
    title: "Curious About Ingredients? 🔍",
    body: "Understand what's inside your skincare products before you buy.",
    url: "/AllProducts",
  },
  {
    id: "journey-starts",
    title: "Your Skincare Journey Starts Here 🌸",
    body: "Take the Roopsee skin quiz and get personalized recommendations.",
    url: "/MatchStudio",
  },
  {
    id: "better-price",
    title: "Don't Miss a Better Price 👀",
    body: "Roopsee helps you compare prices so you can shop smarter.",
    url: "/AllProducts",
  },
  {
    id: "skincare-advice",
    title: "Need Skincare Advice? 💬",
    body: "Ask Roopsee about your skin, ingredients, products, and more.",
    url: "/",
  },
  {
    id: "discover-compare-choose",
    title: "Discover. Compare. Choose. 🛍️",
    body: "Your smarter way to find the right skincare products is here — Roopsee.",
    url: "/AllProducts",
  },
].map((message) => ({ ...message, tag: `roopsee-${message.id}` }));

export function messageById(id) {
  return NOTIFICATION_MESSAGES.find((message) => message.id === id) || null;
}

export function randomMessage() {
  return NOTIFICATION_MESSAGES[Math.floor(Math.random() * NOTIFICATION_MESSAGES.length)];
}

// Avoids showing the same message twice in a row, which during testing reads
// as "the random picker is broken" far more often than chance deserves.
export function randomMessageExcluding(previousId) {
  if (NOTIFICATION_MESSAGES.length < 2) return randomMessage();
  const pool = NOTIFICATION_MESSAGES.filter((message) => message.id !== previousId);
  return pool[Math.floor(Math.random() * pool.length)];
}
