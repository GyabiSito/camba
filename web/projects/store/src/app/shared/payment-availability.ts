import { toSignal } from '@angular/core/rxjs-interop';
import { map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { readPublicStoreInfo } from './data-access/public-store-info';

// Keep the build opt-out independent of editorial and environment file replacements.
declare const CAMBA_PAYMENTS_ENABLED: boolean;
export const paymentsEnabled = environment.checkoutPro && CAMBA_PAYMENTS_ENABLED;

export function checkoutProAvailability() {
  return toSignal(paymentsEnabled
    ? readPublicStoreInfo().pipe(map(info => info?.checkout_pro_available ?? null))
    : of(false));
}
