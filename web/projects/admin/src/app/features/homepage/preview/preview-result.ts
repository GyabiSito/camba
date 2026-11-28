import type { HomeData, HomeRenderOptions, PageResult } from '../../../../../../store/src/app/home-preview';

export type PreviewResult = PageResult<HomeData> & { options?: HomeRenderOptions };
