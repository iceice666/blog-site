function initDocOutline() {
  const nav = document.querySelector<HTMLElement>("[data-doc-outline]");
  if (!nav) return;
  const links = Array.from(
    nav.querySelectorAll<HTMLAnchorElement>("[data-doc-outline-link]"),
  );
  if (!links.length) return;

  const scroller = document.querySelector<HTMLElement>("[data-scroll-area]");
  const linkBySlug = new Map(links.map((l) => [l.dataset.docOutlineLink!, l]));
  const headingEls = links
    .map((l) => document.getElementById(l.dataset.docOutlineLink!))
    .filter((el): el is HTMLElement => Boolean(el));
  if (!headingEls.length) return;

  const marker = nav.querySelector<HTMLElement>("[data-doc-outline-marker]");

  let activeSlug = "";
  let ticking = false;
  function setActive(slug: string) {
    if (slug === activeSlug) return;
    if (activeSlug) linkBySlug.get(activeSlug)?.removeAttribute("data-doc-outline-active");
    activeSlug = slug;
    const link = linkBySlug.get(slug);
    if (!link) return;
    link.setAttribute("data-doc-outline-active", "");
    link.scrollIntoView({ block: "nearest" });
    if (marker) {
      marker.style.transform = `translateY(${link.offsetTop}px)`;
      marker.style.height = `${link.offsetHeight}px`;
    }
  }

  function updateActive() {
    const rootRect = scroller?.getBoundingClientRect();
    const bandTop = rootRect ? rootRect.top - 8 : -8;
    const bandBottom = rootRect ? rootRect.top + rootRect.height * 0.3 : window.innerHeight * 0.3;
    const current =
      headingEls.find((el) => {
        const rect = el.getBoundingClientRect();
        return rect.bottom >= bandTop && rect.top <= bandBottom;
      }) ??
      headingEls.findLast((el) => el.getBoundingClientRect().top <= bandBottom) ??
      headingEls[0];
    if (current.id) setActive(current.id);
  }

  const observer = new IntersectionObserver(
    () => {
      updateActive();
    },
    { root: scroller ?? null, rootMargin: "-8px 0px -70% 0px", threshold: 0 },
  );
  headingEls.forEach((el) => observer.observe(el));

  scroller?.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateActive();
      });
    },
    { passive: true },
  );

  // Initial highlight: first heading.
  setActive(headingEls[0].id);

  // Reliable jump inside the .scroll-area container (native #hash jump can be
  // unreliable when the scroller is a nested element, not the window).
  for (const link of links) {
    link.addEventListener("click", (e) => {
      const slug = link.dataset.docOutlineLink!;
      const target = document.getElementById(slug);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ block: "start" });
      history.replaceState(null, "", `#${slug}`);
      setActive(slug);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDocOutline);
} else {
  initDocOutline();
}
