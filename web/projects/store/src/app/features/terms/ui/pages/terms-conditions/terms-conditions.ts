import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  constructor() {
    useStoreMeta(() => ({ title: this.title, description: this.description, canonical: '/terminos-y-condiciones', noindex: true }));
    scrollHelpOnNavigation();
  }

  protected print(): void {
    this.document.defaultView?.print();
  }
}
