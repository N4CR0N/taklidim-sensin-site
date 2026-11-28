// Hızlı Rol (Reels) durum makinesi (s.16-17, s.34). 1v1, çarksız, 5 senaryo x 2 rol = 10 rol.
                                                                      
import { shuffle } from './rng.js';
import { QUICK_SCENARIOS, quickTotals } from './rules.js';

                             
                          
                     
                            
                          
                     
 

export const VOTE_WINDOW_MS = 5000; // 5 saniye kuralı (s.16)
export const AUTO_SCORE = 10; // basılmazsa oy otomatik 10 (s.16)
export const PREP_SEC = 10; // hazırlık 10 sn (s.16)

export function validateQuick(s            )                {
  const [a, b] = s.names.map((n) => n.trim());
  if (!a || !b) return 'İki oyuncunun da adını yaz.';
  if (a.toLocaleLowerCase('tr') === b.toLocaleLowerCase('tr')) return 'İki ad farklı olmalı.';
  return null;
}

export function createQuickGame(s            , cards             , seed        )            {
  const [deck, rng] = shuffle(cards.filter((c) => c.relation === s.relation).map((c) => c.id), seed);
  const g            = {
    mode: 'quick',
    version: 1,
    rng,
    relation: s.relation,
    imitation: s.imitation,
    durationSec: s.durationSec,
    players: [
      { name: s.names[0].trim(), autoTenStreak: 0, autoTenTotal: 0 },
      { name: s.names[1].trim(), autoTenStreak: 0, autoTenTotal: 0 },
    ],
    parentIndex: s.parentIndex,
    scenarios: [],
    deck,
    phase: 'card',
    voteCursor: 0,
    voteOpenedAt: null,
    clock: { startedAt: null },
    remind: false,
  };
  return addScenario(g, false);
}

/** roleA'yı kim oynar: Ebeveyn-Evlat'ta rol takası, gerçek ebeveyn Evlat (roleA) rolünü oynar. */
function roleAPlayerFor(g           , k        )        {
  if (g.relation === 'ebeveyn') return g.parentIndex;
  return (k % 2)         ;
}

function addScenario(g           , golden         )            {
  let deck = g.deck;
  let rng = g.rng;
  if (!deck.length) {
    const used = Array.from(new Set(g.scenarios.map((s) => s.cardId)));
    const [d, ns] = shuffle(used, rng);
    deck = d;
    rng = ns;
  }
  const [cardId, ...rest] = deck;
  const k = g.scenarios.length;
  return {
    ...g,
    rng,
    deck: rest,
    scenarios: [...g.scenarios, { cardId, roleAPlayer: roleAPlayerFor(g, k), received: [null, null], auto: [false, false], golden }],
    phase: 'card',
    voteCursor: 0,
    voteOpenedAt: null,
    clock: { startedAt: null },
  };
}

/** Oy sırası: önce 2. oyuncu, sonra 1. oyuncu (s.17: "Önce Can oy verir ... sonra telefon Ayşe'ye geçer"). */
export const VOTE_ORDER         = [1, 0];

export function currentVoter(g           )        {
  return VOTE_ORDER[g.voteCursor] ?? 0;
}

                         
                     
                                       
                        
                                     
                                                       
                    
                            

export function quickReduce(g           , a             )            {
  switch (a.type) {
    case 'ready':
      if (g.phase !== 'card') return g;
      return { ...g, phase: 'prep' };
    case 'startScene':
      if (g.phase !== 'prep') return g;
      return { ...g, phase: 'scene', clock: { startedAt: a.now } };
    case 'cancelScene': {
      // Kırmızı Kart / "Rahatsız oldum": sahne iptal, ceza yok, yeni kart (s.16).
      if (g.phase !== 'scene' && g.phase !== 'prep' && g.phase !== 'card') return g;
      const last = g.scenarios[g.scenarios.length - 1];
      return addScenario({ ...g, scenarios: g.scenarios.slice(0, -1) }, last.golden);
    }
    case 'sceneEnd':
      if (g.phase !== 'scene') return g;
      return { ...g, phase: 'voteGate', voteCursor: 0 };
    case 'openVote':
      if (g.phase !== 'voteGate') return g;
      return { ...g, phase: 'voteInput', voteOpenedAt: a.now };
    case 'vote': {
      if (g.phase !== 'voteInput' || g.voteOpenedAt === null) return g;
      const voter = currentVoter(g);
      const target = (1 - voter)         ;
      const late = a.now - g.voteOpenedAt > VOTE_WINDOW_MS;
      const valid = a.score !== null && a.score >= 1 && a.score <= 10 && !late;
      const score = valid ? Math.round(a.score          ) : AUTO_SCORE;
      const auto = !valid;
      const sc = g.scenarios[g.scenarios.length - 1];
      const received = sc.received.slice()                                  ;
      const autos = sc.auto.slice()                      ;
      received[target] = score;
      autos[target] = auto;
      const players = g.players.map((p, i) =>
        i === voter
          ? { ...p, autoTenStreak: auto ? p.autoTenStreak + 1 : 0, autoTenTotal: p.autoTenTotal + (auto ? 1 : 0) }
          : p,
      )                        ;
      // Aynı oyuncu üst üste 3 kez otomatik 10 gönderirse "hızlı karar ver" hatırlatması (s.17).
      const remind = players[voter].autoTenStreak >= 3;
      const scenarios = [...g.scenarios.slice(0, -1), { ...sc, received, auto: autos }];
      const cursor = g.voteCursor + 1;
      if (cursor < VOTE_ORDER.length) return { ...g, players, scenarios, remind, voteCursor: cursor, voteOpenedAt: null, phase: 'voteGate' };
      return { ...g, players, scenarios, remind, voteCursor: cursor, voteOpenedAt: null, phase: 'roundResult' };
    }
    case 'next': {
      if (g.phase !== 'roundResult') return g;
      const regular = g.scenarios.filter((s) => !s.golden).length;
      if (regular < QUICK_SCENARIOS) return addScenario({ ...g, remind: false }, false);
      // 10 rol bitti. Eşitlikte Altın Sahne (s.16).
      const [a0, a1] = quickTotals(g);
      const last = g.scenarios[g.scenarios.length - 1];
      const goldenDecided = last.golden && last.received[0] !== last.received[1];
      if (a0 === a1 && !goldenDecided) return addScenario({ ...g, remind: false }, true);
      return { ...g, remind: false, phase: 'final' };
    }
    default:
      return g;
  }
}
