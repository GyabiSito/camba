import { afterNextRender, Directive, ElementRef, inject, input, output } from '@angular/core';

@Directive({
  selector: 'img[homePhoto]',
  host: { '(error)': 'recover()' },
})
export class HomePhoto {
  readonly homePhoto = input('');
  readonly photoUnavailable = output<void>();
  private readonly image = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private remaining?: string[];

  constructor() {
    // An eager image can fail in SSR HTML before Angular attaches its listener.
    afterNextRender(() => {
      if (this.image.isConnected && this.image.complete && !this.image.naturalWidth) this.recover();
    });
  }

  protected recover(): void {
    const img = this.image;
    if (!this.remaining) {
      const sources = img.parentElement?.tagName === 'PICTURE'
        ? [...img.parentElement.querySelectorAll('source')] : [];
      const candidateSet = sources.find(source => matchMedia(source.media).matches)?.srcset || img.srcset;
      // ponytail: Only literal WebP paths with width descriptors; use a parser for arbitrary srcsets.
      const candidates = candidateSet.split(',').map(part => part.trim().split(/\s+/)[0]);
      this.remaining = [...new Set([...candidates, this.homePhoto()].filter(Boolean).flatMap(path => {
        const url = URL.parse(path, img.baseURI);
        return url && /^https?:$/.test(url.protocol) ? [url.href] : [];
      }))].filter(url => url !== (img.currentSrc || img.src));
      for (const source of sources) source.removeAttribute('srcset');
      img.removeAttribute('srcset');
    }
    const next = this.remaining.shift();
    if (next) img.src = next;
    else this.photoUnavailable.emit();
  }
}
