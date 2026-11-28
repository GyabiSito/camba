import { DOCUMENT, Location, ViewportScroller } from '@angular/common';
import { afterNextRender, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isActive, PRIMARY_OUTLET, Router, RouterOutlet, Scroll } from '@angular/router';
import { StoreHeader } from './layout/store-header';
import { StoreFooter } from './layout/store-footer';

@Component({
  imports: [RouterOutlet, StoreHeader, StoreFooter],
  selector: 'app-root',
  host: { '[class.home-store]': 'home()', '[class.contact-store]': 'contact()' },
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class StoreShell {
  protected readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly currentPath = signal(this.location.path());
  protected readonly anchorBase = computed(() => '.' + (this.currentPath() || '/').split('#', 1)[0]);
  protected readonly home = isActive('/', this.router, { paths: 'exact', queryParams: 'ignored',
    matrixParams: 'ignored', fragment: 'ignored' });
  protected readonly contact = isActive('/contacto', this.router, { paths: 'exact', queryParams: 'ignored',
    matrixParams: 'ignored', fragment: 'ignored' });
  protected readonly openingHome = computed(() => {
    const navigation = this.router.currentNavigation();
    const target = navigation?.finalUrl ?? navigation?.initialUrl;
    return !!this.router.lastSuccessfulNavigation() && !this.home() && !!target &&
      !target.root.children[PRIMARY_OUTLET]?.segments.length;
  });

  constructor() {
    const destroy = inject(DestroyRef);
    const viewport = inject(ViewportScroller);
    const document = inject(DOCUMENT);
    destroy.onDestroy(this.location.onUrlChange(url => this.currentPath.set(url)));

    afterNextRender(() => {
      const browser = document.defaultView;
      if (!browser) return;
      this.router.events.pipe(takeUntilDestroyed(destroy)).subscribe(event => {
        if (!(event instanceof Scroll) || !event.position || event.scrollBehavior === 'manual') return;
        const position = event.position;
        const max = (document.scrollingElement?.scrollHeight ?? 0) - browser.innerHeight;
        if (position[1] <= max) return;
        // The router can restore before the page regains its full height. Retry a clamped position once.
        browser.requestAnimationFrame(() => {
          if (this.router.lastSuccessfulNavigation()?.id === event.routerEvent.id && viewport.getScrollPosition()[1] === max) {
            viewport.scrollToPosition(position, { behavior: 'instant' });
          }
        });
      });
    });
  }
}
