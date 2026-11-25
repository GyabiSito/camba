import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { HomeDocument, HomeImage, HomeLink } from '@camba/shared';
import type { HomeData } from './home.model';
import { HOME_RENDER_OPTIONS } from './home-render-options';
import { HomePhoto } from './home-photo';
import { homeCatalog, homeCrop, homeHref, homeImage, homeSectionExists, homeSrcset } from './home-config';

@Component({
  selector: 'store-home-mosaic',
  imports: [NgTemplateOutlet, HomePhoto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-mosaic.html',
  styleUrl: './home-mosaic.css',
})
export class HomeMosaic {
  private readonly visuals = inject(HOME_RENDER_OPTIONS);
  readonly shop = input<HomeData>();
  readonly document = input.required<HomeDocument>();
  protected readonly image = (image: HomeImage | null) => homeImage(image, this.shop()?.publication?.assets ?? {}, this.visuals.editorial, this.visuals.assetOrigin);
  protected readonly srcset = homeSrcset;
  protected readonly crop = homeCrop;
  protected readonly href = (link: HomeLink | null) => homeHref(link, this.shop() ? homeCatalog(this.shop()!) : undefined, this.document(),
    block => homeSectionExists(block, this.document(), this.shop(), this.visuals.editorial));
  protected readonly brand = computed(() => this.image(this.document().mosaic.image));
  protected readonly photos = computed(() => this.document().mosaic.tiles.flatMap((tile, index) => {
    const asset = this.image(tile.image);
    return asset ? [{ ...tile, asset, index, name: tile.image.key }] : [];
  }));
  protected readonly visible = computed(() => this.visuals.editorial || this.brand() || this.photos().length);
  protected readonly failed = signal<Partial<Record<string, true>>>({});
  protected unavailable(name: string): void {
    this.failed.update(failed => ({ ...failed, [name]: true }));
  }
}
