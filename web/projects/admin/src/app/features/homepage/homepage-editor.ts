import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, CanDeactivateFn, RouterLink } from '@angular/router';
import { apiMessage, formatMoney, HomeAsset, HomeBlock, HomeDocument, HomeEditorState, HomeImage, HomeLink } from '@camba/shared';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Classification, Page, Product } from '../products';
import { HomeImageEditor } from './home-image-editor';
import { blockNames, HomeLinkEditor } from './home-link-editor';
import { HomepageApi } from './data-access/homepage-api';

@Component({
  imports: [FormsModule, NgTemplateOutlet, RouterLink, HomeImageEditor, HomeLinkEditor],
  templateUrl: './homepage-editor.html', styleUrl: './homepage-editor.css',
})
export class HomepageEditor {
  private readonly api = inject(HomepageApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly block = inject(ActivatedRoute).snapshot.data['block'] as HomeBlock | undefined;
  private readonly imageEditors = viewChildren(HomeImageEditor);
  protected readonly state = signal<HomeEditorState | null>(null);
  protected readonly document = signal<HomeDocument | null>(null);
  protected readonly categories = signal<Classification[]>([]);
  protected readonly catalog = signal<Product[]>([]);
  protected readonly result = signal<Page<Product> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly searching = signal(false);
  protected readonly dirty = signal(false);
  protected readonly stale = signal(false);
  protected readonly error = signal('');
  protected readonly catalogError = signal('');
  protected readonly message = signal('');
  protected readonly confirmDiscard = signal(false);
  protected readonly names = blockNames;
  protected readonly money = formatMoney;
  protected q = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private searchRequest = 0;
  private readonly beforeUnload = (event: BeforeUnloadEvent) => {
    if (this.dirty() || this.pending()) { event.preventDefault(); event.returnValue = ''; }
  };

  private pending() { return this.busy() || this.imageEditors().some(editor => editor.isUploading()); }
  canLeave() {
    return !this.pending() && (!this.dirty() || window.confirm('Tenés cambios sin guardar. ¿Querés salir y perderlos?'));
  }

  constructor() {
    void this.load();
    window.addEventListener('beforeunload', this.beforeUnload);
    this.destroy.onDestroy(() => { clearTimeout(this.timer); window.removeEventListener('beforeunload', this.beforeUnload); });
  }
  protected async load() {
    if (this.busy()) return;
    this.loading.set(true); this.error.set('');
    try {
      const { data } = await firstValueFrom(this.api.load());
      this.accept(data);
      await this.loadCatalog();
    } catch (error) { this.error.set(apiMessage(error, 'No pudimos abrir la portada. Reintentá sin cerrar esta página.')); }
    finally { this.loading.set(false); }
  }
  private accept(state: HomeEditorState) {
    this.state.set(state); this.document.set(structuredClone(state.draft ?? state.published));
    this.dirty.set(false); this.stale.set(false); this.confirmDiscard.set(false);
  }
  private async loadCatalog() {
    try {
      const [{ data }, page] = await firstValueFrom(forkJoin([
        this.api.categories(),
        this.api.listPublishedProducts({ per_page: 12 }),
      ]));
      this.categories.set(data.filter(category => category.active));
      this.retain(page.data); this.result.set(page);
      await Promise.all(this.categories().filter(category => !this.categoryPhoto(category.id)).map(async category => {
        try { const related = await firstValueFrom(this.api.listPublishedProducts({ category: category.id, per_page: 1 })); this.retain(related.data); }
        catch { /* A missing category cover has an explicit no-photo state. */ }
      }));
      const doc = this.document()!;
      const ids = new Set([...doc.selection.productIds, ...doc.look.productIds]);
      for (const link of [doc.hero.primary, doc.hero.secondary, doc.selection.action, doc.story.action, doc.mosaic.action, ...doc.mosaic.tiles.map(tile => tile.action)]) {
        if (link?.type === 'product') ids.add(link.id);
      }
      await Promise.all([...ids].filter(id => !this.catalog().some(product => product.id === id)).map(async id => {
        try { const { data } = await firstValueFrom(this.api.product(id)); if (data.status === 'published') this.retain([data]); }
        catch { /* Missing references remain visible by ID and can be removed without changing the draft. */ }
      }));
    } catch (error) { this.catalogError.set(apiMessage(error, 'No pudimos cargar el catálogo. Reintentá antes de elegir destinos.')); }
  }
  private retain(items: Product[]) { this.catalog.update(current => [...new Map([...current, ...items].map(item => [item.id, item])).values()]); }
  protected changed() { this.dirty.set(true); this.message.set(''); if (!this.stale()) this.error.set(''); }
  protected uploaded(value: { key: string; asset: HomeAsset }) { this.state.update(state => state && ({ ...state, assets: { ...state.assets, [value.key]: value.asset } })); }
  protected setTilePhoto(index: number, image: HomeImage | null) {
    if (!image) return;
    this.document()!.mosaic.tiles[index].image = image;
    this.changed();
  }
  protected toggle(block: HomeBlock) {
    const doc = this.document()!;
    doc.hidden = doc.hidden.includes(block) ? doc.hidden.filter(item => item !== block) : [...doc.hidden, block]; this.changed();
  }
  protected move<T>(items: T[], index: number, by: number) {
    if (index + by < 0 || index + by >= items.length) return;
    [items[index], items[index + by]] = [items[index + by], items[index]]; this.changed();
  }
  protected thumbnail(block: HomeBlock) {
    const doc = this.document()!;
    if (block === 'selection') {
      const product = doc.selection.mode === 'manual'
        ? doc.selection.productIds.map(id => this.product(id)).find(item => item?.images[0])
        : this.catalog().find(item => item.images[0] && (doc.selection.categoryId === null || item.category?.id === doc.selection.categoryId));
      return product?.images[0]?.thumbnail_url;
    }
    const photo = block === 'hero' ? doc.hero.desktop : block === 'categories' ? doc.categories.cards[0]?.image : doc[block].image;
    if (!photo) return block === 'categories' ? this.categoryPhoto(doc.categories.cards[0]?.categoryId ?? this.categories()[0]?.id) : '';
    const url = this.state()?.assets[photo.key]?.thumbnail_url ?? '';
    return url.startsWith('/demo-home/') ? new URL(url, this.state()!.store_url).href : url;
  }
  protected categoryPhoto(id?: number) { return this.catalog().find(product => product.category?.id === id && product.images[0])?.images[0].thumbnail_url; }
  protected product(id: number) { return this.catalog().find(item => item.id === id); }
  protected categoryName(id: number) { return this.categories().find(item => item.id === id)?.name ?? `Categoría ${id} no disponible`; }
  protected hasCategory(id: number) { return this.document()!.categories.cards.some(card => card.categoryId === id); }
  protected addCategory(id: number) {
    const cards = this.document()!.categories.cards;
    if (!cards.some(card => card.categoryId === id)) { cards.push({ categoryId: id, image: null, label: '' }); this.changed(); }
  }
  protected toggleProduct(ids: number[], id: number) { const index = ids.indexOf(id); if (index >= 0) ids.splice(index, 1); else ids.push(id); this.changed(); }
  protected search(query: string) { this.q = query; clearTimeout(this.timer); this.timer = setTimeout(() => void this.searchPage(1), 250); }
  protected async searchPage(page: number) {
    const request = ++this.searchRequest;
    this.searching.set(true); this.catalogError.set('');
    try {
      const result = await firstValueFrom(this.api.listPublishedProducts({ q: this.q.trim(), page, per_page: 12 }));
      if (request === this.searchRequest) { this.retain(result.data); this.result.set(result); }
    } catch (error) { if (request === this.searchRequest) this.catalogError.set(apiMessage(error)); }
    finally { if (request === this.searchRequest) this.searching.set(false); }
  }
  protected async save() { await this.mutate('save'); }
  protected async publish() { if (!this.dirty() && this.state()?.draft) await this.mutate('publish'); }
  protected async discard() { await this.mutate('discard'); }
  private async mutate(operation: 'save' | 'publish' | 'discard') {
    if (this.busy() || this.stale()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    try {
      const body = { revision: this.state()!.revision, ...(operation === 'save' ? { document: this.document() } : {}) };
      const response = operation === 'save' ? this.api.save(body) : this.api.transition(operation, body);
      this.accept((await firstValueFrom(response)).data);
      this.message.set(operation === 'save' ? 'Borrador guardado. La tienda sigue mostrando la versión publicada.' : operation === 'publish' ? 'Portada publicada. Ya está visible en la tienda.' : 'Borrador descartado. Volviste a la versión publicada.');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) { this.stale.set(true); this.error.set('Otra sesión cambió la portada. Conservamos tus cambios en esta página. Revisá la versión actual en otra pestaña; para reemplazar tus cambios, recargá explícitamente.'); }
      else this.error.set(apiMessage(error, 'No se pudo completar la acción. Conservamos tus cambios y la publicación anterior. Intentá de nuevo.'));
    } finally { this.busy.set(false); }
  }
}

export const leaveHomepageEditor: CanDeactivateFn<HomepageEditor> = editor => editor.canLeave();
