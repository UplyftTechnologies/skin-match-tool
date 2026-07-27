
'use client';

import {
  getVisitorId as readVisitorId,
  getSessionId as readSessionId,
  getLoggedInUserId,
  getLoggedInUserName,
  getLoggedInUserPhone,
  identifyAcrossTools,
  setLoggedInUser,
} from './identity.js';
import { supabase } from '../supabase/client.js';

// Hard ceiling on how long location lookup may delay an event.
const LOCATION_BUDGET_MS = 4000;
const GPS_BUDGET_MS = 3000;

class TrackingService {
  constructor() {
    this.config = {
      googleAnalyticsEnabled: true,
      clarityEnabled: true,
      amplitudeEnabled: true,
      // Telegram always goes through the server route (/api/events) — see
      // the trackToTelegram() method below.
      telegramEnabled: true,
      customAnalyticsEnabled: false,
      // GPS prompts on page load hurt conversion and can hang the whole
      // pipeline. IP location is plenty for analytics. Opt in if you must.
      gpsEnabled: false,
    };

    this.amplitudeClient = null;

    this.locationData = null;
    this.locationPromise = null;

    this._exitFired = false;
  }

  /** Call once, e.g. in a top-level ClientProviders component. Currently a
   * no-op placeholder — kept so future sinks (or Supabase, if you re-add it
   * later) have one obvious place to initialize from. */
  init() {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Tracking service initialized');
    }
  }

  initializeAmplitude(amplitudeInstance) {
    this.amplitudeClient = amplitudeInstance;
  }

  // ==========================================
  // LOCATION
  // ==========================================

  async fetchLocationFromIP() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const res = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) return {};

      const data = await res.json().catch(() => ({}));

      return {
        city: data.city || null,
        region: data.region || null,
        country: data.country_name || null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        source: 'ip',
      };
    } catch (error) {
      console.warn('IP location failed:', error?.message);
      return {};
    }
  }

  async fetchLocationFromGPS() {
    if (!this.config.gpsEnabled) return null;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

    // Never trigger a fresh prompt — only use GPS if already granted.
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' });
      if (status && status.state !== 'granted') return null;
    } catch {
      // Permissions API unavailable — the wall-clock timer below covers us.
    }

    return new Promise((resolve) => {
      let settled = false;

      const done = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(wallClock);
        resolve(value);
      };

      const wallClock = setTimeout(() => done(null), GPS_BUDGET_MS);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;

          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);

            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
              { signal: controller.signal }
            );

            clearTimeout(timer);
            const data = await res.json().catch(() => ({}));

            done({
              city: data.city || data.locality || null,
              region: data.principalSubdivision || null,
              country: data.countryName || null,
              latitude,
              longitude,
              source: 'gps',
            });
          } catch {
            done({ latitude, longitude, source: 'gps' });
          }
        },
        () => done(null),
        { timeout: GPS_BUDGET_MS, maximumAge: 600000 }
      );
    });
  }

  async getLocationData() {
    if (this.locationData) return this.locationData;

    if (!this.locationPromise) {
      this.locationPromise = (async () => {
        const gps = await this.fetchLocationFromGPS();
        if (gps) return gps;

        return await this.fetchLocationFromIP();
      })();
    }

    try {
      this.locationData = await this.locationPromise;
    } catch {
      this.locationData = {};
    }

    return this.locationData || {};
  }

  /** Location must never be able to block an event. Budget it. */
  async getLocationDataBounded() {
    try {
      return await Promise.race([
        this.getLocationData(),
        new Promise((resolve) => setTimeout(() => resolve({}), LOCATION_BUDGET_MS)),
      ]);
    } catch {
      return {};
    }
  }

  // ==========================================
  // DIRECT LANDING DETECTION
  // ==========================================

  /** True only the first time this is called in a given browser tab/session. */
  isDirectLanding() {
    try {
      if (sessionStorage.getItem('app_landing_tracked')) {
        return false; // a landing was already tracked in this tab/session
      }

      if (document.referrer) {
        try {
          const referrerOrigin = new URL(document.referrer).origin;
          if (referrerOrigin === window.location.origin) {
            return false;
          }
        } catch {
          // malformed referrer — fall through and treat as landing
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /** Call once a landing has actually been reported, so it isn't double-counted. */
  markLandingTracked() {
    try {
      sessionStorage.setItem('app_landing_tracked', '1');
    } catch {
      /* ignore — worst case a refresh in the same tab re-fires once */
    }
  }

  /**
   * Drop-in replacement for a page's normal `trackEvent(EVENTS.PAGE_VIEWED_X, props)`
   * call. Fires the exact same event, just with `is_direct_landing` (and,
   * only on that first landing, `entry_page`) stamped onto it.
   */
  trackPageLoad(eventName, properties = {}) {
    const isLanding = this.isDirectLanding();

    if (isLanding) {
      this.markLandingTracked();
    }

    return this.trackEvent(eventName, {
      ...properties,
      is_direct_landing: isLanding,
      ...(isLanding ? { entry_page: properties.page_type || eventName } : {}),
    });
  }

  // ==========================================
  // MAIN TRACKING FUNCTION
  // ==========================================

  async trackEvent(eventName, properties = {}) {
    if (!eventName || typeof eventName !== 'string') {
      console.error('Invalid event name:', eventName);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const metadata = user.user_metadata || {};
        setLoggedInUser({
          id: user.id,
          name: metadata.full_name || metadata.name || '',
          phone: user.phone || metadata.phone_no || metadata.phone || '',
        });
      } else {
        setLoggedInUser(null);
      }
    } catch (error) {
      console.warn('Supabase tracking identity sync failed:', error);
    }

    try {
      identifyAcrossTools();
    } catch (error) {
      console.warn('identifyAcrossTools failed:', error);
    }

    const location = await this.getLocationDataBounded();

    let enrichedProperties;

    try {
      enrichedProperties = this.enrichProperties(properties, location);
    } catch (error) {
      console.error('enrichProperties failed — using minimal payload:', error);

      enrichedProperties = {
        ...properties,
        userId: null,
        userName: '',
        phone: '',
        visitorId: this.getVisitorId(),
        sessionId: this.getSessionId(),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        enrich_failed: true,
      };
    }

    const trackingPromises = [];

    if (this.config.googleAnalyticsEnabled) {
      trackingPromises.push(this.trackToGoogleAnalytics(eventName, enrichedProperties));
    }

    if (this.config.clarityEnabled) {
      trackingPromises.push(this.trackToClarity(eventName, enrichedProperties));
    }

    if (this.config.amplitudeEnabled) {
      trackingPromises.push(this.trackToAmplitude(eventName, enrichedProperties));
    }

    if (this.config.telegramEnabled) {
      trackingPromises.push(this.trackToTelegram(eventName, enrichedProperties));
    }

    const results = await Promise.allSettled(trackingPromises);

    const failures = results.filter((r) => r.status === 'rejected');

    if (failures.length) {
      console.warn(
        `[tracking] ${failures.length}/${results.length} sinks failed for "${eventName}"`,
        failures.map((f) => f.reason?.message || f.reason)
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Event tracked: ${eventName}`, { properties: enrichedProperties, results });
    }

    return enrichedProperties;
  }

  // ==========================================
  // PLATFORM-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  trackToGoogleAnalytics(eventName, properties) {
    return new Promise((resolve, reject) => {
      try {
        if (!window.gtag) {
          console.warn('Google Analytics not loaded');
          resolve();
          return;
        }

        const eventData = {
          ...properties,
          // Keep Supabase's canonical field names available in GA as well.
          event_name: eventName,
          visitor_id: properties.visitorId,
          session_id: properties.sessionId,
          event_source: 'unified_tracking',
        };

        if (eventName.startsWith('page_viewed_')) {
          eventData.event_category = 'page_view';
          eventData.page_path = `/${eventName.replace('page_viewed_', '').replace(/_/g, '-')}`;
        } else if (eventName.startsWith('clicked_')) {
          eventData.event_category = 'engagement';
          eventData.event_label = eventName.replace('clicked_', '');
        } else if (eventName === 'quiz_completed' || eventName === 'quiz_updated') {
          eventData.event_category = 'form_submission';
          eventData.event_label = eventName === 'quiz_completed' ? 'quiz_first_submit' : 'quiz_update';
        } else {
          eventData.event_category = 'user_action';
        }

        // Don't ship PII to GA — it's against their ToS and can get the
        // property terminated.
        delete eventData.phone;
        delete eventData.userName;
        delete eventData.user_agent;

        window.gtag('event', eventName, eventData);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  trackToClarity(eventName, properties) {
    return new Promise((resolve, reject) => {
      try {
        if (!window.clarity) {
          console.warn('Clarity not loaded');
          resolve();
          return;
        }

        const { phone, ...safeProperties } = properties;

        if (properties.userId) {
          window.clarity('set', 'user_id', properties.userId);
        }

        window.clarity('set', 'event_name', eventName);
        window.clarity('set', 'visitor_id', properties.visitorId);
        window.clarity('set', 'session_id', properties.sessionId);
        window.clarity('set', 'custom_properties', JSON.stringify(safeProperties));
        window.clarity('event', eventName);

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  trackToAmplitude(eventName, properties) {
    return new Promise((resolve, reject) => {
      try {
        const client = this.amplitudeClient || window.amplitude;

        if (!client) {
          console.warn('Amplitude not loaded');
          resolve();
          return;
        }

        if (properties.userId && typeof client.setUserId === 'function') {
          client.setUserId(properties.userId);
        }

        const { phone, ...safeProperties } = properties;

        if (typeof client.track === 'function') {
          client.track(eventName, safeProperties);
        } else if (typeof client.logEvent === 'function') {
          client.logEvent(eventName, safeProperties);
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Forwards to /api/events, which sends the Telegram alert server-side.
   * The bot token never touches the browser bundle this way.
   */
  trackToTelegram(eventName, properties) {
    return fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, ...properties }),
      keepalive: true,
    }).then(async (res) => {
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.eventSaved) {
        throw new Error(result.error || `/api/events responded ${res.status}`);
      }
      return result;
    });
  }

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  enrichProperties(properties, location = {}) {
    const userId = properties.userId || this.getUserId();
    const userName = properties.userName || this.getUserName();
    const phone = properties.phone || this.getUserPhone();
    const visitorId = this.getVisitorId();
    const sessionId = this.getSessionId();

    const userAgentInfo = this.parseUserAgent(navigator.userAgent);

    return {
      ...properties,
      ...location,

      userId,
      userName,
      phone,
      visitorId,
      sessionId,

      device: properties.device || userAgentInfo.device,
      platform: properties.platform || userAgentInfo.platform,
      browser: properties.browser || userAgentInfo.browser,
      language: properties.language || navigator.language || '',

      timestamp: new Date().toISOString(),
      time_ist: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),

      url: window.location.href,
      page: window.location.href,
      user_agent: navigator.userAgent,
      referrer: document.referrer,
      screen_resolution: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  parseUserAgent(userAgent = '') {
    const ua = String(userAgent);

    let browser = 'Unknown Browser';
    let platform = 'Unknown Platform';
    let device = 'Desktop';

    if (/edg/i.test(ua)) browser = 'Microsoft Edge';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/opr|opera/i.test(ua)) browser = 'Opera';

    if (/windows/i.test(ua)) platform = 'Windows';
    else if (/mac os|macintosh/i.test(ua)) platform = 'macOS';
    else if (/android/i.test(ua)) platform = 'Android';
    else if (/iphone|ipad|ios/i.test(ua)) platform = 'iOS';
    else if (/linux/i.test(ua)) platform = 'Linux';

    if (/tablet|ipad/i.test(ua)) device = 'Tablet';
    else if (/mobile/i.test(ua)) device = 'Mobile';

    return { browser, platform, device };
  }

  getUserId() {
    try {
      return getLoggedInUserId?.() || null;
    } catch {
      return null;
    }
  }

  getUserName() {
    try {
      return getLoggedInUserName?.() || '';
    } catch {
      return '';
    }
  }

  getUserPhone() {
    try {
      return getLoggedInUserPhone?.() || '';
    } catch {
      return '';
    }
  }

  getVisitorId() {
    try {
      return readVisitorId();
    } catch {
      return null;
    }
  }

  getSessionId() {
    try {
      return readSessionId();
    } catch {
      return null;
    }
  }

  // ==========================================
  // DIAGNOSTICS
  // Run trackingService.selfTest() in the browser console to see what's wired up.
  // ==========================================

  selfTest() {
    const report = {
      gtag: typeof window.gtag === 'function',
      clarity: typeof window.clarity === 'function',
      amplitude: !!(this.amplitudeClient || window.amplitude),
      identity: {
        userId: this.getUserId(),
        userName: this.getUserName(),
        phone: this.getUserPhone() ? '✅ present' : '(empty)',
        visitorId: this.getVisitorId(),
        sessionId: this.getSessionId(),
      },
      config: this.config,
    };

    console.table(report);
    return report;
  }

  // ==========================================
  // CONVENIENCE METHODS
  // ==========================================

  trackPageView(pageName) {
    const eventName = `page_viewed_${pageName.toLowerCase().replace(/\//g, '_').replace(/\s+/g, '_')}`;
    return this.trackEvent(eventName, { page_type: 'page_view' });
  }

  trackClick(actionName, properties = {}) {
    return this.trackEvent(`clicked_${actionName.toLowerCase().replace(/\s+/g, '_')}`, {
      event_type: 'click',
      ...properties,
    });
  }

  trackFormSubmission(formName, properties = {}) {
    return this.trackEvent(`${formName.toLowerCase().replace(/\s+/g, '_')}_completed`, {
      event_type: 'form_submission',
      ...properties,
    });
  }

  trackError(errorName, errorDetails = {}) {
    return this.trackEvent('form_error', {
      error_name: errorName,
      error_type: 'error',
      ...errorDetails,
    });
  }

  enablePlatform(platformName) {
    if (this.config[`${platformName}Enabled`] !== undefined) {
      this.config[`${platformName}Enabled`] = true;
    }
  }

  disablePlatform(platformName) {
    if (this.config[`${platformName}Enabled`] !== undefined) {
      this.config[`${platformName}Enabled`] = false;
    }
  }

  // ==========================================
  // EXIT TRACKING
  // ==========================================

  trackPageLeave(pageName) {
    if (this._exitFired) return;
    this._exitFired = true;

    const eventName = `left_site_${pageName.toLowerCase().replace(/\//g, '_').replace(/\s+/g, '_')}`;

    const location = this.locationData || {};

    let properties;

    try {
      properties = this.enrichProperties({ page_type: 'page_exit' }, location);
    } catch (error) {
      console.warn('[exit-tracking] enrich failed:', error);
      properties = {
        page_type: 'page_exit',
        visitorId: this.getVisitorId(),
        sessionId: this.getSessionId(),
      };
    }

    try {
      if (this.config.googleAnalyticsEnabled && window.gtag) {
        const { phone, ...gaProps } = properties;
        window.gtag('event', eventName, {
          ...gaProps,
          event_name: eventName,
          visitor_id: properties.visitorId,
          session_id: properties.sessionId,
          event_category: 'exit',
          event_source: 'unified_tracking',
        });
      }
    } catch {
      /* ignore */
    }

    try {
      if (this.config.clarityEnabled && window.clarity) {
        const { phone, ...safeProperties } = properties;
        window.clarity('set', 'event_name', eventName);
        window.clarity('set', 'visitor_id', properties.visitorId);
        window.clarity('set', 'session_id', properties.sessionId);
        window.clarity('set', 'custom_properties', JSON.stringify(safeProperties));
        window.clarity('event', eventName);
      }
    } catch {
      /* ignore */
    }

    try {
      if (this.config.amplitudeEnabled) {
        const client = this.amplitudeClient || window.amplitude;
        client?.track?.(eventName, properties);
      }
    } catch {
      /* ignore */
    }

    // Beacon the exit event to Telegram via the API route too, so you don't
    // lose "left the site" moments the way a plain fetch might on unload.
    try {
      if (this.config.telegramEnabled && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ eventName, ...properties })], {
          type: 'application/json',
        });
        navigator.sendBeacon('/api/events', blob);
      }
    } catch (e) {
      console.warn('[exit-tracking] beacon failed:', e);
    }
  }

  resetExitFlag() {
    this._exitFired = false;
  }
}

export const trackingService = new TrackingService();

// Expose in the browser console for live debugging, same as before.
if (typeof window !== 'undefined') {
  window.trackingService = trackingService;
}
