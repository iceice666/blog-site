export {};

interface ViewsResponse {
  enabled?: boolean;
  views?: Record<string, number>;
}

declare global {
  interface Window {
    __blogViewCountsReady?: boolean;
  }
}

if (!window.__blogViewCountsReady) {
  window.__blogViewCountsReady = true;
  void initViewCounts();
}

async function initViewCounts() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-view-count]'));
  const targets = nodes.filter((node) => !node.dataset.viewCountReady);
  if (targets.length === 0) return;

  targets.forEach((node) => {
    node.dataset.viewCountReady = 'true';
  });

  const paths = unique(
    targets
      .map((node) => node.dataset.viewPath ?? '')
      .filter((path) => path.length > 0),
  );
  if (paths.length === 0) {
    hide(targets);
    return;
  }

  const params = new URLSearchParams();
  paths.forEach((path) => params.append('path', path));

  try {
    const res = await fetch(`/api/analytics/views?${params.toString()}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Could not load view counts.');
    const payload = (await res.json()) as ViewsResponse;
    if (!payload.enabled || !payload.views) {
      hide(targets);
      return;
    }

    targets.forEach((node) => {
      const path = node.dataset.viewPath ?? '';
      const value = payload.views?.[path];
      if (typeof value !== 'number') {
        node.hidden = true;
        return;
      }
      const prefix = node.dataset.viewPrefix ?? '';
      node.textContent = `${prefix}${formatViews(value)}`;
    });
  } catch {
    hide(targets);
  }
}

function formatViews(value: number) {
  const count = new Intl.NumberFormat('en-US').format(value);
  return value === 1 ? `${count} view` : `${count} views`;
}

function hide(nodes: HTMLElement[]) {
  nodes.forEach((node) => {
    node.hidden = true;
  });
}

function unique(values: string[]) {
  return [...new Set(values)];
}
