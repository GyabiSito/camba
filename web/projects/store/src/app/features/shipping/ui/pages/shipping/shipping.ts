import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatMoney } from '@camba/shared';
import { useStoreMeta } from '../../../../../core/seo/store-meta';
import type { PublicStoreInfo } from '../../../../../shared/data-access/public-store-info';
import { HelpArticle } from '../../../../../shared/ui/help-article/help-article';
import { scrollHelpOnNavigation } from '../../../../../shared/ui/help-article/scroll-help-on-navigation';

@Component({
  selector: 'store-shipping',
  imports: [RouterLink, HelpArticle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shipping.html',
  styleUrls: ['../../../../../shared/ui/help-article/help-content.css', './shipping.css'],
})
export class Shipping {
  protected readonly title = 'Envíos';
  protected readonly description = 'Cómo recibir o retirar tu pedido y dónde ver el costo antes de confirmar.';
  protected readonly info = inject(ActivatedRoute).snapshot.data['info'] as PublicStoreInfo | null;
  protected readonly money = formatMoney;

  constructor() {
    useStoreMeta(() => ({ title: this.title, description: this.description, canonical: '/envios' }));
    scrollHelpOnNavigation();
  }
}
