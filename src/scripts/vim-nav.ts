type VimMode = 'normal' | 'hint' | 'search' | 'command';

type HintCandidate = {
  el: HTMLElement;
  label: string;
};

const HINT_CHARS = 'asdfghjklqwertyuiopzxcvbnm';
const SCROLL_LINE = 80;
const STATUS_IDLE = '-- NORMAL --';
const STATUS_DISABLED = '-- VIM OFF --';
const VIM_STORAGE_KEY = 'blog:vim-enabled';
const NAV_BY_KEY: Record<string, string> = {
  '1': '/',
  '2': '/about',
  '3': '/friends',
  '4': '/archive',
};
const COMMAND_ROUTES: Record<string, string> = {
  feed: '/',
  about: '/about',
  friends: '/friends',
  archive: '/archive',
};

function initVimNav() {
  const statusEl = document.getElementById('vim-status');
  const vimToggle = document.getElementById('vim-toggle');
  const archiveInput = document.getElementById('archive-filter');

  let mode: VimMode = 'normal';
  let vimEnabled = getInitialVimPreference();
  let selectedTarget: HTMLElement | null = null;
  let searchBuffer = '';
  let commandBuffer = '';
  let lastSearch = '';
  let hints: HintCandidate[] = [];
  let hintBuffer = '';
  let hintNewTab = false;
  let pendingKey = '';
  let pendingTimer: ReturnType<typeof window.setTimeout> | undefined;
  let statusTimer: ReturnType<typeof window.setTimeout> | undefined;

  function getInitialVimPreference() {
    try {
      return window.localStorage.getItem(VIM_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  function saveVimPreference() {
    try {
      window.localStorage.setItem(VIM_STORAGE_KEY, String(vimEnabled));
    } catch {
      // Local storage can be unavailable in private or embedded contexts.
    }
  }

  function setStatus(text: string, temporary = false) {
    if (!statusEl) return;
    window.clearTimeout(statusTimer);
    statusEl.textContent = text;
    if (temporary) {
      statusTimer = window.setTimeout(() => {
        if (mode === 'normal') statusEl.textContent = STATUS_IDLE;
      }, 1400);
    }
  }

  function syncVimToggle() {
    if (!vimToggle) return;
    vimToggle.textContent = vimEnabled ? 'VIM ON' : 'VIM OFF';
    vimToggle.setAttribute('aria-pressed', String(vimEnabled));
    vimToggle.classList.toggle('is-off', !vimEnabled);
  }

  function resetPendingKey() {
    pendingKey = '';
    window.clearTimeout(pendingTimer);
  }

  function getScroller() {
    const scrollArea = document.querySelector<HTMLElement>('.scroll-area');
    if (scrollArea && scrollArea.scrollHeight > scrollArea.clientHeight + 1) return scrollArea;
    return document.scrollingElement ?? document.documentElement;
  }

  function scrollByAmount(amount: number) {
    const scroller = getScroller();
    if (scroller === document.documentElement || scroller === document.body) {
      window.scrollBy({ top: amount, behavior: 'smooth' });
    } else {
      scroller.scrollBy({ top: amount, behavior: 'smooth' });
    }
  }

  function scrollToEdge(edge: 'top' | 'bottom') {
    const scroller = getScroller();
    const top = edge === 'top' ? 0 : scroller.scrollHeight;
    if (scroller === document.documentElement || scroller === document.body) {
      window.scrollTo({ top, behavior: 'smooth' });
    } else {
      scroller.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function isNativeControlTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        'a[href], button, input, textarea, select, summary, [role="button"], [contenteditable]:not([contenteditable="false"])',
      ),
    );
  }

  function isRendered(el: HTMLElement) {
    if (el.closest('[hidden], .is-hidden')) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isVisible(el: HTMLElement) {
    if (!isRendered(el)) return false;
    const rect = el.getBoundingClientRect();
    return rect.bottom >= 0 && rect.top <= window.innerHeight;
  }

  function getTargets() {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-vim-target]')).filter(isRendered);
  }

  function clearSelection() {
    selectedTarget?.classList.remove('vim-selected');
    selectedTarget = null;
  }

  function selectTarget(el: HTMLElement) {
    selectedTarget?.classList.remove('vim-selected');
    selectedTarget = el;
    selectedTarget.classList.add('vim-selected');
    selectedTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  function selectedIndex(targets = getTargets()) {
    if (!selectedTarget) return -1;
    const index = targets.indexOf(selectedTarget);
    if (index === -1) clearSelection();
    return index;
  }

  function moveSelection(direction: 1 | -1) {
    const targets = getTargets();
    if (targets.length === 0) {
      scrollByAmount(direction * SCROLL_LINE);
      return;
    }

    const current = selectedIndex(targets);
    const next =
      current === -1
        ? direction > 0
          ? 0
          : targets.length - 1
        : Math.max(0, Math.min(targets.length - 1, current + direction));
    selectTarget(targets[next]);
    setStatus(`target ${next + 1}/${targets.length}`, true);
  }

  function getOpenHref(el: HTMLElement) {
    const explicitHref = el.getAttribute('data-vim-open');
    if (explicitHref) return explicitHref;
    if (el instanceof HTMLAnchorElement && el.href) return el.href;
    const anchor = el.querySelector<HTMLAnchorElement>('a[href]');
    return anchor?.href ?? null;
  }

  function openElement(el: HTMLElement, newTab = false) {
    const href = getOpenHref(el);
    if (href) {
      if (newTab) {
        window.open(href, '_blank', 'noopener,noreferrer');
      } else {
        window.location.assign(href);
      }
      return;
    }

    if (
      el instanceof HTMLButtonElement ||
      el instanceof HTMLDetailsElement ||
      el.tagName.toLowerCase() === 'summary' ||
      el.getAttribute('role') === 'button'
    ) {
      el.click();
      return;
    }

    setStatus('no open target', true);
  }

  function openSelected() {
    if (!selectedTarget) {
      const firstTarget = getTargets()[0];
      if (firstTarget) selectTarget(firstTarget);
    }
    if (selectedTarget) openElement(selectedTarget);
  }

  function labelFor(index: number, length: number) {
    const base = HINT_CHARS.length;
    let label = '';
    let value = index;
    for (let i = 0; i < length; i++) {
      label = HINT_CHARS[value % base] + label;
      value = Math.floor(value / base);
    }
    return label.padStart(length, HINT_CHARS[0]);
  }

  function hintSelector() {
    return 'a[href], button:not([disabled]), summary, [role="button"], [data-vim-open]';
  }

  function getHintCandidates() {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(hintSelector())).filter(isVisible);
    const labelLength = Math.max(1, Math.ceil(Math.log(Math.max(elements.length, 1)) / Math.log(HINT_CHARS.length)));
    return elements.map((el, index) => ({ el, label: labelFor(index, labelLength) }));
  }

  function clearHints() {
    document.querySelectorAll('.vim-hint').forEach((el) => el.remove());
    hints = [];
    hintBuffer = '';
  }

  function setVimEnabled(nextEnabled: boolean) {
    vimEnabled = nextEnabled;
    mode = 'normal';
    resetPendingKey();
    clearHints();
    if (!vimEnabled) clearSelection();
    syncVimToggle();
    saveVimPreference();
    setStatus(vimEnabled ? STATUS_IDLE : STATUS_DISABLED);
  }

  function renderHints() {
    clearHints();
    hints = getHintCandidates();
    const fragment = document.createDocumentFragment();
    hints.forEach((hint) => {
      const rect = hint.el.getBoundingClientRect();
      const marker = document.createElement('span');
      marker.className = 'vim-hint';
      marker.textContent = hint.label;
      marker.style.left = `${Math.max(4, rect.left)}px`;
      marker.style.top = `${Math.max(4, rect.top)}px`;
      fragment.append(marker);
    });
    document.body.appendChild(fragment);
  }

  function enterHintMode(newTab: boolean) {
    mode = 'hint';
    hintNewTab = newTab;
    renderHints();
    setStatus(`${newTab ? 'HINT-TAB' : 'HINT'} ${hints.length} links`);
    if (hints.length === 0) {
      mode = 'normal';
      clearHints();
      setStatus('no visible links', true);
    }
  }

  function updateHintMode(key: string) {
    if (key === 'Escape') {
      mode = 'normal';
      clearHints();
      setStatus(STATUS_IDLE);
      return;
    }

    if (key === 'Backspace') {
      hintBuffer = hintBuffer.slice(0, -1);
    } else if (key.length === 1 && HINT_CHARS.includes(key.toLowerCase())) {
      hintBuffer += key.toLowerCase();
    } else {
      return;
    }

    const matches = hints.filter((hint) => hint.label.startsWith(hintBuffer));
    document.querySelectorAll<HTMLElement>('.vim-hint').forEach((marker, index) => {
      const hint = hints[index];
      marker.classList.toggle('is-dim', !hint.label.startsWith(hintBuffer));
      marker.classList.toggle('is-match', hint.label === hintBuffer);
    });

    if (matches.length === 1 && matches[0].label === hintBuffer) {
      const { el } = matches[0];
      const openInNewTab = hintNewTab;
      mode = 'normal';
      clearHints();
      openElement(el, openInNewTab);
    } else {
      setStatus(`hint ${hintBuffer || ' '}`);
    }
  }

  function applyArchiveFilter(query: string) {
    if (!(archiveInput instanceof HTMLInputElement)) return false;
    archiveInput.value = query;
    archiveInput.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function repeatSearch(backwards = false) {
    if (!lastSearch) {
      setStatus('no previous search', true);
      return;
    }

    if (archiveInput instanceof HTMLInputElement) {
      const targets = getTargets();
      if (targets.length === 0) {
        setStatus('no matches', true);
        return;
      }
      const current = selectedIndex(targets);
      const next = current === -1 ? 0 : (current + (backwards ? -1 : 1) + targets.length) % targets.length;
      selectTarget(targets[next]);
      setStatus(`match ${next + 1}/${targets.length}`, true);
      return;
    }

    const finder = window as Window & { find?: (...args: unknown[]) => boolean };
    const found = finder.find?.(lastSearch, false, backwards, true);
    setStatus(found ? `${backwards ? '?' : '/'}${lastSearch}` : 'not found', true);
  }

  function enterSearchMode() {
    mode = 'search';
    searchBuffer = '';
    setStatus('/');
  }

  function finishSearch() {
    lastSearch = searchBuffer;
    mode = 'normal';
    if (!searchBuffer) {
      setStatus(STATUS_IDLE);
      return;
    }

    if (applyArchiveFilter(searchBuffer)) {
      const firstTarget = getTargets()[0];
      if (firstTarget) selectTarget(firstTarget);
      setStatus(`/${searchBuffer}`, true);
      return;
    }

    const finder = window as Window & { find?: (...args: unknown[]) => boolean };
    const found = finder.find?.(searchBuffer, false, false, true);
    setStatus(found ? `/${searchBuffer}` : 'not found', true);
  }

  function updateSearchMode(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      mode = 'normal';
      setStatus(STATUS_IDLE);
      return;
    }
    if (event.key === 'Enter') {
      finishSearch();
      return;
    }
    if (event.key === 'Backspace') {
      searchBuffer = searchBuffer.slice(0, -1);
    } else if (event.key.length === 1) {
      searchBuffer += event.key;
    } else {
      return;
    }

    if (archiveInput instanceof HTMLInputElement) applyArchiveFilter(searchBuffer);
    setStatus(`/${searchBuffer}`);
  }

  function enterCommandMode() {
    mode = 'command';
    commandBuffer = '';
    setStatus(':');
  }

  function executeCommand(command: string) {
    const normalized = command.trim().toLowerCase();
    mode = 'normal';

    if (normalized === 'q') {
      if (history.length > 1) history.back();
      else window.location.assign('/');
      return;
    }

    if (normalized === 'noh') {
      clearSelection();
      setStatus('cleared', true);
      return;
    }

    const route = COMMAND_ROUTES[normalized];
    if (route) {
      window.location.assign(route);
      return;
    }

    setStatus(`not an editor command: ${command}`, true);
  }

  function updateCommandMode(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      mode = 'normal';
      setStatus(STATUS_IDLE);
      return;
    }
    if (event.key === 'Enter') {
      executeCommand(commandBuffer);
      return;
    }
    if (event.key === 'Backspace') {
      commandBuffer = commandBuffer.slice(0, -1);
    } else if (event.key.length === 1) {
      commandBuffer += event.key;
    } else {
      return;
    }
    setStatus(`:${commandBuffer}`);
  }

  function handleNormalMode(event: KeyboardEvent) {
    const scroller = getScroller();
    const halfPage = Math.max(160, scroller.clientHeight * 0.5);

    if (pendingKey && event.key !== 'g') resetPendingKey();

    switch (event.key) {
      case 'Escape':
        clearSelection();
        setStatus(STATUS_IDLE);
        break;
      case 'j':
        moveSelection(1);
        break;
      case 'k':
        moveSelection(-1);
        break;
      case 'd':
        scrollByAmount(halfPage);
        break;
      case 'u':
        scrollByAmount(-halfPage);
        break;
      case 'g':
        if (pendingKey === 'g') {
          resetPendingKey();
          scrollToEdge('top');
          setStatus('top', true);
        } else {
          pendingKey = 'g';
          pendingTimer = window.setTimeout(resetPendingKey, 900);
          setStatus('g');
        }
        break;
      case 'G':
        scrollToEdge('bottom');
        setStatus('bottom', true);
        break;
      case 'h':
        history.back();
        break;
      case 'l':
        history.forward();
        break;
      case 'o':
      case 'Enter':
        openSelected();
        break;
      case 'f':
        enterHintMode(false);
        break;
      case 'F':
        enterHintMode(true);
        break;
      case '/':
        enterSearchMode();
        break;
      case 'n':
        repeatSearch(false);
        break;
      case 'N':
        repeatSearch(true);
        break;
      case ':':
        enterCommandMode();
        break;
      default: {
        const route = NAV_BY_KEY[event.key];
        if (!route) return;
        window.location.assign(route);
      }
    }

    event.preventDefault();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (!vimEnabled) return;
    if (mode === 'normal' && isNativeControlTarget(event.target)) return;

    if (mode === 'hint') {
      event.preventDefault();
      updateHintMode(event.key);
      return;
    }
    if (mode === 'search') {
      event.preventDefault();
      updateSearchMode(event);
      return;
    }
    if (mode === 'command') {
      event.preventDefault();
      updateCommandMode(event);
      return;
    }

    handleNormalMode(event);
  }

  archiveInput?.addEventListener('input', () => {
    if (selectedTarget && !isRendered(selectedTarget)) clearSelection();
  });
  window.addEventListener('resize', () => {
    if (vimEnabled && mode === 'hint') renderHints();
  });
  vimToggle?.addEventListener('click', () => setVimEnabled(!vimEnabled));
  document.addEventListener('keydown', handleKeydown);
  syncVimToggle();
  setStatus(vimEnabled ? STATUS_IDLE : STATUS_DISABLED);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVimNav, { once: true });
} else {
  initVimNav();
}
