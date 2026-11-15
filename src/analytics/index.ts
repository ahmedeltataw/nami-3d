/**
 * Analytics Adapter: disabled-by-default facade for event tracking and page views.
 * Requires process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' and a registered provider.
 * Enforces consent via setConsent(boolean); suppresses all dispatching when false.
 * Exports singleton analytics, track/page helpers, and event taxonomy constants.
 * Guarantees zero third-party SDKs and zero network activity while hosting is deferred.
 */

export type AnalyticsEvent = {
  name: string;
  props?: Record<string, string | number | boolean>;
};

export interface AnalyticsAdapter {
  enabled: boolean;
  track(e: AnalyticsEvent): void;
  page(path: string): void;
}

export interface AdapterConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

export type ProviderFactory = (config?: AdapterConfig) => AnalyticsAdapter;
export type ProviderInput = ProviderFactory | AnalyticsAdapter;

export const noopAdapter: AnalyticsAdapter = {
  enabled: false,
  track: () => {},
  page: () => {},
};

let registeredProviderFn: ProviderFactory | null = null;
let consentGranted = false;
let cachedAdapter: AnalyticsAdapter | null = null;

export function registerProvider(fn: ProviderInput | null): void {
  if (!fn) {
    registeredProviderFn = null;
  } else if (typeof fn === 'function') {
    registeredProviderFn = fn;
  } else {
    registeredProviderFn = () => fn;
  }
  cachedAdapter = null;
}

export function setConsent(consent: boolean): void {
  consentGranted = consent;
}

export function getConsent(): boolean {
  return consentGranted;
}

export function resetAnalytics(): void {
  registeredProviderFn = null;
  consentGranted = false;
  cachedAdapter = null;
}

export function createAdapter(config?: AdapterConfig): AnalyticsAdapter {
  const isEnvEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
  if (!isEnvEnabled || !registeredProviderFn || config?.enabled === false) {
    return noopAdapter;
  }

  const providerInstance = registeredProviderFn(config);
  return {
    get enabled(): boolean {
      return providerInstance.enabled;
    },
    track(e: AnalyticsEvent): void {
      if (!consentGranted || !providerInstance.enabled) {
        return;
      }
      providerInstance.track(e);
    },
    page(path: string): void {
      if (!consentGranted || !providerInstance.enabled) {
        return;
      }
      providerInstance.page(path);
    },
  };
}

function getActiveAdapter(): AnalyticsAdapter {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'true' || !registeredProviderFn) {
    return noopAdapter;
  }
  if (!cachedAdapter) {
    cachedAdapter = createAdapter();
  }
  return cachedAdapter;
}

export const analytics: AnalyticsAdapter = {
  get enabled(): boolean {
    return getActiveAdapter().enabled;
  },
  track(e: AnalyticsEvent): void {
    getActiveAdapter().track(e);
  },
  page(path: string): void {
    getActiveAdapter().page(path);
  },
};

export function track(e: AnalyticsEvent): void {
  analytics.track(e);
}

export function page(path: string): void {
  analytics.page(path);
}

export * from './events';
