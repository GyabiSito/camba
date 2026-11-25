import { Component, computed, input, output, signal } from '@angular/core';

export type LocationOption = { id: number; name: string };

const searchable = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

@Component({
  selector: 'camba-location-picker',
  templateUrl: './location-picker.html',
  styleUrls: ['../shopper.css', './location-picker.css'],
})
export class LocationPicker {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly LocationOption[]>();
  readonly value = input.required<number | null>();
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly placeholder = input.required<string>();
  readonly choose = output<number>();

  protected readonly expanded = signal(false);
  protected readonly active = signal(-1);
  private readonly query = signal<string | null>(null);
  protected readonly listId = computed(() => this.fieldId() + '-list');
  protected readonly selected = computed(() =>
    this.options().find(({ id }) => id === this.value()),
  );
  protected readonly text = computed(() => this.query() ?? this.selected()?.name ?? '');
  protected readonly matches = computed(() => {
    const query = searchable(this.query() ?? '');
    return this.options().filter(({ name }) => searchable(name).includes(query));
  });
  protected readonly activeId = computed(() => {
    const option = this.matches()[this.active()];
    return this.expanded() && option ? this.optionId(option) : null;
  });

  protected optionId(option: LocationOption) {
    return this.listId() + '-' + option.id;
  }

  protected search(text: string) {
    this.query.set(text);
    this.active.set(-1);
    this.expanded.set(true);
  }

  protected blur(picker: HTMLElement, next: EventTarget | null) {
    if (!(next instanceof Node) || !picker.contains(next)) this.close();
  }

  private close() {
    this.expanded.set(false);
    this.query.set(null);
    this.active.set(-1);
  }

  protected select(option: LocationOption) {
    this.choose.emit(option.id);
    this.close();
  }

  protected key(event: KeyboardEvent, input: HTMLInputElement) {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.expanded.set(true);
      const last = this.matches().length - 1;
      const next =
        event.key === 'ArrowDown'
          ? Math.min(this.active() + 1, last)
          : this.active() < 0
            ? last
            : Math.max(this.active() - 1, 0);
      this.active.set(next);
      const id = this.activeId();
      if (id)
        requestAnimationFrame(() =>
          input.ownerDocument.getElementById(id)?.scrollIntoView({ block: 'nearest' }),
        );
    } else if (this.expanded() && event.key === 'Enter') {
      event.preventDefault();
      const option = this.matches()[this.active()];
      if (option) this.select(option);
    } else if (this.expanded() && event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }
}
