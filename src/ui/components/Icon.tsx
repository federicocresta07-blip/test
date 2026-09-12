import type { ReactNode } from 'react';

/**
 * Set minimo de iconos como SVG inline.
 * Sin libreria de iconos: son pocos y no justifica una dependencia.
 */
export type IconName =
  | 'home'
  | 'shirt'
  | 'market'
  | 'club'
  | 'trophy'
  | 'inbox'
  | 'bell'
  | 'chevron'
  | 'alert'
  | 'money'
  | 'calendar'
  | 'check'
  | 'user';

const PATHS: Record<IconName, string> = {
  home: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z',
  shirt: 'M8 3 4 5.5V11h3v10h10V11h3V5.5L16 3l-1.2 2.2a3 3 0 0 1-5.6 0L8 3Z',
  market: 'M4 7h16l-1.2 12.1a1 1 0 0 1-1 .9H6.2a1 1 0 0 1-1-.9L4 7Zm4 0V5.5a4 4 0 0 1 8 0V7',
  club: 'M4 21V9l8-6 8 6v12H4Zm5-2h2v-5h2v5h2v-7.5L12 8 9 11.5V19Z',
  trophy: 'M7 4h10v3a5 5 0 0 1-10 0V4Zm-3 1h3v2a3 3 0 0 1-3-3v1Zm13 0h3v-1a3 3 0 0 1-3 3V5ZM9 14h6l-.5 3H16v3H8v-3h1.5L9 14Z',
  inbox: 'M3 13V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v7h-6a3 3 0 0 1-6 0H3Zm0 2h4.4a5 5 0 0 0 9.2 0H21v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z',
  bell: 'M12 3a6 6 0 0 0-6 6v4l-1.5 3h15L18 13V9a6 6 0 0 0-6-6Zm-2.2 15a2.2 2.2 0 0 0 4.4 0h-4.4Z',
  chevron: 'M9 6l6 6-6 6',
  alert: 'M12 3 22 20H2L12 3Zm-1 6v5h2V9h-2Zm0 7v2h2v-2h-2Z',
  money: 'M3 6h18v12H3V6Zm2 2v8h14V8H5Zm7 1a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  calendar: 'M4 5h16v15H4V5Zm2 5v8h12v-8H6ZM8 3v3H7V3h1Zm9 0v3h-1V3h1Z',
  check: 'M4 12.5 9 17.5 20 6.5',
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-8 17a8 8 0 0 1 16 0H4Z',
};

const STROKE_ONLY: readonly IconName[] = ['chevron', 'check'];

export function Icon({
  name,
  size = 16,
  className,
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly className?: string;
}): ReactNode {
  const stroke = STROKE_ONLY.includes(name);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={stroke ? 'none' : 'currentColor'}
      stroke={stroke ? 'currentColor' : 'none'}
      strokeWidth={stroke ? 2 : 0}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
