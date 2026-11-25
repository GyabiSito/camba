import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatDate } from '@camba/shared';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';
import { pageNumber, readState } from '../../shared/operations-data';
import { OperationLoading, OperationPager } from '../../shared/operation-ui';
import { displaySetting, settingFields, Settings } from './settings-data';
import { AuditEntry, SettingsApi } from './data-access/settings-api';

@Component({
  selector: 'camba-settings-history',
  imports: [RouterLink, OperationLoading, OperationPager],
  template: `
    <a class="ops-back ops-link" routerLink="/configuracion">Volver a configuración</a>
    <header class="ops-heading">
      <div>
        <h1>Historial de configuración</h1>
        <p>Consultá qué cambió, cuándo y qué usuario lo modificó.</p>
      </div>
    </header>
    @let result = history();
    @if (result?.status === 'loading') {
      <camba-operation-loading label="Cargando historial de cambios" />
    } @else if (result?.status === 'error') {
      <div class="callout ops-error" role="alert">
        <p>{{ result.message }}</p>
        <button class="button button--quiet" type="button" (click)="retry()">Reintentar</button>
      </div>
    } @else if (result?.status === 'loaded') {
      @if (result.value.data.length) {
        <ul class="ops-list history-list" role="list" aria-label="Cambios guardados">
          @for (entry of result.value.data; track entry.id) {
            <li class="history-entry">
              <details>
                <summary>
                  <strong>{{ date(entry.created_at) }}</strong><span class="muted"
                    >Usuario {{ entry.actor_id }}</span
                  >
                </summary>
                <dl class="history-fields">
                  @for (field of changedFields(entry); track field.name) {
                    <div class="history-change">
                      <dt>{{ field.label }}</dt>
                      <dd>
                        <span class="muted">Antes</span
                        ><span>{{ display(field.name, entry.before[field.name]) }}</span>
                      </dd>
                      <dd>
                        <span class="muted">Después</span
                        ><span>{{ display(field.name, entry.after[field.name]) }}</span>
                      </dd>
                    </div>
                  } @empty {
                    <div class="history-change">
                      <dt>Sin cambios visibles</dt>
                      <dd>Los valores efectivos no se modificaron.</dd>
                    </div>
                  }
                </dl>
              </details>
            </li>
          }
        </ul>
      } @else {
        <div class="ops-empty" role="status">
          <h2>Todavía no hay cambios guardados</h2>
          <p>Las próximas modificaciones de la configuración aparecerán acá.</p>
        </div>
      }
      <camba-operation-pager [info]="result.value" singular="cambio" plural="cambios" />
    }
  `,
  styleUrls: ['../../shared/operations.css', './settings.css'],
})
export class SettingsHistoryPage {
  private readonly api = inject(SettingsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly reload = new BehaviorSubject(0);
  readonly date = formatDate;
  readonly display = displaySetting;
  readonly history = toSignal(
    combineLatest([this.route.queryParamMap, this.reload]).pipe(
      switchMap(([params]) =>
        readState(
          this.api.history(pageNumber(params.get('page'))),
          'No pudimos cargar el historial de cambios.',
        ),
      ),
    ),
  );

  retry() {
    this.reload.next(0);
  }

  changedFields(entry: AuditEntry) {
    return settingFields.filter(({ name }) => entry.before[name] !== entry.after[name]);
  }
}
