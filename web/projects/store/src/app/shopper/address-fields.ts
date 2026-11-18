import { Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { addressFields, makeAddressForm } from './shopper';

@Component({
  selector: 'camba-address-fields',
  imports: [ReactiveFormsModule],
  styleUrl: './shopper.css',
  template: `
    <div class="pair" [formGroup]="group()">
      @for (field of fields; track field.name) {
        <label class="field" [class.span-row]="field.name === 'details'">
          {{ field.label }}
          <input
            [formControlName]="field.name"
            [autocomplete]="field.autocomplete"
            [maxLength]="field.limit"
            [required]="field.name !== 'details' && field.name !== 'postal_code'"
          />
        </label>
      }
    </div>
  `,
})
export class AddressFields {
  readonly group = input.required<ReturnType<typeof makeAddressForm>>();
  protected readonly fields = addressFields;
}
