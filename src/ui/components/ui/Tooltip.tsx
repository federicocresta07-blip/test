import { useId, useState, type ReactNode } from 'react';

/**
 * Tooltip propio, sin libreria: se muestra al pasar el mouse y tambien al
 * enfocar con teclado (seccion 6.11 pide iconografia compacta con tooltip).
 */
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  readonly content: ReactNode;
  readonly children: ReactNode;
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
}): ReactNode {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} tabIndex={0} className="tooltip__trigger">
        {children}
      </span>
      {open && (
        <span role="tooltip" id={id} className={`tooltip__bubble tooltip__bubble--${side}`}>
          {content}
        </span>
      )}
    </span>
  );
}
