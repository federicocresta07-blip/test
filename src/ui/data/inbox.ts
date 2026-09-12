/**
 * DATOS DE DEMOSTRACION — Bandeja del Manager (secciones 5.4, 19).
 *
 * El staff le habla al manager: cada mensaje viene de un rol concreto y
 * lleva a la pantalla donde se resuelve.
 *
 * Aca van solo los mensajes que el prototipo NO puede derivar: cuentan cosas
 * del plantel y del calendario que todavia no se simulan. Los que dependen
 * del cuerpo tecnico y de las instalaciones se calculan en
 * `lib/staff-messages.ts` desde el estado real, asi que se actualizan solos.
 */

import type { InboxMessage } from '../models/index.ts';

export const DEMO_INBOX: readonly InboxMessage[] = [
  {
    id: 'msg-1',
    author: 'Médico',
    authorName: 'Dra. Carla Méndez',
    subject: 'Rodrigo Cáceres: desgarro grado 1',
    body: 'Le hicimos los estudios esta mañana. Tiene un desgarro en el isquiotibial derecho: lo estimo en tres semanas y media, veintitrés días para volver a entrenar con el grupo. No lo apuremos, con este tipo de lesión la recaída es lo que más cuesta.',
    date: '2026-05-09',
    unread: true,
    action: { label: 'Ver plantel', route: '/equipo/plantel' },
  },
  {
    id: 'msg-2',
    author: 'Analista de rivales',
    authorName: 'Hernán Costa',
    subject: 'Informe: Racing Club (fecha 15)',
    body: 'Racing viene jugando con bloque medio-bajo y sale rápido de contra por la derecha. Su lateral izquierdo se proyecta mucho y deja espalda. Si atacamos por ese costado con un extremo que encare, les cuesta. Ojo con la pelota parada: son buenos de cabeza en el segundo palo.',
    date: '2026-05-08',
    unread: true,
    action: { label: 'Preparar equipo', route: '/equipo/alineacion' },
  },
  {
    id: 'msg-3',
    author: 'Secretario técnico',
    authorName: 'Gustavo Pereyra',
    subject: 'Tres ofertas sobre la mesa',
    body: 'Nos llegaron tres ofertas. La de Talleres por Mendoza es la más seria y vence en dos días. Boca preguntó por Aguirre, pero por debajo de lo que vale. Y Platense insiste con Ledesma, que a esta altura del contrato nos conviene escuchar.',
    date: '2026-05-08',
    unread: true,
    action: { label: 'Ver ofertas', route: '/mercado/recibidas' },
  },
  {
    id: 'msg-5',
    author: 'Entrenador de arqueros',
    authorName: 'Ariel Monzón',
    subject: 'Quiroga pide minutos',
    body: 'Ramiro viene entrenando muy bien pero no suma minutos y se le nota en el ánimo. O le damos la copa o va a empezar a escuchar ofertas. Leone, el pibe de 19, está para ser el tercero sin problema.',
    date: '2026-05-05',
    unread: false,
    action: { label: 'Ver plantel', route: '/equipo/plantel' },
  },
  {
    id: 'msg-6',
    author: 'Presidencia',
    authorName: 'Comisión directiva',
    subject: 'Obra de la tribuna sur',
    body: 'La ampliación de la sur va al 62% y calculamos siete semanas más. Cuando termine suben los ingresos por partido. Tenemos caja para encarar una mejora más este semestre, pero una sola: decidilo con el cuerpo técnico.',
    date: '2026-05-04',
    unread: false,
    action: { label: 'Ver estadio', route: '/club/estadio' },
  },
  {
    id: 'msg-7',
    author: 'Preparador físico',
    authorName: 'Esteban Roldán',
    subject: 'Carga acumulada de Correa y Arriaga',
    body: 'Julián y Gonzalo vienen jugando todo y la carga se les está acumulando. Con el partido del martes y después el clásico, si no los dosificamos ahora los vamos a perder justo en la fecha que importa.',
    date: '2026-05-04',
    unread: false,
    action: { label: 'Preparar equipo', route: '/equipo/alineacion' },
  },
];
