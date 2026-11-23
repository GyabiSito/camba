import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HomeBlock, HomeLink, homepageBlocks } from '@camba/shared';
import { Classification, Product } from '../catalog/catalog-api';

export const blockNames: Record<HomeBlock, string> = { hero: 'Hero', categories: 'Categorías', selection: 'Selección de Camba', look: 'Armá el look', story: 'Texturas y detalles', mosaic: 'Mosaico final' };

@Component({
  selector: 'camba-home-link-editor', imports: [FormsModule], styleUrl: './homepage-media.css',
  template: `
    <fieldset class="link-editor"><legend>{{ label() }}</legend>
      <label class="field">Destino<select [ngModel]="link()?.type ?? ''" (ngModelChange)="kind($event)">
        <option value="">Sin enlace</option><option value="catalog">Catálogo</option><option value="category">Categoría</option><option value="product">Producto</option><option value="section">Sección de portada</option>
      </select></label>
      @if (link(); as action) {
        <label class="field">Texto del enlace<input [ngModel]="action.label" (ngModelChange)="setLabel($event)" maxlength="100" required></label>
        @if (action.type === 'section') {
          <label class="field">Sección<select [ngModel]="action.section" (ngModelChange)="setSection($event)">@for (section of blocks; track section) { <option [value]="section">{{ names[section] }}</option> }</select></label>
        }
        @if (action.type === 'category') {
          <div class="choice-list">@for (category of categories(); track category.id) {
            <button class="choice" type="button" [attr.aria-pressed]="action.id === category.id" (click)="setId(category.id)">@if (categoryPhoto(category.id); as src) { <img [src]="src" alt=""> } @else { <span class="no-photo">Sin foto</span> }<span>{{ category.name }}</span></button>
          }</div>
        }
        @if (action.type === 'product') {
          <label class="field">Buscar destino en productos<input type="search" [ngModel]="query()" (ngModelChange)="search.emit($event)"></label>
          <div class="choice-list">@for (product of products(); track product.id) {
            <button class="choice" type="button" [attr.aria-pressed]="action.id === product.id" (click)="setId(product.id)">@if (product.images[0]; as photo) { <img [src]="photo.thumbnail_url" alt=""> } @else { <span class="no-photo">Sin foto</span> }<span>{{ product.name || product.sku }}</span></button>
          }</div>
        }
      }
    </fieldset>
  `,
})
export class HomeLinkEditor {
  readonly link = input<HomeLink | null>(null);
  readonly label = input.required<string>();
  readonly categories = input.required<Classification[]>();
  readonly products = input.required<Product[]>();
  readonly query = input('');
  readonly linkChange = output<HomeLink | null>();
  readonly search = output<string>();
  protected readonly blocks = homepageBlocks;
  protected readonly names = blockNames;
  protected setLabel(label: string) { if (this.link()) this.linkChange.emit({ ...this.link()!, label }); }
  protected setSection(section: HomeBlock) { const link = this.link(); if (link?.type === 'section') this.linkChange.emit({ ...link, section }); }
  protected setId(id: number) { const link = this.link(); if (link?.type === 'category' || link?.type === 'product') this.linkChange.emit({ ...link, id }); }
  protected categoryPhoto(id: number) { return this.products().find(p => p.category?.id === id && p.images[0])?.images[0].thumbnail_url; }
  protected kind(type: '' | HomeLink['type']) {
    const label = this.link()?.label ?? 'Ver más';
    this.linkChange.emit(type === '' ? null : type === 'catalog' ? { type, label } : type === 'section' ? { type, label, section: 'selection' } : { type, label, id: (type === 'category' ? this.categories()[0]?.id : this.products()[0]?.id) ?? 0 });
  }
}
