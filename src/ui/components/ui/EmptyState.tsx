import type { ReactNode } from 'react';

export function EmptyState({
  title,
  detail,
  action,
}: {
  readonly title: string;
  readonly detail?: string;
  readonly action?: ReactNode;
}): ReactNode {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {detail && <p className="empty__detail">{detail}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

/** Estado de carga: ocupa el lugar del contenido para que no salte el layout. */
export function Skeleton({
  height = 16,
  width = '100%',
  radius = 4,
}: {
  readonly height?: number | string;
  readonly width?: number | string;
  readonly radius?: number;
}): ReactNode {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} />;
}
