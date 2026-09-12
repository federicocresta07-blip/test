import type { ReactNode } from 'react';

/**
 * Primitivas de tabla densa. Las tablas son el corazon de un manager
 * clasico (seccion 3.2), asi que el estilo vive en un solo lugar.
 */
export function DataTable({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}): ReactNode {
  return (
    <div className="tablewrap">
      <table className={['dtable', className ?? ''].filter(Boolean).join(' ')}>{children}</table>
    </div>
  );
}

export type SortDirection = 'asc' | 'desc';

/** Encabezado ordenable: muestra la direccion activa. */
export function SortableTh({
  label,
  columnId,
  activeColumn,
  direction,
  onSort,
  align = 'left',
  width,
  title,
}: {
  readonly label: ReactNode;
  readonly columnId: string;
  readonly activeColumn: string;
  readonly direction: SortDirection;
  readonly onSort: (columnId: string) => void;
  readonly align?: 'left' | 'center' | 'right';
  readonly width?: number | string;
  readonly title?: string;
}): ReactNode {
  const active = activeColumn === columnId;
  return (
    <th
      style={{ textAlign: align, width }}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button className={`th-sort ${active ? 'is-active' : ''}`} onClick={() => onSort(columnId)} title={title}>
        {label}
        <span className="th-sort__arrow">{active ? (direction === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );
}
