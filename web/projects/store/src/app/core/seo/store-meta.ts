import { DOCUMENT, effect, inject, InjectionToken, REQUEST } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export const STORE_CANONICAL_ORIGIN = new InjectionToken<string>('Public storefront origin');

export function useStoreMeta(
  read: () => { title: string; description: string; canonical?: string; noindex?: boolean },
) {
  const title = inject(Title);
  const meta = inject(Meta);
  const document = inject(DOCUMENT);
  const origin =
    inject(STORE_CANONICAL_ORIGIN, { optional: true }) ||
    inject(REQUEST, { optional: true })?.url ||
    document.location?.origin;
  let canonical: HTMLLinkElement | null = null;
  effect((onCleanup) => {
    const state = read();
    title.setTitle(`${state.title} | Camba`);
    meta.updateTag({ name: 'description', content: state.description });
    if (state.noindex) meta.updateTag({ name: 'robots', content: 'noindex' });
    if (state.canonical) {
      canonical =
        document.head.querySelector('link[rel="canonical"]') ?? document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.setAttribute(
        'href',
        origin && /^https?:\/\//.test(origin)
          ? new URL(state.canonical, origin).href
          : state.canonical,
      );
      if (!canonical.parentNode) document.head.appendChild(canonical);
    }
    onCleanup(() => {
      if (canonical?.parentNode) canonical.parentNode.removeChild(canonical);
      meta.removeTag('name="description"');
      if (state.noindex) meta.removeTag('name="robots"');
    });
  });
}
