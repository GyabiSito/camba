import { formatMoney } from '@camba/shared';

import type { Settings } from './data-access/settings-api';
export type { Settings } from './data-access/settings-api';
export type EditableSettings = Omit<Settings, 'remind_payment' | 'payment_lead_minutes'>;

type SettingField = {
  name: keyof EditableSettings;
  label: string;
  kind: 'text' | 'email' | 'tel' | 'money' | 'number' | 'checkbox';
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
};

export const settingGroups: {
  id: string;
  title: string;
  description: string;
  fields: SettingField[];
}[] = [
  {
    id: 'datos-publicos',
    title: 'Datos de la tienda',
    description: 'El nombre comercial es público. Los datos de Contactanos se configuran por entorno.',
    fields: [
      { name: 'business_name', label: 'Nombre comercial', kind: 'text', required: true, max: 120 },
      { name: 'support_email', label: 'Correo interno para consultas', kind: 'email', max: 254, hint: 'Recibe los mensajes del formulario. No se publica.' },
      { name: 'support_phone', label: 'Teléfono de contacto', kind: 'tel', max: 40, hint: 'Queda guardado en Admin y no se publica.' },
    ],
  },
  {
    id: 'entrega',
    title: 'Envío y retiro',
    description: 'Si dejás un campo vacío, esa opción no se ofrece en nuevas compras.',
    fields: [
      { name: 'pickup_address', label: 'Dirección de retiro', kind: 'text', max: 255 },
      {
        name: 'delivery_cents',
        label: 'Costo del envío en UYU',
        kind: 'money',
        hint: 'Ingresá 0 si el envío es gratis. Podés usar coma para los centésimos.',
      },
    ],
  },
  {
    id: 'recordatorios',
    title: 'Recordatorios',
    description: 'Se envían por correo solo a compradores que eligieron recibirlos.',
    fields: [
      { name: 'remind_cart', label: 'Recordar un carrito sin finalizar', kind: 'checkbox' },
      {
        name: 'cart_delay_hours',
        label: 'Horas desde la última actividad del carrito',
        kind: 'number',
        min: 1,
        max: 168,
        hint: 'Entre 1 y 168 horas.',
      },
    ],
  },
  {
    id: 'umbrales',
    title: 'Avisos del panel',
    description:
      'Definí cuándo aparecen los avisos de stock bajo y de pedidos pagados pendientes de entrega.',
    fields: [
      {
        name: 'low_stock_threshold',
        label: 'Umbral de stock bajo (unidades)',
        kind: 'number',
        min: 0,
        max: 1000,
        hint: 'Entre 0 y 1.000 unidades.',
      },
      {
        name: 'pending_fulfilment_hours',
        label: 'Horas desde el pago para avisar una demora',
        kind: 'number',
        min: 1,
        max: 168,
        hint: 'Entre 1 y 168 horas.',
      },
    ],
  },
];

export const settingFields = settingGroups.flatMap((group) => group.fields);
export const historyFields: { name: keyof Settings; label: string }[] = [
  ...settingFields,
  { name: 'remind_payment', label: 'Recordar un pago pendiente' },
  { name: 'payment_lead_minutes', label: 'Minutos antes del vencimiento' },
];

export function parseDelivery(input: string): number | null {
  const parts = /^(\d{1,8})(?:[,.](\d{1,2}))?$/.exec(input.trim());
  if (!parts) return null;
  const cents = Number(parts[1]) * 100 + Number((parts[2] ?? '').padEnd(2, '0'));
  return cents <= 2147483647 ? cents : null;
}

export function displaySetting(key: keyof Settings, value: Settings[keyof Settings]): string {
  if (value === null || value === undefined || value === '') return 'Sin configurar';
  if (typeof value === 'boolean') return value ? 'Activado' : 'Desactivado';
  if (key === 'delivery_cents' && typeof value === 'number') return formatMoney(value);
  return String(value);
}
