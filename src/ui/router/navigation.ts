/**
 * ARQUITECTURA DE INFORMACION Y MAPA DE NAVEGACION (secciones 4, 20 fase 0).
 *
 * Una sola definicion de la navegacion: la usa la sidebar, las rutas y las
 * paginas placeholder. Cada entrada dice honestamente si esta implementada y,
 * si no, en que fase del plan le toca.
 */

export type NavItem = {
  readonly label: string;
  readonly path: string;
  /** Implementado en esta entrega. */
  readonly ready: boolean;
  /** Fase del plan en la que se construye (para el placeholder honesto). */
  readonly phase: number;
  /** Descripcion de lo que va a hacer, para la pagina pendiente. */
  readonly summary?: string;
};

export type NavSection = {
  readonly label: string;
  readonly icon: string;
  readonly path: string;
  readonly items: readonly NavItem[];
};

export const NAVIGATION: readonly NavSection[] = [
  {
    label: 'Inicio',
    icon: 'home',
    path: '/',
    items: [{ label: 'Despacho del Manager', path: '/', ready: true, phase: 1 }],
  },
  {
    label: 'Equipo',
    icon: 'shirt',
    path: '/equipo',
    items: [
      { label: 'Plantel', path: '/equipo/plantel', ready: true, phase: 2 },
      { label: 'Alineación', path: '/equipo/alineacion', ready: true, phase: 2 },
      { label: 'Táctica', path: '/equipo/tactica', ready: true, phase: 2 },
      {
        label: 'Entrenamiento',
        path: '/equipo/entrenamiento',
        ready: false,
        phase: 4,
        summary:
          'Planes de entrenamiento por puesto y por jugador, con el efecto del staff y de las instalaciones sobre el desarrollo. Va con inferiores porque las dos cosas necesitan lo mismo: que el motor sepa hacer crecer los atributos de un jugador, que hoy no lo hace.',
      },
    ],
  },
  {
    label: 'Mercado',
    icon: 'market',
    path: '/mercado',
    items: [
      {
        label: 'Buscar jugadores',
        path: '/mercado/buscar',
        ready: false,
        phase: 5,
        summary:
          'Buscador por nombre, edad, posición, overall, nacionalidad, club, precio, salario y contrato.',
      },
      {
        label: 'Transferibles',
        path: '/mercado/transferibles',
        ready: false,
        phase: 5,
        summary: 'Jugadores que otros clubes pusieron en el mercado, humanos e IA.',
      },
      {
        label: 'Mis ofertas',
        path: '/mercado/enviadas',
        ready: false,
        phase: 5,
        summary: 'Ofertas realizadas con su estado: enviada, vista, contraoferta, aceptada o rechazada.',
      },
      {
        label: 'Ofertas recibidas',
        path: '/mercado/recibidas',
        ready: false,
        phase: 5,
        summary: 'Ofertas por tus jugadores, con aceptar, rechazar y contraofertar.',
      },
      {
        label: 'Historial',
        path: '/mercado/historial',
        ready: false,
        phase: 5,
        summary: 'Todas las transferencias cerradas del universo del juego.',
      },
    ],
  },
  {
    label: 'Club',
    icon: 'club',
    path: '/club',
    items: [
      {
        label: 'Staff',
        path: '/club/staff',
        ready: true,
        phase: 3,
        summary:
          'Los trece roles del cuerpo técnico con nivel en estrellas, salario, efecto actual y coste de mejora.',
      },
      {
        label: 'Inferiores',
        path: '/club/inferiores',
        ready: false,
        phase: 4,
        summary:
          'Plantilla juvenil con potencial estimado como rango: mejor scouting, rango más preciso.',
      },
      {
        label: 'Estadio',
        path: '/club/estadio',
        ready: false,
        phase: 6,
        summary:
          'Capacidad, ocupación, estado del campo, ingresos por partido y proyectos de ampliación.',
      },
      {
        label: 'Instalaciones',
        path: '/club/instalaciones',
        ready: true,
        phase: 3,
        summary:
          'Centro de entrenamiento, academia, centro médico, scouting y oficinas, de una a cinco estrellas.',
      },
      {
        label: 'Finanzas',
        path: '/club/finanzas',
        ready: false,
        phase: 6,
        summary: 'Caja, presupuesto, masa salarial, ingresos y gastos con detalle por rubro.',
      },
    ],
  },
  {
    label: 'Competición',
    icon: 'trophy',
    path: '/competicion',
    items: [
      {
        label: 'Calendario',
        path: '/competicion/calendario',
        ready: true,
        phase: 7,
        summary: 'Fixture completo del torneo, con PREPARAR EQUIPO y JUGAR PARTIDO en cada fecha.',
      },
      {
        label: 'Resultados',
        path: '/competicion/resultados',
        ready: true,
        phase: 7,
        summary: 'Resultados fecha por fecha con acceso a las estadísticas de cada partido.',
      },
      {
        label: 'Tabla',
        path: '/competicion/tabla',
        ready: true,
        phase: 7,
        summary: 'Tabla completa de Primera División y Primera Nacional.',
      },
      {
        label: 'Estadísticas',
        path: '/competicion/estadisticas',
        ready: true,
        phase: 7,
        summary: 'Goleadores, asistencias y estadísticas del torneo.',
      },
    ],
  },
  {
    label: 'Información',
    icon: 'inbox',
    path: '/informacion',
    items: [
      {
        label: 'Noticias',
        path: '/informacion/noticias',
        ready: true,
        phase: 7,
        summary: 'Novedades del universo: resultados, transferencias y movimientos de otros clubes.',
      },
      {
        label: 'Mensajes',
        path: '/informacion/mensajes',
        ready: true,
        phase: 3,
        summary: 'Bandeja completa con el historial de mensajes del cuerpo técnico y la dirigencia.',
      },
      {
        label: 'Rivales',
        path: '/informacion/rivales',
        ready: true,
        phase: 7,
        summary: 'Perfil de cada club del torneo: plantel, forma, fortalezas y debilidades.',
      },
    ],
  },
];

const ALL_ITEMS = NAVIGATION.flatMap((section) => section.items);

export function findNavItem(path: string): NavItem | undefined {
  return ALL_ITEMS.find((item) => item.path === path);
}

/**
 * Nombre de la pantalla actual, para el encabezado.
 *
 * Las dos rutas que llevan un id adentro —la ficha de un partido y el perfil
 * de un club— no estan en la navegacion, asi que `findNavItem` no las
 * encuentra. Sin esto el encabezado decia "Despacho del Manager" estando en
 * la ficha de un partido.
 */
export function pageTitle(path: string): string {
  const item = findNavItem(path);
  if (item) return item.label;
  if (path.startsWith('/competicion/partido/')) return 'Partido';
  if (path.startsWith('/informacion/rivales/')) return 'Rival';
  return 'Despacho del Manager';
}

/** Cuantos modulos quedan pendientes: la sidebar lo informa sin esconderlo. */
export function pendingModuleCount(): number {
  return ALL_ITEMS.filter((item) => !item.ready).length;
}

/**
 * Hasta que fase llega lo entregado. Se deriva de las propias entradas, asi
 * que agregar una pantalla alcanza para que la sidebar lo diga: no hay un
 * numero escrito a mano que se pueda quedar viejo.
 */
export function deliveredThroughPhase(): number {
  return ALL_ITEMS.filter((item) => item.ready).reduce(
    (highest, item) => Math.max(highest, item.phase),
    0,
  );
}
