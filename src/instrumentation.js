// Runs once when the server process starts, before it serves anything.
//
// The retailer catalogue takes ~8-10 seconds to build: 19k rows from Supabase,
// then the dedupe and size-variant collapse. Route modules are loaded lazily,
// so warming from inside one of them still leaves the first request paying for
// it — measured at 13.7s for a visual search against a cold cache versus 2.2s
// once warm. This hook is the only place that reliably runs earlier.
/**
 * Warms the API route itself, over HTTP, shortly after boot.
 *
 * register() runs before the server is listening, and Next bundles route
 * handlers separately from this file — so warming a function here JIT-warms
 * a different copy of it than the one a request will reach. One real request
 * against the route is the only thing that warms the code that actually
 * serves traffic. Fire and forget: nothing waits on it.
 */
function selfWarm() {
  const port = process.env.PORT || 3000;
  const base = `http://127.0.0.1:${port}`;
  const started = Date.now();

  setTimeout(() => {
    fetch(
      `${base}/api/retailer-products/catalog?bands=3&skinType=Normal&sensitive=0&age=Adult&concern=Acne`,
    )
      .then(() => {
        console.log(`[warmup] route ready in ${Date.now() - started}ms`);
      })
      .catch(() => {
        // The server may not be accepting connections yet, or the port may
        // differ behind a proxy. The first real request just pays the cost.
      });
  }, 1500).unref?.();
}

export async function register() {
  // Edge and build phases have neither the Node APIs this needs nor a reason
  // to warm anything.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const started = Date.now();
  try {
    const { warmRetailerCatalog } = await import("@/lib/retailer-catalog");
    const products = await warmRetailerCatalog();
    console.log(`[warmup] catalogue ready: ${products.length} products in ${Date.now() - started}ms`);

    // The scoring path has two separate first-use costs, both measured on a
    // cold process: reading and indexing the 16MB dataset, and the JIT
    // warming up the engine itself — the first scoreAll took 12.6s against
    // 610ms for every later one over the same 14k products. Running one
    // throwaway pass here pays both before anyone is waiting.
    const scoringStarted = Date.now();
    const { scoreAll } = await import("@/lib/scoring/engine");
    const warmRows = scoreAll({
      skinType: "Normal",
      sensitive: false,
      age: "Adult",
      gender: "female",
      concern: "Acne",
      specialConditions: ["None"],
    });
    console.log(
      `[warmup] scoring ready: ${warmRows.length} products in ${Date.now() - scoringStarted}ms`,
    );

    selfWarm();
  } catch (error) {
    // Never block startup on this. A failed warm-up just means the first
    // request rebuilds, which is the behaviour we had before.
    console.error("[warmup] catalogue failed, will build on first request:", error?.message || error);
  }
}
