import { useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon.tsx';
import { Link, isRouteActive, useRouter } from '../router/router.tsx';
import { NAVIGATION, pendingModuleCount, type NavSection } from '../router/navigation.ts';
import { deliveredPhasesLabel } from '../router/plan.ts';

/**
 * Navegacion principal (seccion 4).
 *
 * Barra lateral fija con secciones colapsables. Los modulos que todavia no
 * existen se muestran igual pero marcados como pendientes: la regla es no
 * esconderlos ni fingir que funcionan (secciones 20 fase 0, 21).
 */
export function Sidebar(): ReactNode {
  const { path } = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (label: string): void =>
    setCollapsed((current) => ({ ...current, [label]: !current[label] }));

  const pending = pendingModuleCount();

  return (
    <nav className="sidebar" aria-label="Navegación principal">
      <div className="sidebar__brand">
        <span className="sidebar__logo">AM</span>
        <span className="col">
          <span className="sidebar__brandname">Argentina Manager</span>
          <span className="sidebar__brandmeta">Prototipo · v0.2</span>
        </span>
      </div>

      <div className="sidebar__scroll">
        {NAVIGATION.map((section) => (
          <SidebarSection
            key={section.label}
            section={section}
            currentPath={path}
            collapsed={collapsed[section.label] ?? false}
            onToggle={() => toggle(section.label)}
          />
        ))}
      </div>

      <footer className="sidebar__foot">
        {/*
          Cuando queda algo pendiente se dice cuanto; cuando no queda nada, se
          dice eso. "0 módulos pendientes" es una línea que ocupa lugar y no
          informa, y dejarla puesta era esperar a que volviera a ser cierta.
        */}
        {pending > 0 ? (
          <p className="sidebar__footline">{pending} módulos pendientes del plan por fases</p>
        ) : (
          <p className="sidebar__footline">Plan completo: las nueve fases entregadas</p>
        )}
        <p className="sidebar__footline muted">Fases {deliveredPhasesLabel()} entregadas</p>
      </footer>
    </nav>
  );
}

function SidebarSection({
  section,
  currentPath,
  collapsed,
  onToggle,
}: {
  readonly section: NavSection;
  readonly currentPath: string;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}): ReactNode {
  // La seccion Inicio es un solo destino: no necesita desplegarse.
  const single = section.items.length === 1 && section.items[0]?.path === section.path;
  const active = isRouteActive(currentPath, section.path);

  if (single) {
    return (
      <Link
        to={section.path}
        className={`sidebar__single ${active ? 'is-active' : ''}`}
      >
        <Icon name={section.icon as IconName} size={16} />
        <span>{section.label}</span>
      </Link>
    );
  }

  return (
    <div className={`sidebar__section ${active ? 'is-active' : ''}`}>
      <button
        className="sidebar__sectionhead"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <Icon name={section.icon as IconName} size={16} />
        <span className="sidebar__sectionlabel">{section.label}</span>
        <Icon
          name="chevron"
          size={13}
          className={`sidebar__chevron ${collapsed ? '' : 'is-open'}`}
        />
      </button>

      {!collapsed && (
        <ul className="sidebar__items">
          {section.items.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`sidebar__item ${currentPath === item.path ? 'is-active' : ''} ${
                  item.ready ? '' : 'is-pending'
                }`}
                title={item.ready ? undefined : `Pendiente — fase ${item.phase} del plan`}
              >
                <span className="truncate">{item.label}</span>
                {!item.ready && (
                  <span className="sidebar__pending" aria-label="Módulo pendiente">
                    ○
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
