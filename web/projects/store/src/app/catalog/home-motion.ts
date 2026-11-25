import { animate } from 'animejs/animation';
import { createScope } from 'animejs/scope';
import { stagger } from 'animejs/utils';

export function attachHomeMotion(root: HTMLElement, reduced: MediaQueryList): () => void {
  const events = new AbortController();
  const options = { signal: events.signal };
  const scope = createScope({ root });
  const timing = { duration: 200, ease: 'out(3)' } as const;

  let entranceFrame = 0;
  const hero = root.querySelector<HTMLImageElement>('.campaign-photo img');
  const enter = () => {
    if (events.signal.aborted) return;
    // Keep SSR copy visible and start the movement only when the photo can paint.
    entranceFrame = requestAnimationFrame(() => {
      const copy = root.querySelectorAll('.campaign-copy h1, .campaign-copy p, .campaign-cta');
      if (copy.length) scope.execute(() => animate(copy, {
        translateY: [28, 0],
        opacity: [.6, 1],
        delay: stagger(90),
        duration: 550,
        ease: 'out(2)',
      }));
    });
  };
  if (hero) void hero.decode().then(enter, enter);
  else enter();

  const photos = root.querySelector('.story-details');
  const story = photos && new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || events.signal.aborted) return;
    story?.disconnect();
    const visible = photos.querySelectorAll('img');
    if (visible.length) scope.execute(() => animate(visible, {
      translateY: [12, 0],
      delay: stagger(50),
      duration: 480,
      ease: 'out(3)',
    }));
  }, { threshold: .12 });
  if (photos) story?.observe(photos);

  const filters = root.querySelector<HTMLElement>('.shelf-filters');
  const marker = filters?.querySelector<HTMLElement>('.shelf-indicator');
  let slide: ReturnType<typeof animate> | undefined;
  let cards: ReturnType<typeof animate> | undefined;
  let resize: ResizeObserver | undefined;
  let filterChanges: MutationObserver | undefined;
  if (filters && marker) {
    const currentFilter = () => filters.querySelector<HTMLElement>('[aria-pressed="true"]');
    const move = (smooth: boolean) => {
      const selected = currentFilter();
      if (!selected) return;
      const group = filters.getBoundingClientRect();
      const button = selected.getBoundingClientRect();
      const previous = marker.getBoundingClientRect();
      const style = getComputedStyle(selected);
      const start = parseFloat(style.paddingLeft);
      const x = button.left - group.left + start;
      const y = button.bottom - group.top - 5;
      const width = button.width - start - parseFloat(style.paddingRight);
      slide?.cancel();
      if (smooth && previous.width > 0) {
        slide = scope.execute(() => animate(marker, {
          translateX: [previous.left - group.left, x],
          translateY: [previous.top - group.top, y],
          scaleX: [previous.width, width],
          ...timing,
        }));
      } else {
        marker.style.transform = `translateX(${x}px) translateY(${y}px) scaleX(${width})`;
      }
    };
    filters.setAttribute('data-motion', '');
    move(false);
    let previous = currentFilter();
    let revision = 0;
    // Wait for the pressed state and the result cards to be committed to the DOM.
    filterChanges = new MutationObserver(() => {
      const selected = currentFilter();
      if (!selected || selected === previous) return;
      previous = selected;
      move(true);
      cards?.revert();
      const version = ++revision;
      const images = [...root.querySelectorAll<HTMLImageElement>('.home-products li > store-product-photo:not(.alternate) img')];
      void Promise.allSettled(images.map(img => img.decode())).then(() => {
        if (events.signal.aborted || version !== revision) return;
        const ready = images.filter(img => img.isConnected && img.naturalWidth);
        if (ready.length) cards = scope.execute(() => animate(ready, {
          translateY: [18, 0],
          opacity: [.7, 1],
          delay: stagger(45),
          duration: 320,
          ease: 'out(2)',
        }));
      });
    });
    filterChanges.observe(filters, { subtree: true, attributeFilter: ['aria-pressed'] });
    resize = new ResizeObserver(() => move(false));
    resize.observe(filters);
    for (const button of filters.querySelectorAll('button')) resize.observe(button);
  }

  const cleanup = () => {
    if (events.signal.aborted) return;
    events.abort();
    cancelAnimationFrame(entranceFrame);
    filterChanges?.disconnect();
    resize?.disconnect();
    story?.disconnect();
    scope.revert();
    filters?.removeAttribute('data-motion');
    marker?.removeAttribute('style');
  };
  reduced.addEventListener('change', () => { if (reduced.matches) cleanup(); }, options);
  return cleanup;
}
