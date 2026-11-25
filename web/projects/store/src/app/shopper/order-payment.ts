import { ApiClient } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { api, Data } from './shopper';

export async function startPayment(client: ApiClient, reference: string, key: string) {
  const { data } = await firstValueFrom(
    client.post<Data<{ status: string; checkout_url: string | null }>>(
      api + '/orders/' + encodeURIComponent(reference) + '/payments',
      undefined,
      { 'Idempotency-Key': key },
    ),
  );
  return data;
}
