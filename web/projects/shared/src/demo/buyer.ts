import type { Buyer } from '../data-access/buyer-contract';

export const demoBuyer = {
  id: 2,
  name: 'Lucía Pereira',
  email: 'cliente.diseno@camba.test',
  role: 'buyer',
  email_verified: true,
} satisfies Buyer;
