import type { ReactNode } from 'react';
import {
  MAX_STAFF_LEVEL,
  staffEffect,
  staffSalary,
  staffUpgradeCost,
  staffUpgradeWeeks,
  type StaffLevel,
} from '../../../domain/staff.ts';
import { facilitySpec, type FacilityLevel } from '../../../domain/facilities.ts';
import type { StaffMember } from '../../models/index.ts';
import { moneyShort } from '../../lib/format.ts';
import { Stars } from '../ui/Stars.tsx';
import { EffectReadout, formatEffect } from './EffectReadout.tsx';
import { AtMaxLevel, UpgradeCard } from './UpgradeCard.tsx';

/**
 * FICHA DE UN PROFESIONAL (seccion 7).
 *
 * Nombre, especialidad, nivel en estrellas, salario, antigüedad, efecto
 * actual y próximo efecto, más el coste de la mejora. Todo se calcula desde
 * el modelo de dominio: no hay un solo número escrito a mano acá.
 */
export function StaffCard({
  member,
  facilityLevel,
  cash,
  onUpgrade,
  busy = false,
}: {
  readonly member: StaffMember;
  readonly facilityLevel: FacilityLevel;
  readonly cash: number;
  readonly onUpgrade: () => void;
  readonly busy?: boolean;
}): ReactNode {
  const effect = staffEffect(member.role, member.level, facilityLevel);
  const atMax = member.level >= MAX_STAFF_LEVEL;
  const upgradeCost = staffUpgradeCost(member.role, member.level);
  const nextLevel = atMax ? null : ((member.level + 1) as StaffLevel);
  const salary = staffSalary(member.role, member.level);
  const facility = facilitySpec(effect.facility);

  return (
    <article className={`staffcard ${effect.limited ? 'is-limited' : ''}`}>
      <header className="staffcard__head">
        <div className="staffcard__who">
          <span className="staffcard__role">{member.role}</span>
          <span className="staffcard__name">{member.name}</span>
        </div>
        <div className="staffcard__level">
          <Stars value={member.level} />
          <span className="staffcard__years">
            {member.yearsAtClub === 0
              ? 'recién llegado'
              : `${member.yearsAtClub} ${member.yearsAtClub === 1 ? 'año' : 'años'} en el club`}
          </span>
        </div>
      </header>

      <EffectReadout effect={effect} />

      {/* La interacción con las instalaciones, explicada desde este lado. */}
      <div className={`staffcard__facility ${effect.limited ? 'is-limited' : ''}`}>
        <span className="staffcard__facilityname">
          Trabaja en {facility.name} <Stars value={effect.facilityLevel} size="sm" />
        </span>
        <span className="staffcard__util">
          {effect.limited
            ? `lo limita al ${Math.round(effect.utilisation * 100)}%`
            : 'no lo limita'}
        </span>
      </div>

      <div className="staffcard__salary">
        <span className="label">Salario</span>
        <span className="tnum">{moneyShort(salary)}/mes</span>
      </div>

      {nextLevel === null || upgradeCost === null ? (
        <AtMaxLevel what={member.name} />
      ) : (
        <UpgradeCard
          heading={`Mejorar a ${nextLevel} estrellas`}
          nextLevel={nextLevel}
          cost={upgradeCost}
          weeks={staffUpgradeWeeks(member.role, member.level)}
          cash={cash}
          busy={busy}
          onConfirm={onUpgrade}
          changes={[
            {
              label: 'Efecto real',
              from: formatEffect(effect.actual, effect.unit, effect.direction),
              to: formatEffect(effect.nextActual ?? effect.actual, effect.unit, effect.direction),
              hint: effect.limited
                ? 'Ya descontado el límite que le imponen las instalaciones actuales'
                : undefined,
            },
            {
              label: 'Salario',
              from: `${moneyShort(salary)}/mes`,
              to: `${moneyShort(staffSalary(member.role, nextLevel))}/mes`,
              tone: 'coste',
            },
          ]}
          note={
            effect.limited
              ? `Con ${facility.name} en su nivel actual, parte de la mejora no se va a poder aprovechar.`
              : undefined
          }
        />
      )}
    </article>
  );
}
