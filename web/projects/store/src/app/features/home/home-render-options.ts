import { InjectionToken } from '@angular/core';
import { editorialEnabled } from './editorial-config';

export interface HomeRenderOptions {
  editorial: boolean;
  assetOrigin?: string;
  preview?: boolean;
}

export const HOME_RENDER_OPTIONS = new InjectionToken<HomeRenderOptions>('Homepage visuals', {
  factory: () => ({ editorial: editorialEnabled }),
});
