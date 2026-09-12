/** Formato de numeros, plata y fechas. Un solo lugar para toda la app. */

const MONEY = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' });
const DATE_LONG = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });

export function money(value: number): string {
  return MONEY.format(value);
}

/** Plata compacta para espacios chicos: $1,2 M / $850 k. */
export function moneyShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} MM`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')} M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)} k`;
  return `${sign}$${abs}`;
}

export function shortDate(iso: string): string {
  return DATE.format(new Date(`${iso}T12:00:00`));
}

export function longDate(iso: string): string {
  return DATE_LONG.format(new Date(`${iso}T12:00:00`));
}

/** Fin de contrato: se muestra el año, que es lo que importa. */
export function contractYear(iso: string): string {
  return iso.slice(0, 4);
}

export function decimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function signed(value: number, digits = 0): string {
  const text = value.toFixed(digits).replace('.', ',');
  return value > 0 ? `+${text}` : text;
}
