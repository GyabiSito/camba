import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import type { PurchaseTerms } from '../../../data-access/purchase-terms';
import type { PublicStoreInfo } from '../../../../../shared/data-access/public-store-info';
import { useStoreMeta } from '../../../../../core/seo/store-meta';
import { HelpArticle } from '../../../../../shared/ui/help-article/help-article';
import { scrollHelpOnNavigation } from '../../../../../shared/ui/help-article/scroll-help-on-navigation';

@Component({
  selector: 'store-terms-conditions',
  imports: [RouterLink, HelpArticle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms-conditions.html',
  styleUrls: ['../../../../../shared/ui/help-article/help-content.css', './terms-conditions.css'],
})
export class TermsConditions {
  private readonly document = inject(DOCUMENT);
  protected readonly title = 'Términos y condiciones';
  protected readonly description = 'Condiciones de compra, entrega y atención de Camba.';
  protected readonly business = environment.business;
  protected readonly fiscalName = toSignal(inject(ActivatedRoute).data.pipe(
    map(data => (data['info'] as PublicStoreInfo | null)?.fiscalName?.trim() || null),
  ));
  protected readonly terms = toSignal(inject(ActivatedRoute).data.pipe(map(data => data['terms'] as PurchaseTerms | null)));

  constructor() {
    useStoreMeta(() => ({ title: this.title, description: this.description, canonical: '/terminos-y-condiciones', noindex: !this.fiscalName() || !this.terms() }));
    scrollHelpOnNavigation();
  }

  protected print(): void {
    this.document.defaultView?.print();
  }
}
