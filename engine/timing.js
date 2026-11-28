// Takımlı sahne zamanı: tek telefon arayüzü ve online sunucu aynı hesabı kullanır.
                                           

export const PREP_SEC = 15; // hazırlık (s.9)
export const PREP_UNTIMED_SEC = 60; // Dakikasız modda 1 dakikaya kadar (s.9)
export const GRACE_MS = 5000; // süre bitince 5 sn tolerans (s.9)

export const prepSeconds = (g          )         => (g.settings.timing === 'timed' ? PREP_SEC : PREP_UNTIMED_SEC);

/** Sahne zamanı: geçen süre ve (Süreli modda) kalan süre, ms. `durationMin` karttan gelir. */
export function sceneTimingFor(
  g          ,
  durationMin        ,
  now        ,
)                                                                  {
  const c = g.clock;
  const duration = durationMin * 60_000;
  if (c.startedAt === null) return { elapsed: 0, duration, remaining: g.settings.timing === 'timed' ? duration : null };
  const end = c.pausedAt ?? now;
  const elapsed = Math.max(0, end - c.startedAt - c.pausedTotal);
  return { elapsed, duration, remaining: g.settings.timing === 'timed' ? duration - elapsed : null };
}
