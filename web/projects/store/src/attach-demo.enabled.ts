import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { json, Router, type Express } from 'express';
import { demoBuyer } from '../../shared/src/demo/buyer';
import { demoProduct } from '../../shared/src/demo/catalog';
import type { Address, Cart, Line, Order, Shipping } from './app/shopper/shopper';

const deliveryCents = 19_000;
const pickup = 'Mostrador Camba';
const day = 24 * 60 * 60 * 1000;
type SourceDepartment = { id: number; name: string; towns: { id: number; name: string }[] };
// Only the opt-in offline demo reads the same canonical source directly, from the web workspace.
// The Docker store and production builds always use the PostgreSQL-backed API.
const directory = (JSON.parse(readFileSync(
  resolve('../api/database/data/countries.json'), 'utf8',
)) as SourceDepartment[]).map(({ id, name, towns }) => ({
  id, name, localities: towns.map((town) => ({ id: id * 10_000 + town.id, name: town.name })),
}));

function parseGeography(value: Record<string, unknown>) {
  const department = directory.find(({ id }) => id === value['department_id']);
  const locality = department?.localities.find(({ id }) => id === value['locality_id']);
  if (!department || !locality) return;
  return {
    department_id: department.id, locality_id: locality.id,
    department: department.name, locality: locality.name,
  };
}

const addresses: Address[] = [
  {
    id: 1,
    recipient: demoBuyer.name,
    department_id: 10,
    locality_id: 100_001,
    department: 'Montevideo',
    locality: 'Montevideo',
    street: 'Calle Muestra',
    number: '120',
    details: 'Apto. 2 · dirección de prueba',
    phone: '000 000 001',
    postal_code: '11200',
  },
  {
    id: 2,
    recipient: demoBuyer.name,
    department_id: 2,
    locality_id: 20_055,
    department: 'Canelones',
    locality: 'Ciudad de la Costa',
    street: 'Camino de Prueba',
    number: '42',
    details: 'Casa · dirección de prueba',
    phone: '000 000 002',
    postal_code: '15000',
  },
];

function line(product_id: number, quantity: number): Line {
  const product = demoProduct(product_id);
  if (!product) throw new Error('Missing product in the demo catalog: ' + product_id);
  return {
    product_id,
    quantity,
    name: product.name,
    sku: product.sku,
    unit_price_cents: product.price_cents,
    line_total_cents: product.price_cents * quantity,
  };
}

const subtotalOf = (lines: Line[]) => lines.reduce((sum, item) => sum + item.line_total_cents, 0);
const at = (ms: number) => new Date(ms).toISOString();
const text = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : '';

function shippingAddress(address: Address | null | undefined): Order['address'] {
  if (!address) return null;
  const { id: _id, phone: _phone, ...details } = address;
  return details;
}

function parseAddress(input: unknown, id: number): Address | undefined {
  if (!input || typeof input !== 'object') return;
  const value = input as Record<string, unknown>;
  const geography = parseGeography(value);
  if (!geography) return;
  const required = {
    recipient: text(value['recipient'], 120),
    street: text(value['street'], 160),
    number: text(value['number'], 20),
  };
  if (Object.values(required).some((part) => !part)) return;
  return {
    id,
    ...geography,
    ...required,
    details: text(value['details'], 255) || null,
    phone: text(value['phone'], 30) || null,
    postal_code: text(value['postal_code'], 12) || null,
  };
}

function seedOrders(now: number): Order[] {
  const seeds = [
    ['10000000-0000-4000-8000-000000000001', 'paid', 'completed', 2, 1, addresses[0], -12, -11],
    ['20000000-0000-4000-8000-000000000002', 'pending_payment', 'preparing', 4, 2, null, -4, 7],
    [
      '30000000-0000-4000-8000-000000000003',
      'payment_expired',
      'preparing',
      10,
      1,
      addresses[1],
      -2,
      -1,
    ],
  ] as const;
  return seeds.map(
    ([reference, status, fulfilment_status, product, quantity, address, created, until]) => {
      const items = [line(product, quantity)];
      const subtotal_cents = subtotalOf(items);
      const shipping_cents = address ? deliveryCents : 0;
      return {
        reference,
        status,
        fulfilment_status,
        items,
        subtotal_cents,
        shipping_cents,
        total_cents: subtotal_cents + shipping_cents,
        shipping_method: address ? 'delivery' : 'pickup',
        address: shippingAddress(address),
        pickup_address: address ? null : pickup,
        created_at: at(now + created * day),
        reservation_expires_at: at(now + until * day),
        tracking: status === 'paid' ? 'ENTREGA-001' : null,
      };
    },
  );
}

export function attachDemoShopper(app: Express): void {
  const router = Router();
  // ponytail: One synthetic buyer, one process. A restart resets the seed; no database or live provider.
  const state = {
    buyer: { ...demoBuyer },
    addresses: addresses.map((address) => ({ ...address })),
    nextAddress: 3,
    cart: new Map([
      [1, 1],
      [4, 1],
    ]),
    orders: seedOrders(Date.now()),
    orderKeys: new Map<string, Order>(),
  };
  const cart = (): Cart => ({
    currency: 'UYU',
    items: [...state.cart].map(([product_id, quantity]) => ({
      product_id,
      quantity,
      product: demoProduct(product_id) ?? null,
      available: true,
    })),
  });
  const quote = () => {
    const items = [...state.cart].map(([id, quantity]) => line(id, quantity));
    const subtotal_cents = subtotalOf(items);
    const shipping_options = (['delivery', 'pickup'] as const).map((method): Shipping => {
      const shipping_cents = method === 'delivery' ? deliveryCents : 0;
      return {
        method,
        shipping_cents,
        total_cents: subtotal_cents + shipping_cents,
        pickup_address: method === 'pickup' ? pickup : null,
        quote_token: createHash('sha256')
          .update(JSON.stringify([method, shipping_cents, items]))
          .digest('hex'),
      };
    });
    return { items, subtotal_cents, shipping_options };
  };
  const orderBy = (reference: string) =>
    state.orders.find((order) => order.reference === reference);
  const emptyOrders = { data: [], meta: { current_page: 1, last_page: 1, total: 0 } };

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Same-origin browser requests require the demo header, even for synthetic writes.
    if (req.get('X-Camba-Demo') !== '1') return res.sendStatus(404);
    if (req.method === 'GET' && req.path.startsWith('/geography/')) return next();
    if ((req.headers.cookie ?? '').split(';').some((part) => part.trim() === 'camba_demo_store=1'))
      return next();
    if (req.method === 'GET' && req.path === '/cart')
      return res.json({ data: { currency: 'UYU', items: [] } });
    if (req.method === 'GET' && req.path === '/orders') return res.json(emptyOrders);
    return res.status(401).json({ message: 'Iniciá sesión para continuar.' });
  });
  router.use(json({ limit: '32kb' }));
  router.get('/geography/departments', (_req, res) =>
    res.json({ data: directory.map(({ id, name }) => ({ id, name })) }));
  router.get('/geography/departments/:department/localities', (req, res) => {
    const department = directory.find(({ id }) => id === Number(req.params.department));
    if (!department) return res.sendStatus(404);
    return res.json({ data: department.localities });
  });
  router.get('/auth/me', (_req, res) => res.json({ data: state.buyer }));
  router.patch('/account/profile', (req, res) => {
    const name = text(req.body?.name, 120);
    if (!name) return res.status(422).json({ message: 'Ingresá tu nombre.' });
    state.buyer.name = name;
    return res.json({ data: state.buyer });
  });
  router.get('/account/addresses', (_req, res) => res.json({ data: state.addresses }));
  router.post('/account/addresses', (req, res) => {
    const address = parseAddress(req.body, state.nextAddress);
    if (!address) return res.status(422).json({ message: 'Completá los datos de la dirección.' });
    state.nextAddress++;
    state.addresses.push(address);
    return res.status(201).json({ data: address });
  });
  router.patch('/account/addresses/:id', (req, res) => {
    const id = Number(req.params.id);
    const index = state.addresses.findIndex((address) => address.id === id);
    if (index < 0) return res.sendStatus(404);
    const address = parseAddress(req.body, id);
    if (!address) return res.status(422).json({ message: 'Completá los datos de la dirección.' });
    state.addresses[index] = address;
    return res.json({ data: address });
  });
  router.delete('/account/addresses/:id', (req, res) => {
    state.addresses = state.addresses.filter((address) => address.id !== Number(req.params.id));
    return res.status(204).end();
  });
  router.get('/cart', (_req, res) => res.json({ data: cart() }));
  router
    .route('/cart/items/:id')
    .post(setQuantity)
    .put(setQuantity)
    .delete((req, res) => {
      state.cart.delete(Number(req.params.id));
      return res.status(204).end();
    });
  function setQuantity(
    req: import('express').Request<{ id: string }>,
    res: import('express').Response,
  ) {
    const id = Number(req.params.id);
    const product = demoProduct(id);
    if (!product) return res.status(404).json({ message: 'El producto no está disponible.' });
    const quantity = req.method === 'PUT' ? req.body?.quantity : (state.cart.get(id) ?? 0) + 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > product.stock) {
      return res
        .status(422)
        .json({ errors: { quantity: ['Elegí una cantidad dentro del stock.'] } });
    }
    state.cart.set(id, quantity);
    return res.json({ data: cart() });
  }
  router.post('/checkout/quote', (req, res) => {
    if (!state.cart.size) return res.status(422).json({ message: 'El carrito está vacío.' });
    if (req.body?.address !== undefined && !parseGeography(req.body.address ?? {})) {
      return res.status(422).json({ message: 'Elegí una localidad del departamento seleccionado.' });
    }
    return res.json({ data: quote() });
  });
  router.get('/orders', (req, res) => {
    const last_page = Math.max(1, Math.ceil(state.orders.length / 10));
    const current_page = Math.min(
      last_page,
      Math.max(1, Math.trunc(Number(req.query['page'])) || 1),
    );
    return res.json({
      data: state.orders.slice((current_page - 1) * 10, current_page * 10),
      meta: { current_page, last_page, total: state.orders.length },
    });
  });
  router.post('/orders', (req, res) => {
    const key = req.get('Idempotency-Key');
    if (!key || !/^[0-9a-f-]{36}$/i.test(key)) return res.sendStatus(422);
    const prior = state.orderKeys.get(key);
    if (prior) return res.status(201).json({ data: prior });
    const { items, subtotal_cents, shipping_options } = quote();
    const option = shipping_options.find(
      (value) =>
        value.method === req.body?.shipping_method && value.quote_token === req.body?.quote_token,
    );
    if (!option || !items.length)
      return res.status(409).json({ message: 'Volvé a cotizar el carrito.' });
    const address = option.method === 'delivery' ? parseAddress(req.body?.address, 0) : null;
    if (
      (option.method === 'delivery' && !address) ||
      !text(req.body?.contact?.name, 120) ||
      !text(req.body?.contact?.email, 254)
    ) {
      return res.status(422).json({ message: 'Completá los datos del pedido.' });
    }
    const order: Order = {
      reference: randomUUID(),
      status: 'pending_payment',
      fulfilment_status: 'preparing',
      items,
      subtotal_cents,
      shipping_cents: option.shipping_cents,
      total_cents: option.total_cents,
      shipping_method: option.method,
      pickup_address: option.pickup_address,
      address: shippingAddress(address),
      created_at: at(Date.now()),
      reservation_expires_at: at(Date.now() + 30 * 60 * 1000),
    };
    state.orders.unshift(order);
    state.orderKeys.set(key, order);
    state.cart.clear();
    return res.status(201).json({ data: order });
  });
  router.get('/orders/:reference', (req, res) => {
    const order = orderBy(req.params.reference);
    if (!order) return res.sendStatus(404);
    return res.json({ data: order });
  });
  // No provider or mail is attached to this offline fixture. Never mutate payment state here.
  router.post('/orders/:reference/payments', (_req, res) =>
    res.status(503).json({ message: 'El pago no está disponible por ahora.' }),
  );
  router.post('/orders/:reference/payments/refresh', (_req, res) =>
    res.status(503).json({ message: 'La actualización del pago no está disponible por ahora.' }),
  );
  router.all('/account/reminder-preferences', (_req, res) =>
    res
      .status(503)
      .json({ message: 'Los recordatorios por correo no están disponibles por ahora.' }),
  );
  router.use((_req, res) =>
    res.status(404).json({ message: 'Esta operación no está disponible por ahora.' }),
  );
  app.use('/__camba_demo', router);
}
