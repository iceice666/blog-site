export {};

interface AnalyticsConfigResponse {
  enabled?: boolean;
  umami?: {
    hostUrl?: string;
    websiteId?: string;
    domains?: string;
  };
}

declare global {
  interface Window {
    __blogUmamiReady?: boolean;
  }
}

if (!window.__blogUmamiReady) {
  window.__blogUmamiReady = true;
  void loadUmami();
}

async function loadUmami() {
  try {
    const res = await fetch('/api/analytics/config', {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return;

    const payload = (await res.json()) as AnalyticsConfigResponse;
    const config = payload.umami;
    if (!payload.enabled || !config?.hostUrl || !config.websiteId) return;

    const hostUrl = config.hostUrl.replace(/\/+$/, '');
    const src = `${hostUrl}/script.js`;
    const absoluteSrc = new URL(src, location.href).href;
    const alreadyLoaded = Array.from(document.scripts).some(
      (script) =>
        script.src === absoluteSrc &&
        script.dataset.websiteId === config.websiteId,
    );
    if (alreadyLoaded) return;

    const script = document.createElement('script');
    script.defer = true;
    script.src = src;
    script.dataset.websiteId = config.websiteId;
    if (config.domains) script.dataset.domains = config.domains;
    document.head.appendChild(script);
  } catch {
    // Analytics should never block the page.
  }
}
