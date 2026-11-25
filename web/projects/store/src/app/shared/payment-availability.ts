import { toSignal } from '@angular/core/rxjs-interop';
import { map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { readPublicStoreInfo } from './data-access/public-store-info';

export const paymentsEnabled = environment.checkoutPro;

export function checkoutProAvailability() {
  return toSignal(paymentsEnabled
    ? readPublicStoreInfo().pipe(map(info => info?.checkout_pro_available === true))
    : of(false));
}
