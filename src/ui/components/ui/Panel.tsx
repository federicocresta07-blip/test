import type { ReactNode } from 'react';

/**
 * Contenedor de seccion. Todas las pantallas usan este mismo marco, para que
 * la densidad y la jerarquia sean iguales en toda la app (seccion 3.2).
 */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  padded = true,
  className,
}: {
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly padded?: boolean;
  readonly className?: string;
}): ReactNode {
  return (
    <section className={['panel', className ?? ''].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <header className="panel__head">
          <div className="panel__titles">
            {title && <h2 className="panel__title">{title}</h2>}
            {subtitle && <p className="panel__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'panel__body' : 'panel__body panel__body--flush'}>{children}</div>
    </section>
  );
}
