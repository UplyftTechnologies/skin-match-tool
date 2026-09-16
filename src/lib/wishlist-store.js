// Shared persistence logic, independent of React so reload/race behavior is testable.
export function wishlistMatches(product, uid) {
  const id = String(uid);
  return String(product.product_uid) === id ||
    (product.retailer_product_id != null && String(product.retailer_product_id) === id);
}

export class WishlistStore {
  constructor({ storage, request, onChange }) {
    this.storage = storage;
    this.request = request;
    this.onChange = onChange;
    this.session = null;
    this.epoch = 0;
    this.items = [];
    this.pending = new Map();
    this.hydrated = false;
    this.error = '';
    this.running = null;
  }

  emit() {
    this.onChange({ items: [...this.items], hydrated: this.hydrated, error: this.error,
      syncing: this.pending.size > 0 });
  }

  persist() {
    if (!this.session) return;
    try {
      this.storage.setItem(`wishlist_products:${this.session.user.id}`, JSON.stringify({
        items: this.items, pending: [...this.pending],
      }));
    } catch {
      this.error = 'Browser storage is unavailable. Keep this page open until saving finishes.';
    }
  }

  async setSession(session) {
    if (session?.user.id === this.session?.user.id && this.hydrated) {
      this.session = session; // Token refresh must not reload stale data over edits.
      return;
    }
    this.session = session;
    const epoch = ++this.epoch;
    this.items = [];
    this.pending = new Map();
    this.running = null;
    this.error = '';
    this.hydrated = !session;
    if (session) {
      try {
        const saved = JSON.parse(this.storage.getItem(`wishlist_products:${session.user.id}`) || '{}');
        this.items = Array.isArray(saved.items) ? saved.items.filter(p => p?.product_uid != null) : [];
        this.pending = new Map(Array.isArray(saved.pending) ? saved.pending : []);
      } catch { /* A malformed cache must not prevent loading the account's list. */ }
    }
    this.emit();
    if (session) await this.load(epoch);
  }

  async api(method, productUid) {
    const response = await this.request('/api/wishlist', {
      method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.session.access_token}` },
      ...(method !== 'GET' ? { body: JSON.stringify({ productUid }) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Wishlist request failed');
    if (method === 'GET' && !Array.isArray(data.products)) throw new Error('Invalid wishlist response');
    return data;
  }

  async load(epoch = this.epoch) {
    try {
      const data = await this.api('GET');
      if (epoch !== this.epoch) return;
      const items = new Map(data.products.map(p => [String(p.product_uid), p]));
      for (const [uid, operation] of this.pending) {
        if (operation.add) items.set(uid, operation.product);
        else items.delete(uid);
      }
      this.items = [...items.values()];
      this.error = '';
    } catch {
      if (epoch !== this.epoch) return;
      this.error = 'Could not load your saved products. Previously loaded products have been kept. Please retry.';
    }
    if (epoch !== this.epoch) return;
    this.hydrated = true;
    this.persist();
    this.emit();
    await this.flush();
  }

  change(product, add) {
    if (!this.session || !this.hydrated) return false;
    const uid = String(product.product_uid);
    const normalized = { ...product, product_uid: uid };
    this.items = this.items.filter(item => String(item.product_uid) !== uid);
    if (add) this.items.push(normalized);
    this.pending.set(uid, { add, product: normalized });
    this.error = '';
    // Persist the operation before sending it, so refresh mid-request can retry.
    this.persist();
    this.emit();
    void this.flush();
    return true;
  }

  flush() {
    if (this.running) return this.running;
    if (!this.session || !this.pending.size) return Promise.resolve();
    const epoch = this.epoch;
    const run = async () => {
      while (epoch === this.epoch && this.pending.size) {
        const [uid, operation] = this.pending.entries().next().value;
        try {
          const data = await this.api(operation.add ? 'POST' : 'DELETE', uid);
          if (epoch !== this.epoch) return;
          // A rapid second click may have queued a newer operation for this UID.
          if (this.pending.get(uid) === operation) {
            this.pending.delete(uid);
            if (operation.add && data.product) {
              this.items = this.items.map(p => String(p.product_uid) === uid ? data.product : p);
            }
          }
          this.error = '';
          this.persist();
          this.emit();
        } catch {
          if (epoch !== this.epoch) return;
          this.error = 'Wishlist changes are saved on this device but could not sync to your account. Please retry.';
          this.persist();
          this.emit();
          return;
        }
      }
    };
    this.running = run().finally(() => { if (epoch === this.epoch) this.running = null; });
    return this.running;
  }

  async retry() {
    if (!this.session) return;
    if (this.pending.size) return this.flush();
    this.hydrated = false;
    this.emit();
    return this.load();
  }

  dispose() { this.epoch++; }
}
