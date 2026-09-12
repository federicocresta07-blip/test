import type { ReactNode } from 'react';
import { facilitySpec, type FacilityLevel } from '../../../domain/facilities.ts';
import { staffEffect, staffHireCost, staffSalary, staffSpec } from '../../../domain/staff.ts';
import type { StaffCandidate, StaffVacancy } from '../../models/index.ts';
import { moneyShort } from '../../lib/format.ts';
import { Stars } from '../ui/Stars.tsx';
import { ConsumerNote, formatEffect } from './EffectReadout.tsx';
import { UpgradeCard } from './UpgradeCard.tsx';

/**
 * PUESTO VACANTE Y SUS CANDIDATOS (seccion 7).
 *
 * Lo importante acá es que cada candidato muestre el efecto que daría EN ESTE
 * CLUB, no el que daría en abstracto: un candidato de cuatro estrellas en una
 * instalación de dos rinde menos que su nivel, y eso tiene que verse antes de
 * firmar, no después.
 */
export function VacancyCard({
  vacancy,
  facilityLevel,
  cash,
  onHire,
  busy = false,
}: {
  readonly vacancy: StaffVacancy;
  readonly facilityLevel: FacilityLevel;
  readonly cash: number;
  readonly onHire: (candidate: StaffCandidate) => void;
  readonly busy?: boolean;
}): ReactNode {
  const spec = staffSpec(vacancy.role);
  const facility = facilitySpec(spec.facility);

  return (
    <article className="vacancy">
      <header className="vacancy__head">
        <div className="vacancy__who">
          <span className="vacancy__tag">Puesto vacante</span>
          <h3 className="vacancy__role">{vacancy.role}</h3>
          <p className="vacancy__effect">{spec.effect}</p>
        </div>
        <ConsumerNote consumer={spec.consumer} />
      </header>

      <p className="vacancy__context">
        Trabajaría en {facility.name} <Stars value={facilityLevel} size="sm" />. Mientras el puesto
        siga vacío el club no recibe este beneficio, y tampoco carga ninguna penalización oculta:
        simplemente no suma.
      </p>

      <div className="vacancy__candidates">
        {vacancy.candidates.map((candidate) => {
          const effect = staffEffect(vacancy.role, candidate.level, facilityLevel);
          const salary = staffSalary(vacancy.role, candidate.level);
          return (
            <div className="candidate" key={candidate.id}>
              <header className="candidate__head">
                <span className="candidate__name">{candidate.name}</span>
                <Stars value={candidate.level} size="sm" />
              </header>
              <p className="candidate__background">{candidate.background}</p>

              <UpgradeCard
                heading="Contratar"
                nextLevel={candidate.level}
                cost={staffHireCost(vacancy.role, candidate.level)}
                weeks={null}
                cash={cash}
                busy={busy}
                actionLabel="Firmar"
                onConfirm={() => onHire(candidate)}
                changes={[
                  {
                    label: 'Efecto en este club',
                    from: 'sin cubrir',
                    to: formatEffect(effect.actual, effect.unit, effect.direction),
                    hint: effect.limited
                      ? `${spec.effect}. Su nivel daría ${formatEffect(effect.nominal, effect.unit, effect.direction)}, pero ${facility.name} lo limita al ${Math.round(effect.utilisation * 100)}%`
                      : spec.effect,
                  },
                  {
                    label: 'Masa salarial',
                    from: 'sin salario',
                    to: `${moneyShort(salary)}/mes`,
                    tone: 'coste',
                  },
                ]}
                note={
                  effect.limited
                    ? `Ojo: ${facility.name} lo limitaría al ${Math.round(effect.utilisation * 100)}% desde el primer día.`
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </article>
  );
}
