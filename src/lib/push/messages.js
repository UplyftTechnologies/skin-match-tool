// The onboarding notification drip. Shared by the server (web-push) and the
// browser, so copy only ever lives in one place.
//
// `delayMinutes` is measured from the moment a device subscribes, so every
// subscriber walks the same sequence starting from their own day zero rather
// than everyone receiving the same message on the same calendar day. The gaps
// widen deliberately: a burst in week one then a slow tail, which is what keeps
// people from muting the site outright.
//
// Each entry carries its own `tag`. The service worker passes tag straight to
// showNotification, and two notifications sharing a tag REPLACE one another —
// so a single shared tag would make a burst of test sends look like one
// notification that keeps changing.
export const NOTIFICATION_MESSAGES = [
  {
    id: "welcome",
    delayMinutes: 5, // 5 minutes
    title: "Welcome to Roopsee 👋",
    body: "Discover skincare products matched to your skin and your needs.",
    url: "/",
  },
  {
    id: "know-your-skin",
    delayMinutes: 60, // 1 hour
    title: "Know Your Skin 🧴",
    body: "Not sure about your skin type? Take our quick skin quiz and find out.",
    url: "/MatchStudio",
  },
  {
    id: "perfect-match",
    delayMinutes: 360, // 6 hours
    title: "Find Your Perfect Match ✨",
    body: "Let Roopsee help you discover skincare products that suit your skin.",
    url: "/MatchStudio",
  },
  {
    id: "compare-before-buy",
    delayMinutes: 1440, // 1 day
    title: "Compare Before You Buy 💰",
    body: "Find the best prices for your favorite skincare products across marketplaces.",
    url: "/AllProducts",
  },
  {
    id: "deserves-better",
    delayMinutes: 2880, // 2 days
    title: "Your Skin Deserves Better 💖",
    body: "Explore products recommended for your skin concerns and goals.",
    url: "/AllProducts",
  },
  {
    id: "ingredients",
    delayMinutes: 4320, // 3 days
    title: "Curious About Ingredients? 🔍",
    body: "Understand what's inside your skincare products before you buy.",
    url: "/AllProducts",
  },
  {
    id: "journey-starts",
    delayMinutes: 7200, // 5 days
    title: "Your Skincare Journey Starts Here 🌸",
    body: "Take the Roopsee skin quiz and get personalized recommendations.",
    url: "/MatchStudio",
  },
  {
    id: "better-price",
    delayMinutes: 10080, // 7 days
    title: "Don't Miss a Better Price 👀",
    body: "Roopsee helps you compare prices so you can shop smarter.",
    url: "/AllProducts",
  },
  {
    id: "skincare-advice",
    delayMinutes: 14400, // 10 days
    title: "Need Skincare Advice? 💬",
    body: "Ask Roopsee about your skin, ingredients, products, and more.",
    url: "/",
  },
  {
    id: "discover-compare-choose",
    delayMinutes: 20160, // 14 days
    title: "Discover. Compare. Choose. 🛍️",
    body: "Your smarter way to find the right skincare products is here — Roopsee.",
    url: "/AllProducts",
  },
].map((message) => ({ ...message, tag: `roopsee-${message.id}` }));

// Everything due for a subscriber of this age that has not been sent yet,
// oldest first — so a device that was offline for a week catches up in order
// instead of jumping to the newest message.
export function dueMessages(subscribedAt, alreadySentIds = []) {
  const sent = new Set(alreadySentIds);
  const elapsedMinutes = (Date.now() - new Date(subscribedAt).getTime()) / 60000;
  return NOTIFICATION_MESSAGES
    .filter((message) => !sent.has(message.id) && elapsedMinutes >= message.delayMinutes)
    .sort((left, right) => left.delayMinutes - right.delayMinutes);
}

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
