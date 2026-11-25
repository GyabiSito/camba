import { ViewportScroller } from '@angular/common';
import { afterNextRender, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

export function scrollHelpOnNavigation(): void {
  const navigation = inject(Router).currentNavigation();
  const fragment = inject(ActivatedRoute).snapshot.fragment;
  if (navigation?.trigger !== 'imperative' || navigation.id <= 1 || fragment) return;

  const viewport = inject(ViewportScroller);
  // Angular skips scroll events before hydration stabilizes; never override Back or a fragment.
  afterNextRender(() => {
    if (viewport.getScrollPosition()[1] > 0) viewport.scrollToPosition([0, 0], { behavior: 'instant' });
  });
}
