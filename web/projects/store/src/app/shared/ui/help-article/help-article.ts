import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'store-help-article',
  templateUrl: './help-article.html',
  styleUrl: './help-article.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpArticle {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
