/**
 * MENSAJES DE LA BANDEJA GENERADOS DESDE EL ESTADO DEL CLUB
 * (secciones 5.4, 7, 8 — fase 3).
 *
 * Los mensajes fijos de `data/inbox.ts` son color: cuentan cosas del plantel
 * que el prototipo todavía no simula. Estos son lo contrario: se calculan
 * desde el staff y las instalaciones que hay AHORA, con los mismos números
 * que muestran las pantallas de desarrollo.
 *
 * Por eso son la prueba de que el sistema funciona de verdad: si mejorás la
 * instalación que frena al preparador físico, el mensaje en el que se queja
 * desaparece solo. No hay que acordarse de borrarlo.
 */

import { facilitySpec, type FacilityId } from '../../domain/facilities.ts';
import {
  rolesSupportedBy,
  staffEffect,
  staffSpec,
  type StaffEffect,
} from '../../domain/staff.ts';
import type { ClubFacility, InboxMessage, StaffMember, StaffVacancy } from '../models/index.ts';
import { moneyShort } from './format.ts';

/** Fecha a N días de `today`, en ISO corto. */
function daysBefore(today: string, days: number): string {
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function levelOf(facilities: readonly ClubFacility[], id: FacilityId): ClubFacility['level'] {
  return facilities.find((facility) => facility.id === id)?.level ?? 1;
}

/** El profesional al que las instalaciones le recortan más. */
function worstLimited(
  staff: readonly StaffMember[],
  facilities: readonly ClubFacility[],
): { readonly member: StaffMember; readonly effect: StaffEffect } | null {
  let worst: { member: StaffMember; effect: StaffEffect } | null = null;
  for (const member of staff) {
    const spec = staffSpec(member.role);
    const effect = staffEffect(member.role, member.level, levelOf(facilities, spec.facility));
    if (!effect.limited) continue;
    if (!worst || effect.utilisation < worst.effect.utilisation) worst = { member, effect };
  }
  return worst;
}

export function staffMessages(
  staff: readonly StaffMember[],
  vacancies: readonly StaffVacancy[],
  facilities: readonly ClubFacility[],
  today: string,
): readonly InboxMessage[] {
  const messages: InboxMessage[] = [];
  const find = (role: StaffMember['role']): StaffMember | undefined =>
    staff.find((member) => member.role === role);

  // --- 1. El cuello de botella entre staff e instalaciones -----------------
  const bottleneck = worstLimited(staff, facilities);
  if (bottleneck) {
    const { member, effect } = bottleneck;
    const facility = facilitySpec(effect.facility);
    const percent = Math.round(effect.utilisation * 100);
    const peers = rolesSupportedBy(effect.facility).filter((role) => find(role) !== undefined).length;

    messages.push({
      id: 'staff-cuello-botella',
      author: member.role,
      authorName: member.name,
      subject: `${facility.name}: trabajo al ${percent}%`,
      body:
        `Te lo planteo con números, no como queja. Con ${facility.name} en el nivel que está, ` +
        `de todo lo que puedo aportar según mi nivel se aprovecha el ${percent}%. ` +
        `El resto se pierde ahí, no en mi trabajo. ` +
        (peers > 1
          ? `Y no soy el único: somos ${peers} trabajando con esa misma infraestructura. `
          : '') +
        `Si la mejoramos, mi rendimiento sube sin pagarme un peso más de salario. ` +
        `Si en cambio me subís de nivel a mí sin tocar la instalación, buena parte de esa mejora ` +
        `se va a perder igual.`,
      date: daysBefore(today, 2),
      unread: true,
      action: { label: 'Ver instalaciones', route: '/club/instalaciones' },
    });
  }

  // --- 2. Puestos sin cubrir ----------------------------------------------
  if (vacancies.length > 0) {
    const list = vacancies.map((vacancy) => vacancy.role);
    const cheapest = vacancies
      .flatMap((vacancy) =>
        vacancy.candidates.map((candidate) => ({
          role: vacancy.role,
          candidate,
          cost: staffSpec(vacancy.role).hireCost[candidate.level - 1] ?? 0,
        })),
      )
      .sort((a, b) => a.cost - b.cost)[0];

    messages.push({
      id: 'staff-vacantes',
      author: 'Presidencia',
      authorName: 'Comisión directiva',
      subject:
        list.length === 1
          ? `Sigue vacante el puesto de ${list[0]}`
          : `Tenemos ${list.length} puestos del cuerpo técnico sin cubrir`,
      body:
        `Nos quedan sin cubrir: ${list.join(', ')}. ` +
        `Mientras estén vacíos el club no recibe ese beneficio —tampoco te cargamos ninguna ` +
        `penalización por no tenerlos, simplemente no suman—. ` +
        (cheapest
          ? `Hay candidatos mirando el club: el más accesible es ${cheapest.candidate.name} ` +
            `para ${cheapest.role}, ${moneyShort(cheapest.cost)} de contratación. `
          : '') +
        `Decidilo vos, que conocés mejor dónde nos falta.`,
      date: daysBefore(today, 3),
      unread: true,
      action: { label: 'Ver staff', route: '/club/staff' },
    });
  }

  // --- 3. El preparador físico informa lo que está entregando -------------
  const fitness = find('Preparador físico');
  if (fitness) {
    const effect = staffEffect(
      fitness.role,
      fitness.level,
      levelOf(facilities, staffSpec(fitness.role).facility),
    );
    const actual = Math.round(effect.actual);
    messages.push({
      id: 'staff-recuperacion',
      author: 'Preparador físico',
      authorName: fitness.name,
      subject: `Recuperación del plantel: ${actual}% más rápida`,
      body:
        `Te paso el dato del semestre. Con el trabajo que podemos hacer hoy, el plantel recupera ` +
        `energía un ${actual}% más rápido entre partidos que sin preparación física. ` +
        (effect.limited
          ? `Con instalaciones a la altura de mi nivel ese número sería ${Math.round(effect.nominal)}%. `
          : 'Es todo lo que mi nivel permite dar, no queda nada sin aprovechar. ') +
        `Esto se aplica de verdad: cada partido que jugás, los descansos lo usan.`,
      date: daysBefore(today, 5),
      unread: false,
      action: { label: 'Ver staff', route: '/club/staff' },
    });
  }

  // --- 4. El informe del ojeador juvenil, con SU margen de error ----------
  // El ancho del rango sale del efecto real del rol: un ojeador mejor, o una
  // academia mejor, devuelven un rango más angosto. Si el puesto está
  // vacante este informe no existe, que es exactamente lo que corresponde.
  const youthScout = find('Ojeador juvenil');
  if (youthScout) {
    const effect = staffEffect(
      youthScout.role,
      youthScout.level,
      levelOf(facilities, staffSpec(youthScout.role).facility),
    );
    const spread = Math.round(effect.actual);
    const centre = 79;
    messages.push({
      id: 'staff-informe-juvenil',
      author: 'Ojeador juvenil',
      authorName: youthScout.name,
      subject: 'Volante zurdo de 16 años en el ascenso',
      body:
        `Lo vi tres veces. Interior zurdo, 16 años, tiene pausa y no es solo físico. ` +
        `Con lo que puedo medir hoy le estimo el potencial entre ${centre - spread} y ` +
        `${centre + spread}: un rango de ${spread * 2} puntos. ` +
        (effect.limited
          ? `Parte de ese ancho es la academia, no el chico: con mejores instalaciones te lo ` +
            `afino sin cambiar nada más. `
          : `Más angosto que esto no lo voy a poder dar sin subir yo de nivel. `) +
        `Con un rango así, firmarlo es una apuesta; conviene saberlo antes y no después.`,
      date: daysBefore(today, 6),
      unread: false,
      action: { label: 'Ver inferiores', route: '/club/inferiores' },
    });
  }

  return messages;
}
