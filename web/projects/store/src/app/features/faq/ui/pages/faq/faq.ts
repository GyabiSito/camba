import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { useStoreMeta } from '../../../../../core/seo/store-meta';
import { HelpArticle } from '../../../../../shared/ui/help-article/help-article';
import { scrollHelpOnNavigation } from '../../../../../shared/ui/help-article/scroll-help-on-navigation';

@Component({
  selector: 'store-faq',
  imports: [RouterLink, HelpArticle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './faq.html',
  styleUrls: ['../../../../../shared/ui/help-article/help-content.css', './faq.css'],
})
export class Faq {
  protected readonly title = 'Preguntas frecuentes';
  protected readonly description = 'Compras, envíos, cambios y tu cuenta en Camba.';

  constructor() {
    useStoreMeta(() => ({ title: this.title, description: this.description, canonical: '/preguntas-frecuentes' }));
    scrollHelpOnNavigation();
  }
}
