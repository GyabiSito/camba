import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Classification, ProductFields } from './catalog-api';

@Component({
  selector: 'app-product-fields',
  imports: [FormsModule],
  styleUrl: './catalog.css',
  template: `
    <div class="field-grid">
      <label class="field wide">Nombre
        <input [(ngModel)]="values().name" maxlength="120" [attr.aria-invalid]="errors()['name'] ? true : null" />
        @for (message of errors()['name'] ?? []; track $index) { <span class="field-error">{{ message }}</span> }
      </label>
      <label class="field">Precio (UYU)
        <input [(ngModel)]="values().price" inputmode="decimal" maxlength="11" placeholder="Ej.: 990,50" [attr.aria-invalid]="errors()['price_cents'] ? true : null" />
        @for (message of errors()['price_cents'] ?? []; track $index) { <span class="field-error">{{ message }}</span> }
      </label>
      <label class="field">Stock
        <input [(ngModel)]="values().stock" inputmode="numeric" maxlength="10" [attr.aria-invalid]="errors()['stock'] ? true : null" />
        @for (message of errors()['stock'] ?? []; track $index) { <span class="field-error">{{ message }}</span> }
      </label>
      <label class="field">Categoría
        <select [(ngModel)]="values().category" [attr.aria-invalid]="errors()['category_id'] ? true : null">
          <option [ngValue]="null">Sin categoría</option>
          @for (item of categories(); track item.id) {
            @if (item.active || item.id === values().category) {
              <option [ngValue]="item.id" [disabled]="!item.active">{{ item.name }}{{ item.active ? '' : ' (inactiva)' }}</option>
            }
          }
        </select>
        @for (message of errors()['category_id'] ?? []; track $index) { <span class="field-error">{{ message }}</span> }
      </label>
      <label class="field">Marca (opcional)
        <select [(ngModel)]="values().brand" [attr.aria-invalid]="errors()['brand_id'] ? true : null">
          <option [ngValue]="null">Sin marca</option>
          @for (item of brands(); track item.id) {
            @if (item.active || item.id === values().brand) {
              <option [ngValue]="item.id" [disabled]="!item.active">{{ item.name }}{{ item.active ? '' : ' (inactiva)' }}</option>
            }
          }
        </select>
        @for (message of errors()['brand_id'] ?? []; track $index) { <span class="field-error">{{ message }}</span> }
      </label>
      <label class="field wide">Descripción (opcional)
        <textarea [(ngModel)]="values().description" rows="4" maxlength="4000" [attr.aria-invalid]="errors()['description'] ? true : null"></textarea>
        @for (message of errors()['description'] ?? []; track $index) { <span class="field-error">{{ message }}</span> }
      </label>
    </div>
  `,
})
export class ProductFieldsForm {
  readonly values = input.required<ProductFields>();
  readonly categories = input.required<Classification[]>();
  readonly brands = input.required<Classification[]>();
  readonly errors = input<Record<string, string[]>>({});
}
