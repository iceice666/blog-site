type VimMode = 'normal' | 'hint' | 'search' | 'command';

type HintCandidate = {
  el: HTMLElement;
  label: string;
};

const HINT_CHARS = 'asdfghjklqwertyuiopzxcvbnm';
const SCROLL_LINE = 80;
const CONTENT_SEARCH_HIGHLIGHT = 'vim-search';
const CONTENT_SEARCH_CURRENT_HIGHLIGHT = 'vim-search-current';
const STATUS_IDLE = '-- NORMAL --';
const STATUS_DISABLED = '-- VIM OFF --';
const STATUS_UNAVAILABLE = '-- VIM N/A --';
const VIM_STORAGE_KEY = 'blog:vim-enabled';
const SIDEBAR_STORAGE_KEY = 'blog:sidebar-visible';
const EDITABLE_CONTROL_SELECTOR =
  'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled), [contenteditable]:not([contenteditable="false"])';
const EDIT_COMMANDS = new Set(['e', 'ed', 'edi', 'edit']);
const HELP_COMMANDS = new Set(['?', 'help']);
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
const HELP_SECTIONS = [
  {
    title: 'motion',
    items: [
      ['j / k', 'move target'],
      ['d / u', 'half page down / up'],
      ['gg / G', 'top / bottom'],
      ['h / l', 'browser back / forward'],
      ['f / F', 'hint target / new tab'],
      ['o / Enter', 'open target'],
      ['1-4', 'switch window'],
    ],
  },
  {
    title: 'search',
    items: [
      ['/text', 'search page or archive'],
      ['n / N', 'next / previous match'],
      [':noh', 'clear target selection'],
    ],
  },
  {
    title: 'commands',
    items: [
      [':e[dit]', 'open admin editor'],
      [':? / :help', 'show this help'],
      [':login', 'start GitHub OAuth'],
      [':logout', 'clear GitHub OAuth session'],
      [':sidebar', 'toggle sidebar pane'],
      [':q', 'back or feed'],
    ],
  },
] as const;

function initVimNav() {
  const statusEl = document.getElementById('vim-status');
  const announceEl = document.getElementById('vim-status-announce');
  const vimToggle = document.getElementById('vim-toggle');
  const archiveInput = document.getElementById('archive-filter');

  let mode: VimMode = 'normal';
  let deviceCanUseVim = canUseVimOnCurrentDevice();
  let vimEnabled = deviceCanUseVim && getInitialVimPreference();
  let selectedTarget: HTMLElement | null = null;
  let searchBuffer = '';
  let commandBuffer = '';
  let lastSearch = '';
  let searchRanges: Range[] = [];
  let searchMatchIndex = -1;
  let archiveFilterSnapshot: string | null = null;
  let hints: HintCandidate[] = [];
  let hintBuffer = '';
  let hintNewTab = false;
  let pendingKey = '';
  let pendingTimer: number | undefined;
  let statusTimer: number | undefined;
  let announceTimer: number | undefined;
  let editorStatus: string | null = null;
  let helpEl: HTMLElement | null = null;

  function getInitialVimPreference() {
    try {
      return window.localStorage.getItem(VIM_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  function isMobileOrTabletUserAgent() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    const isIpadOsDesktopUa = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) || isIpadOsDesktopUa;
  }

  function mediaMatches(query: string) {
    const media = window.matchMedia?.(query);
    return media?.matches ?? false;
  }

  function canUseVimOnCurrentDevice() {
    const touchPrimaryPointer = mediaMatches('(pointer: coarse)');
    const noHoverPointer = mediaMatches('(hover: none)');
    const touchOnlyPointers = mediaMatches('(any-pointer: coarse)') && !mediaMatches('(any-hover: hover)');
    return !(isMobileOrTabletUserAgent() || touchPrimaryPointer || noHoverPointer || touchOnlyPointers);
  }

  function saveVimPreference() {
    try {
      window.localStorage.setItem(VIM_STORAGE_KEY, String(vimEnabled));
    } catch {
      // Local storage can be unavailable in private or embedded contexts.
    }
  }

  function saveSidebarPreference(hidden: boolean) {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!hidden));
    } catch {
      // Local storage can be unavailable in private or embedded contexts.
    }
  }

  /** Mirror statuses into the screen-reader live region, debounced so rapid
   * keystroke echoes (search/command buffers) collapse into one announcement. */
  function announce(text: string) {
    if (!announceEl) return;
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      announceEl.textContent = text === STATUS_IDLE ? '' : text;
    }, 500);
  }

  function setStatus(text: string, temporary = false) {
    if (!statusEl) return;
    window.clearTimeout(statusTimer);
    statusEl.textContent = text;
    announce(text);
    if (temporary) {
      statusTimer = window.setTimeout(() => {
        if (mode === 'normal') statusEl.textContent = currentIdleStatus();
      }, 1400);
    }
  }

  function currentIdleStatus() {
    if (!deviceCanUseVim) return STATUS_UNAVAILABLE;
    if (!vimEnabled) return STATUS_DISABLED;
    return editorStatus ?? STATUS_IDLE;
  }

  function syncVimToggle() {
    document.documentElement.dataset.vimAvailable = String(deviceCanUseVim);
    if (!vimToggle) return;
    vimToggle.textContent = deviceCanUseVim ? (vimEnabled ? 'VIM ON' : 'VIM OFF') : 'VIM N/A';
    vimToggle.setAttribute('aria-pressed', String(vimEnabled));
    vimToggle.setAttribute('aria-disabled', String(!deviceCanUseVim));
    vimToggle.classList.toggle('is-off', !vimEnabled);
    vimToggle.toggleAttribute('disabled', !deviceCanUseVim);
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

  /** The part of the element inside the viewport AND every clipping ancestor
   * (e.g. .scroll-area), or null when fully clipped — a window-only check
   * would leave hints floating over the status bars for elements scrolled
   * out of a pane. */
  function clippedRect(el: HTMLElement): { top: number; left: number } | null {
    const rect = el.getBoundingClientRect();
    let top = Math.max(rect.top, 0);
    let left = Math.max(rect.left, 0);
    let bottom = Math.min(rect.bottom, window.innerHeight);
    let right = Math.min(rect.right, window.innerWidth);
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = window.getComputedStyle(parent);
      if (!/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) continue;
      const parentRect = parent.getBoundingClientRect();
      top = Math.max(top, parentRect.top);
      left = Math.max(left, parentRect.left);
      bottom = Math.min(bottom, parentRect.bottom);
      right = Math.min(right, parentRect.right);
    }
    return bottom > top && right > left ? { top, left } : null;
  }

  function isVisible(el: HTMLElement) {
    return isRendered(el) && clippedRect(el) !== null;
  }

  function getTargets() {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-vim-target]')).filter(isRendered);
  }

  function clearSelection() {
    selectedTarget?.classList.remove('vim-selected');
    selectedTarget = null;
  }

  function getSidebar() {
    return document.querySelector<HTMLElement>('.sidebar');
  }

  function isSidebarHidden() {
    return document.documentElement.dataset.sidebar === 'hidden';
  }

  function applySidebarHidden(hidden: boolean) {
    const sidebar = getSidebar();
    if (hidden) document.documentElement.dataset.sidebar = 'hidden';
    else delete document.documentElement.dataset.sidebar;
    if (sidebar) {
      if (hidden) sidebar.setAttribute('aria-hidden', 'true');
      else sidebar.removeAttribute('aria-hidden');
    }
    if (hidden && selectedTarget && sidebar?.contains(selectedTarget)) clearSelection();
  }

  function setSidebarHidden(hidden: boolean, temporaryStatus = false) {
    applySidebarHidden(hidden);
    saveSidebarPreference(hidden);
    setStatus(`sidebar ${hidden ? 'hidden' : 'shown'}`, temporaryStatus);
  }

  function toggleSidebar() {
    setSidebarHidden(!isSidebarHidden(), true);
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

    if (el.matches(EDITABLE_CONTROL_SELECTOR)) {
      el.focus({ preventScroll: true });
      syncEditorStatus(el);
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
    return `a[href], button:not([disabled]), summary, [role="button"], [data-vim-open], ${EDITABLE_CONTROL_SELECTOR}`;
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
    vimEnabled = deviceCanUseVim && nextEnabled;
    mode = 'normal';
    resetPendingKey();
    clearHints();
    if (!vimEnabled) {
      clearSelection();
      clearContentSearch();
    }
    syncVimToggle();
    saveVimPreference();
    setStatus(currentIdleStatus());
  }

  function refreshVimDeviceAvailability() {
    const nextDeviceCanUseVim = canUseVimOnCurrentDevice();
    if (nextDeviceCanUseVim === deviceCanUseVim) return;

    deviceCanUseVim = nextDeviceCanUseVim;
    vimEnabled = deviceCanUseVim && getInitialVimPreference();
    mode = 'normal';
    resetPendingKey();
    clearHints();
    if (!vimEnabled) {
      clearSelection();
      clearContentSearch();
    }
    syncVimToggle();
    setStatus(currentIdleStatus());
  }

  function watchDeviceCapability(query: string) {
    const media = window.matchMedia?.(query);
    if (!media) return;
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', refreshVimDeviceAvailability);
    } else {
      const addLegacyListener = (media as unknown as { addListener?: (listener: () => void) => void }).addListener;
      addLegacyListener?.call(media, refreshVimDeviceAvailability);
    }
  }

  function renderHints() {
    clearHints();
    hints = getHintCandidates();
    const fragment = document.createDocumentFragment();
    hints.forEach((hint) => {
      const rect = hint.el.getBoundingClientRect();
      // Candidates are pre-filtered by isVisible, so the fallback only guards
      // against layout changes between collection and render.
      const pos = clippedRect(hint.el) ?? { top: Math.max(4, rect.top), left: Math.max(4, rect.left) };
      const marker = document.createElement('span');
      marker.className = 'vim-hint';
      marker.textContent = hint.label;
      marker.style.left = `${pos.left}px`;
      marker.style.top = `${pos.top}px`;
      fragment.append(marker);
    });
    document.body.appendChild(fragment);
  }

  function enterHintMode(newTab: boolean) {
    mode = 'hint';
    hintNewTab = newTab;
    renderHints();
    setStatus(`${newTab ? 'HINT-TAB' : 'HINT'} ${hints.length} targets`);
    if (hints.length === 0) {
      mode = 'normal';
      clearHints();
      setStatus('no visible targets', true);
    }
  }

  function updateHintMode(key: string) {
    if (key === 'Escape') {
      mode = 'normal';
      clearHints();
      setStatus(currentIdleStatus());
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

  function supportsContentHighlight() {
    return typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined' && typeof Highlight !== 'undefined';
  }

  function getSearchRoot() {
    return document.getElementById('main-content') ?? document.body;
  }

  function isInsideCollapsedDetails(el: Element) {
    for (let node: Element | null = el; node; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) return !node.open;
      if (node.tagName === 'SUMMARY') return false;
    }
    return false;
  }

  /** Flattens visible text under `root` into one string, remembering which
   * text node backs each character so match offsets can be mapped back to
   * Ranges — a Range can span multiple text nodes (e.g. a query crossing a
   * <strong> boundary), which DOM-mutation highlighting (wrapping matches in
   * <mark>) cannot represent. */
  function collectSearchableText(root: HTMLElement) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, noscript, .vim-hint, .vim-command-help')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (isInsideCollapsedDetails(parent)) return NodeFilter.FILTER_REJECT;
        return node.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    const nodes: Text[] = [];
    const starts: number[] = [];
    let text = '';
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      starts.push(text.length);
      text += node.textContent ?? '';
      nodes.push(node);
    }
    return { nodes, starts, text };
  }

  function resolveTextOffset(nodes: Text[], starts: number[], globalIndex: number, fromNodeIndex: number) {
    let i = fromNodeIndex;
    while (i < nodes.length - 1 && globalIndex >= starts[i] + (nodes[i].textContent?.length ?? 0)) i++;
    return { nodeIndex: i, offset: globalIndex - starts[i] };
  }

  function clearContentSearch() {
    searchRanges = [];
    searchMatchIndex = -1;
    if (!supportsContentHighlight()) return;
    CSS.highlights.delete(CONTENT_SEARCH_HIGHLIGHT);
    CSS.highlights.delete(CONTENT_SEARCH_CURRENT_HIGHLIGHT);
  }

  function runContentSearch(query: string) {
    clearContentSearch();
    if (!query || !supportsContentHighlight()) return 0;

    const { nodes, starts, text } = collectSearchableText(getSearchRoot());
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();

    const ranges: Range[] = [];
    let cursor = 0;
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      const start = resolveTextOffset(nodes, starts, at, cursor);
      const end = resolveTextOffset(nodes, starts, at + needle.length - 1, start.nodeIndex);
      cursor = start.nodeIndex;
      const range = new Range();
      range.setStart(nodes[start.nodeIndex], start.offset);
      range.setEnd(nodes[end.nodeIndex], end.offset + 1);
      ranges.push(range);
      at = haystack.indexOf(needle, at + 1);
    }

    searchRanges = ranges;
    if (ranges.length > 0) {
      const highlight = new Highlight(...ranges);
      highlight.priority = 1;
      CSS.highlights.set(CONTENT_SEARCH_HIGHLIGHT, highlight);
    }
    return ranges.length;
  }

  function scrollRangeIntoView(range: Range) {
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const scroller = getScroller();
    const isWindowScroller = scroller === document.documentElement || scroller === document.body;
    const viewportTop = isWindowScroller ? 0 : scroller.getBoundingClientRect().top;
    const viewportHeight = isWindowScroller ? window.innerHeight : scroller.clientHeight;
    const delta = rect.top + rect.height / 2 - (viewportTop + viewportHeight / 2);
    if (Math.abs(delta) < 4) return;
    if (isWindowScroller) window.scrollBy({ top: delta, behavior: 'smooth' });
    else scroller.scrollBy({ top: delta, behavior: 'smooth' });
  }

  function setCurrentContentMatch(index: number) {
    const range = searchRanges[index];
    if (!range) return;
    searchMatchIndex = index;
    // Ctrl+F-style reveal: expand any collapsed <details> hiding the match so
    // cycling with n/N never lands on invisible text.
    for (let node = range.startContainer.parentElement; node; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement && !node.open) node.open = true;
    }
    if (supportsContentHighlight()) {
      const highlight = new Highlight(range);
      highlight.priority = 2;
      CSS.highlights.set(CONTENT_SEARCH_CURRENT_HIGHLIGHT, highlight);
    }
    scrollRangeIntoView(range);
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
      const wrapped = current === -1 ? false : backwards ? current === 0 : current === targets.length - 1;
      const next =
        current === -1
          ? backwards
            ? targets.length - 1
            : 0
          : (current + (backwards ? -1 : 1) + targets.length) % targets.length;
      selectTarget(targets[next]);
      setStatus(`match ${next + 1}/${targets.length}${wrapped ? ' (wrapped)' : ''}`, true);
      return;
    }

    if (searchRanges.length === 0) {
      setStatus('not found', true);
      return;
    }

    const wrapped =
      searchMatchIndex === -1
        ? false
        : backwards
          ? searchMatchIndex === 0
          : searchMatchIndex === searchRanges.length - 1;
    const next =
      searchMatchIndex === -1
        ? backwards
          ? searchRanges.length - 1
          : 0
        : (searchMatchIndex + (backwards ? -1 : 1) + searchRanges.length) % searchRanges.length;
    setCurrentContentMatch(next);
    setStatus(`match ${next + 1}/${searchRanges.length}${wrapped ? ' (wrapped)' : ''}`, true);
  }

  function enterSearchMode() {
    mode = 'search';
    searchBuffer = '';
    archiveFilterSnapshot = archiveInput instanceof HTMLInputElement ? archiveInput.value : null;
    setStatus('/');
  }

  function finishSearch() {
    lastSearch = searchBuffer;
    mode = 'normal';
    archiveFilterSnapshot = null;
    if (!searchBuffer) {
      clearContentSearch();
      setStatus(currentIdleStatus());
      return;
    }

    if (applyArchiveFilter(searchBuffer)) {
      const targets = getTargets();
      if (targets.length === 0) {
        setStatus('not found', true);
        return;
      }
      selectTarget(targets[0]);
      setStatus(`match 1/${targets.length}`, true);
      return;
    }

    const count = runContentSearch(searchBuffer);
    if (count === 0) {
      setStatus('not found', true);
      return;
    }
    setCurrentContentMatch(0);
    setStatus(`match 1/${count}`, true);
  }

  function updateSearchMode(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      mode = 'normal';
      if (archiveInput instanceof HTMLInputElement && archiveFilterSnapshot !== null) {
        archiveInput.value = archiveFilterSnapshot;
        archiveInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      archiveFilterSnapshot = null;
      setStatus(currentIdleStatus());
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

  function returnToCurrentPage() {
    return `${location.pathname}${location.search}${location.hash}`;
  }

  function openGitHubLogin() {
    const loginUrl = new URL('/api/auth/github/start', location.origin);
    loginUrl.searchParams.set('returnTo', returnToCurrentPage());
    setStatus('opening GitHub login...', true);
    window.location.assign(loginUrl.toString());
  }

  async function logoutGitHub() {
    setStatus('logging out of GitHub...');
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `logout failed with ${response.status}`);
      }
      setStatus('logged out', true);
      window.setTimeout(() => window.location.reload(), 180);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'logout failed', true);
    }
  }

  function closeHelp() {
    helpEl?.remove();
    helpEl = null;
    document.removeEventListener('keydown', closeHelpOnEscape);
    setStatus(currentIdleStatus());
  }

  function closeHelpOnEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeHelp();
  }

  function showHelp() {
    closeHelp();

    const overlay = document.createElement('div');
    overlay.className = 'vim-command-help';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'vim-command-help-title');

    const panel = document.createElement('div');
    panel.className = 'vim-command-help-panel';

    const head = document.createElement('div');
    head.className = 'vim-command-help-head';
    const title = document.createElement('h2');
    title.id = 'vim-command-help-title';
    title.textContent = 'vim help';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'vim-command-help-close';
    close.textContent = 'close';
    close.addEventListener('click', closeHelp);
    head.appendChild(title);
    head.appendChild(close);

    const body = document.createElement('div');
    body.className = 'vim-command-help-body';
    for (const section of HELP_SECTIONS) {
      const group = document.createElement('section');
      const heading = document.createElement('h3');
      heading.textContent = section.title;
      const list = document.createElement('dl');
      for (const [keys, label] of section.items) {
        const term = document.createElement('dt');
        term.textContent = keys;
        const detail = document.createElement('dd');
        detail.textContent = label;
        list.appendChild(term);
        list.appendChild(detail);
      }
      group.appendChild(heading);
      group.appendChild(list);
      body.appendChild(group);
    }

    panel.appendChild(head);
    panel.appendChild(body);
    overlay.appendChild(panel);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeHelp();
    });
    document.body.appendChild(overlay);
    helpEl = overlay;
    document.addEventListener('keydown', closeHelpOnEscape);
    close.focus();
    setStatus('help');
  }

  async function executeCommand(command: string) {
    const normalized = command.trim().toLowerCase();
    mode = 'normal';

    if (normalized === 'q') {
      if (history.length > 1) history.back();
      else window.location.assign('/');
      return;
    }

    if (normalized === 'noh') {
      clearSelection();
      clearContentSearch();
      setStatus('cleared', true);
      return;
    }

    if (EDIT_COMMANDS.has(normalized)) {
      window.location.assign('/admin/edit');
      return;
    }

    if (HELP_COMMANDS.has(normalized)) {
      showHelp();
      return;
    }

    if (normalized === 'login') {
      openGitHubLogin();
      return;
    }

    if (normalized === 'logout') {
      await logoutGitHub();
      return;
    }

    if (normalized === 'sidebar') {
      toggleSidebar();
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
      setStatus(currentIdleStatus());
      return;
    }
    if (event.key === 'Enter') {
      void executeCommand(commandBuffer);
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
        clearContentSearch();
        setStatus(currentIdleStatus());
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

  function editorStatusForTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return null;
    if (!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return null;

    if (target.closest('.comment-form')) return '-- INSERT COMMENT --';

    const editor = target.closest<HTMLElement>('[data-admin-editor]');
    if (!editor) return null;

    const path = editor.querySelector<HTMLElement>('.admin-path')?.textContent ?? '';
    if (path.includes('/posts/')) return '-- INSERT POST --';
    if (path.includes('/articles/')) return '-- INSERT ARTICLE --';
    return '-- INSERT EDITOR --';
  }

  function syncEditorStatus(target: EventTarget | null) {
    editorStatus = editorStatusForTarget(target);
    if (mode === 'normal') setStatus(currentIdleStatus());
  }

  archiveInput?.addEventListener('input', () => {
    if (selectedTarget && !isRendered(selectedTarget)) clearSelection();
  });
  window.addEventListener('resize', () => {
    refreshVimDeviceAvailability();
    if (vimEnabled && mode === 'hint') renderHints();
  });
  // Hint markers are position: fixed, so scrolling any pane leaves them stale.
  document.addEventListener(
    'scroll',
    () => {
      if (vimEnabled && mode === 'hint') renderHints();
    },
    { capture: true, passive: true },
  );
  ['(pointer: coarse)', '(hover: none)', '(any-pointer: coarse)', '(any-hover: hover)'].forEach(watchDeviceCapability);
  applySidebarHidden(isSidebarHidden());
  vimToggle?.addEventListener('click', () => setVimEnabled(!vimEnabled));
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('focusin', (event) => syncEditorStatus(event.target));
  document.addEventListener('focusout', () => {
    window.setTimeout(() => syncEditorStatus(document.activeElement), 0);
  });
  syncVimToggle();
  setStatus(currentIdleStatus());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVimNav, { once: true });
} else {
  initVimNav();
}
