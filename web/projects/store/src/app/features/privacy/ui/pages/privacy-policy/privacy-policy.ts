import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../../../../environments/environment';
import type { PublicStoreInfo } from '../../../../../shared/data-access/public-store-info';
import { useStoreMeta } from '../../../../../core/seo/store-meta';
import { HelpArticle } from '../../../../../shared/ui/help-article/help-article';
import { scrollHelpOnNavigation } from '../../../../../shared/ui/help-article/scroll-help-on-navigation';

@Component({
  selector: 'store-privacy-policy',
  imports: [RouterLink, HelpArticle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy-policy.html',
  styleUrls: ['../../../../../shared/ui/help-article/help-content.css', './privacy-policy.css'],
})
export class PrivacyPolicy {
  protected readonly title = 'Política de privacidad';
  protected readonly description = 'Qué datos usa Camba y para qué los necesita.';
  protected readonly business = environment.business;
  protected readonly fiscalName = toSignal(inject(ActivatedRoute).data.pipe(
    map(data => (data['info'] as PublicStoreInfo | null)?.fiscalName?.trim() || null),
  ));

  constructor() {
    useStoreMeta(() => ({ title: this.title, description: this.description, canonical: '/politica-de-privacidad', noindex: !this.fiscalName() }));
    scrollHelpOnNavigation();
  }
}
