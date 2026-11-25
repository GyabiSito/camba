import { Routes } from '@angular/router';
import { homepageBlocks } from '@camba/shared';
import { HomepageEditor, leaveHomepageEditor } from './homepage-editor';

export const homepageRoutes: Routes = [
  { path: '', pathMatch: 'full', title: 'Portada | Camba Admin', component: HomepageEditor, canDeactivate: [leaveHomepageEditor] },
  { path: 'vista-previa', title: 'Vista previa de portada | Camba Admin', loadComponent: () =>
    import('./preview/homepage-preview').then(module => module.HomepagePreview) },
  ...homepageBlocks.map(block => ({
    path: `secciones/${block}`, title: 'Editar portada | Camba Admin', component: HomepageEditor,
    data: { block }, canDeactivate: [leaveHomepageEditor],
  })),
];
