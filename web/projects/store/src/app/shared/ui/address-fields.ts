import { Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { catchError, distinctUntilChanged, map, of, startWith, Subject, switchMap } from 'rxjs';
import { LocationOption, LocationPicker } from './location-picker';
import { Address, addressGeography, makeAddressForm, addressFields } from '../data-access/address';
import { GeographyApi } from '../data-access/geography.api';

@Component({
  selector: 'camba-address-fields',
  imports: [LocationPicker, ReactiveFormsModule],
  styleUrl: '../shopper.css',
  styles: `
    .location-field {
      display: grid;
      align-content: start;
      gap: 0.35rem;
    }
    .location-field p {
      margin: 0;
    }
  `,
  template: `
    <div class="pair" [formGroup]="group()">
      @if (previous(); as saved) {
        @if (!addressGeography(group().getRawValue())) {
          <p class="notice span-row" role="status">
            Dirección anterior: {{ saved.locality }}, {{ saved.department }}. Elegí un departamento
            y una localidad válidos antes de usarla para un envío.
          </p>
        }
      }
      @let controls = group().controls;
      @let departments = departmentOptions();
      @let localities = localityOptions();
      <div class="location-field">
        <camba-location-picker
          fieldId="shipping-department"
          label="Departamento"
          placeholder="Buscá o elegí"
          [options]="departments?.options ?? []"
          [value]="controls.department_id.value"
          [disabled]="!departments?.options?.length"
          [invalid]="controls.department_id.touched && controls.department_id.invalid"
          (choose)="chooseDepartment($event)"
        />
        @if (departments?.loading) {
          <div role="status" class="shop-skeleton" aria-label="Cargando departamentos">
            <i aria-hidden="true"></i>
          </div>
        } @else if (departments?.failed) {
          <p class="problem small" role="alert">No pudimos cargar los departamentos.</p>
          <button type="button" class="button button--quiet" (click)="retryDepartments.next()">
            Volver a cargar departamentos
          </button>
        } @else if (departments?.options?.length === 0) {
          <p class="muted small" role="status">No hay departamentos disponibles.</p>
        }
      </div>
      <div class="location-field">
        <camba-location-picker
          fieldId="shipping-locality"
          label="Localidad"
          [placeholder]="controls.department_id.value ? 'Buscá o elegí' : ''"
          [options]="localities?.options ?? []"
          [value]="controls.locality_id.value"
          [disabled]="!localities?.options?.length"
          [invalid]="controls.locality_id.touched && controls.locality_id.invalid"
          (choose)="controls.locality_id.setValue($event)"
        />
        @if (localities?.loading) {
          <div role="status" class="shop-skeleton" aria-label="Cargando localidades">
            <i aria-hidden="true"></i>
          </div>
        } @else if (localities?.failed) {
          <p class="problem small" role="alert">No pudimos cargar las localidades.</p>
          <button type="button" class="button button--quiet" (click)="retryLocalities.next()">
            Volver a cargar localidades
          </button>
        } @else if (localities?.options?.length === 0) {
          <p class="muted small" role="status">
            Este departamento no tiene localidades disponibles.
          </p>
        } @else if (!controls.department_id.value) {
          <p class="muted small">Elegí primero el departamento.</p>
        }
      </div>
      @for (field of fields; track field.name) {
        <label
          class="field"
          [class.span-row]="field.name === 'details' || field.name === 'recipient'"
        >
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
  readonly previous = input<Address | null>(null);
  private readonly client = inject(GeographyApi);
  protected readonly retryDepartments = new Subject<void>();
  protected readonly retryLocalities = new Subject<void>();
  protected readonly fields = addressFields;
  protected readonly addressGeography = addressGeography;
  protected readonly departmentOptions = toSignal(
    this.retryDepartments.pipe(
      startWith(undefined),
      switchMap(() => this.locations(null)),
    ),
  );
  protected readonly localityOptions = toSignal(
    toObservable(this.group).pipe(
      switchMap(({ controls }) =>
        controls.department_id.valueChanges.pipe(startWith(controls.department_id.value)),
      ),
      distinctUntilChanged(),
      switchMap((department) =>
        department
          ? this.retryLocalities.pipe(
              startWith(undefined),
              switchMap(() => this.locations(department)),
            )
          : of(null),
      ),
    ),
  );

  protected chooseDepartment(id: number) {
    if (this.group().controls.department_id.value !== id)
      this.group().patchValue({ department_id: id, locality_id: null });
  }

  private locations(department: number | null) {
    const request = department === null ? this.client.departments() : this.client.localities(department);
    return request.pipe(
      map(({ data }) => ({ options: data, loading: false, failed: false })),
      catchError(() => of({ options: null, loading: false, failed: true })),
      startWith({ options: null, loading: true, failed: false }),
    );
  }
}
