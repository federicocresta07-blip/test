import type { ReactNode } from 'react';
import {
  facilitySpec,
  facilityUpgradeCost,
  facilityUpgradeWeeks,
  facilityUpkeep,
  MAX_FACILITY_LEVEL,
  type FacilityLevel,
} from '../../../domain/facilities.ts';
import { rolesSupportedBy, staffEffect, type StaffRole } from '../../../domain/staff.ts';
import type { ClubFacility, StaffMember } from '../../models/index.ts';
import { moneyShort } from '../../lib/format.ts';
import { Stars } from '../ui/Stars.tsx';
import { formatEffect } from './EffectReadout.tsx';
import { AtMaxLevel, UpgradeCard } from './UpgradeCard.tsx';

/**
 * FICHA DE UNA INSTALACION (seccion 8).
 *
 * La ficha del profesional explica la interacción desde su lado ("esta
 * instalación me limita al 73%"). Esta la explica desde el otro: a quiénes
 * respalda esta instalación, a cuántos está frenando y cuánto se destraba si
 * se invierte. Sin esta mitad, la decisión entre invertir en personas o en
 * infraestructura se toma a ciegas.
 */
export function FacilityCard({
  facility,
  staff,
  cash,
  onUpgrade,
  busy = false,
}: {
  readonly facility: ClubFacility;
  /** Cuerpo técnico completo; acá se filtra el que trabaja en esta instalación. */
  readonly staff: readonly StaffMember[];
  readonly cash: number;
  readonly onUpgrade: () => void;
  readonly busy?: boolean;
}): ReactNode {
  const spec = facilitySpec(facility.id);
  const supported = rolesSupportedBy(facility.id);
  const atMax = facility.level >= MAX_FACILITY_LEVEL;
  const nextLevel = atMax ? null : ((facility.level + 1) as FacilityLevel);
  const upgradeCost = facilityUpgradeCost(facility.id, facility.level);

  // Quién trabaja acá hoy, con el efecto que le sale y el que le saldría con
  // la instalación un nivel más arriba.
  const workers = supported
    .map((role) => staff.find((member) => member.role === role))
    .filter((member): member is StaffMember => member !== undefined)
    .map((member) => ({
      member,
      now: staffEffect(member.role, member.level, facility.level),
      after: nextLevel ? staffEffect(member.role, member.level, nextLevel) : null,
    }));

  const limited = workers.filter((entry) => entry.now.limited);
  const vacant = supported.filter((role) => !workers.some((entry) => entry.member.role === role));
  const upkeep = facilityUpkeep(facility.id, facility.level);

  const averageUtilisation =
    workers.length === 0
      ? 1
      : workers.reduce((total, entry) => total + entry.now.utilisation, 0) / workers.length;
  const averageAfter =
    workers.length === 0 || nextLevel === null
      ? averageUtilisation
      : workers.reduce((total, entry) => total + (entry.after?.utilisation ?? 0), 0) / workers.length;

  return (
    <article className={`facilitycard ${limited.length > 0 ? 'is-limiting' : ''}`}>
      <header className="facilitycard__head">
        <div className="facilitycard__who">
          <h3 className="facilitycard__name">{spec.name}</h3>
          <p className="facilitycard__desc">{spec.description}</p>
        </div>
        <div className="facilitycard__level">
          <Stars value={facility.level} />
          <span className="facilitycard__upkeep tnum">{moneyShort(upkeep)}/mes</span>
        </div>
      </header>

      {/* El estado del acople, en una línea que se lee de un vistazo. */}
      <p className={`facilitycard__verdict ${limited.length > 0 ? 'is-limiting' : 'is-clear'}`}>
        {workers.length === 0
          ? `Respalda ${supported.length === 1 ? 'un puesto' : `${supported.length} puestos`}, todos vacantes hoy.`
          : limited.length === 0
            ? `No limita a ninguno de sus ${workers.length === 1 ? 'profesional' : `${workers.length} profesionales`}.`
            : `Está limitando a ${limited.length} de ${workers.length}.`}
      </p>

      <ul className="facilitycard__workers">
        {workers.map(({ member, now, after }) => (
          <li key={member.role} className={now.limited ? 'is-limited' : ''}>
            <span className="facilitycard__workerrole truncate">
              {member.role} <Stars value={member.level} size="sm" />
            </span>
            <span className="facilitycard__workerstate tnum">
              {now.limited ? (
                <>
                  {Math.round(now.utilisation * 100)}%
                  {after && after.utilisation > now.utilisation && (
                    <span className="facilitycard__gain">
                      {' → '}
                      {Math.round(after.utilisation * 100)}%
                    </span>
                  )}
                </>
              ) : (
                'al 100%'
              )}
            </span>
          </li>
        ))}
        {vacant.map((role: StaffRole) => (
          <li key={role} className="is-vacant">
            <span className="facilitycard__workerrole truncate">{role}</span>
            <span className="facilitycard__workerstate">puesto vacante</span>
          </li>
        ))}
      </ul>

      {nextLevel === null || upgradeCost === null ? (
        <AtMaxLevel what={spec.name} />
      ) : (
        <UpgradeCard
          heading={`Obra hasta ${nextLevel} estrellas`}
          nextLevel={nextLevel}
          cost={upgradeCost}
          weeks={facilityUpgradeWeeks(facility.id, facility.level)}
          cash={cash}
          busy={busy}
          actionLabel="Encarar la obra"
          onConfirm={onUpgrade}
          changes={[
            {
              label: 'Aprovechamiento del staff',
              from: `${Math.round(averageUtilisation * 100)}%`,
              to: `${Math.round(averageAfter * 100)}%`,
              hint:
                workers.length === 0
                  ? 'No hay nadie trabajando acá todavía, así que la obra no destraba nada por ahora'
                  : 'Promedio de los profesionales que respalda esta instalación',
            },
            ...(limited.length > 0
              ? limited.slice(0, 2).map((entry) => ({
                  label: entry.member.role,
                  from: formatEffect(entry.now.actual, entry.now.unit, entry.now.direction),
                  to: formatEffect(
                    entry.after?.actual ?? entry.now.actual,
                    entry.now.unit,
                    entry.now.direction,
                  ),
                  hint: 'Su efecto real, sin cambiarle el nivel: solo dejando de limitarlo',
                }))
              : []),
            {
              label: 'Mantenimiento',
              from: `${moneyShort(upkeep)}/mes`,
              to: `${moneyShort(facilityUpkeep(facility.id, nextLevel))}/mes`,
              tone: 'coste' as const,
            },
          ]}
          note={
            workers.length > 0 && limited.length === 0
              ? 'Nadie está limitado hoy: la obra recién sirve si después subís de nivel a alguien de este grupo.'
              : undefined
          }
        />
      )}
    </article>
  );
}
