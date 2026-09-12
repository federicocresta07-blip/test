import type { ReactNode } from 'react';

export type TabItem<T extends string> = {
  readonly id: T;
  readonly label: ReactNode;
  readonly count?: number;
};

export function Tabs<T extends string>({
  items,
  active,
  onChange,
  size = 'md',
}: {
  readonly items: readonly TabItem<T>[];
  readonly active: T;
  readonly onChange: (id: T) => void;
  readonly size?: 'sm' | 'md';
}): ReactNode {
  return (
    <div className={`tabs tabs--${size}`} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={item.id === active}
          className={`tabs__tab ${item.id === active ? 'is-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count !== undefined && <span className="tabs__count tnum">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
