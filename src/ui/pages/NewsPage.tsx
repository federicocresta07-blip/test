import { useMemo, type ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge, type BadgeTone } from '../components/ui/Badge.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { seasonNews, type NewsItem } from '../lib/news.ts';
import { seasonTable } from '../lib/season-bridge.ts';

/**
 * NOTICIAS (secciones 5.4, 13) — fase 7 del plan.
 *
 * Las novedades del torneo, derivadas de lo que pasó en la fecha. Ninguna
 * está escrita a mano: cada una se calcula de un hecho —una goleada, el
 * puntero, el goleador, una racha— y trae el dato que la sostiene.
 */

const KIND_LABEL: Record<NewsItem['kind'], { label: string; tone: BadgeTone }> = {
  resultado: { label: 'Resultado', tone: 'accent' },
  tabla: { label: 'Tabla', tone: 'info' },
  goleador: { label: 'Goleador', tone: 'ok' },
  racha: { label: 'Racha', tone: 'warn' },
};

export function NewsPage(): ReactNode {
  const state = useGameState();
  const table = useMemo(() => seasonTable(state.season.records), [state.season.records]);
  const news = useMemo(
    () => seasonNews(state.season.records, table, state.season.totals, state.club.id),
    [state.season.records, table, state.season.totals, state.club.id],
  );

  if (news.length === 0) {
    return (
      <div className="page page--narrow">
        <Panel title="Noticias">
          <EmptyState
            title="Todavía no pasó nada"
            detail="Las noticias salen de los partidos: goleadas, cambios de puntero, goleadores y rachas. Jugá la primera fecha y esto se empieza a escribir solo."
            action={
              <Link to="/competicion/calendario">
                <Button variant="primary">Ir al calendario</Button>
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <Panel
        title="Noticias del torneo"
        subtitle={`Fecha ${news[0]?.round ?? ''} · ${news.length} ${news.length === 1 ? 'novedad' : 'novedades'}`}
      >
        <div className="newslist">
          {news.map((item) => {
            const meta = KIND_LABEL[item.kind];
            return (
              <article className="newscard" key={item.id}>
                <header className="newscard__head">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <h3 className="newscard__headline">{item.headline}</h3>
                </header>
                <p className="newscard__body">{item.body}</p>
                {item.route && (
                  <Link to={item.route} className="newscard__link">
                    Ver más →
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="Cómo se escriben estas noticias">
        <div className="clubnotes">
          <p>
            Ninguna está cargada a mano. Cada una se deriva de un hecho del torneo y trae el número
            que la sostiene: la goleada dice qué probabilidad le daba el motor antes de empezar, la
            racha dice la posición y los goles, el goleador dice quién lo persigue. Por eso no puede
            pasar que una noticia diga que un equipo viene golpeado cuando ganó los últimos cuatro.
          </p>
        </div>
      </Panel>
    </div>
  );
}
