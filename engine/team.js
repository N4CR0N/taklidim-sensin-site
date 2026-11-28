// Takımlı oyunun durum makinesi (s.9, s.36). Saf: (oyun, eylem) -> yeni oyun.
// Zaman gerektiren eylemler `now` (ms) taşır; sayaçları arayüz yürütür.
                                                                                                                        
import { roll, shuffle } from './rng.js';
import {
  imitationTokensFor,
  levelFor,
  seatOrder,
  standings,
  tiedLeaders,
  turnsPerPlayer,
  votersFor,
} from './rules.js';

                            
                                               
                         
 

export const TEAM_LETTERS = ['A', 'B', 'C', 'D'];

export function validateSetup(setup           )                {
  if (setup.teams.length < 2) return 'En az 2 takım gerekir.';
  if (setup.teams.length > 4) return 'En fazla 4 takım olabilir.';
  for (const t of setup.teams) {
    const names = t.players.map((n) => n.trim()).filter(Boolean);
    if (names.length < 2) return `${t.name}: her takımda en az 2 oyuncu olmalı (Okuyucu takım arkadaşıdır).`;
  }
  const all = setup.teams.flatMap((t) => t.players.map((n) => n.trim()).filter(Boolean));
  if (all.length > 12) return 'En fazla 12 oyuncu.';
  if (new Set(all.map((n) => n.toLocaleLowerCase('tr'))).size !== all.length) return 'İki oyuncunun adı aynı olamaz.';
  return null;
}

export function createTeamGame(setup           , cards               , seed        )           {
  const teams         = setup.teams.map((t, i) => ({ id: `t${i}`, name: t.name.trim() || `Takım ${TEAM_LETTERS[i]}`, letter: TEAM_LETTERS[i] }));
  const members                           = {};
  const names                         = {};
  const teamIdOf                         = {};
  setup.teams.forEach((t, i) => {
    const ids           = [];
    t.players.map((n) => n.trim()).filter(Boolean).forEach((n, j) => {
      const id = `p${i}_${j}`;
      ids.push(id);
      names[id] = n;
      teamIdOf[id] = `t${i}`;
    });
    members[`t${i}`] = ids;
  });
  const perPlayer = turnsPerPlayer(setup.settings.length, setup.settings.freeTurns);
  const tokens = imitationTokensFor(perPlayer);
  const order = seatOrder(teams, members);
  const players           = order.map((id, seat) => ({
    id,
    name: names[id],
    teamId: teamIdOf[id],
    seat,
    imitationTokens: tokens,
    vetoLeft: 1,
    roleChangeLeft: 1,
    usedImitationTargets: [],
  }));
  let s = seed;
  const decks = {}                           ;
  const pool = {}                           ;
  for (const lv of ['basit', 'orta', 'hayal']           ) {
    pool[lv] = cards.filter((c) => c.level === lv).map((c) => c.id);
    const [d, ns] = shuffle(pool[lv], s);
    decks[lv] = d;
    s = ns;
  }
  return {
    mode: 'team',
    version: 1,
    rng: s,
    settings: { ...setup.settings },
    teams,
    players,
    turnsPerPlayer: perPlayer,
    starter: { spins: {}, contenders: players.map((p) => p.id), starterId: null, last: null },
    starterSeat: 0,
    turnIndex: 0,
    turns: [],
    current: null,
    role: { wheel: null, pickBy: null, roleNumber: null },
    clock: { startedAt: null, pausedAt: null, pausedTotal: 0, twistShown: false },
    voteCursor: 0,
    sequentialNext: {},
    readerNext: {},
    decks,
    pool,
    phase: 'starter',
    paused: false,
    golden: null,
    endedEarly: false,
  };
}

                        
                                             
                        
                        
                    
                                             
                                   
                             
                          
                           
                          
                                                     
                          
                                       
                                  
                                   
                          
                                                  
                        
                                                        
                           
                                            
                        
                                                 
                        

export const totalTurns = (g          )         => g.players.length * g.turnsPerPlayer;

export function player(g          , id        )         {
  const p = g.players.find((x) => x.id === id);
  if (!p) throw new Error(`oyuncu yok: ${id}`);
  return p;
}

/** Sıradaki Ana Oyuncu: Altın Tur kuyruğu varsa oradan, yoksa başlayandan saat yönünde. */
export function nextActorId(g          )         {
  if (g.golden && g.golden.queue.length) return g.golden.queue[0];
  const n = g.players.length;
  return g.players[(g.starterSeat + g.turnIndex) % n].id;
}

function rivalsOf(g          , actorId        )           {
  return votersFor(g.players, actorId);
}

function updatePlayer(g          , id        , f                       )           {
  return g.players.map((p) => (p.id === id ? f(p) : p));
}

function drawFrom(g          , level       )                                  {
  let deck = g.decks[level];
  let rng = g.rng;
  if (!deck.length) {
    // Deste biterse yeniden karılır (s.38).
    const [d, ns] = shuffle(g.pool[level], rng);
    deck = d;
    rng = ns;
  }
  const [cardId, ...rest] = deck;
  return { g: { ...g, rng, decks: { ...g.decks, [level]: rest } }, cardId };
}

/** Sıradaki turun Ana Oyuncusu, Okuyucusu ve seviyesi (Sıra ekranında da gösterilir). */
export function upcoming(g          )                                                                                          {
  const actorId = nextActorId(g);
  const actor = player(g, actorId);
  const mates = g.players.filter((p) => p.teamId === actor.teamId && p.id !== actorId);
  const readerIdx = g.readerNext[actor.teamId] ?? 0;
  const reader = mates[readerIdx % mates.length];
  const golden = !!(g.golden && g.golden.queue.length);
  const playerRound = Math.floor(g.turnIndex / g.players.length);
  const level        = golden ? 'orta' : levelFor(g.settings.levelMode, g.turnsPerPlayer, playerRound);
  return { actorId, readerId: reader ? reader.id : actorId, level, golden, readerIdx };
}

function newTurn(g          )           {
  const { actorId, readerId, level, golden, readerIdx: rIdx } = upcoming(g);
  const actor = player(g, actorId);
  const d = drawFrom(g, level);
  const turn       = {
    index: g.turnIndex,
    actorId,
    readerId,
    level,
    cardId: d.cardId,
    roleNumber: 0,
    imitationTargetId: null,
    confirmation: null,
    votes: [],
    voterIds: [],
    endedBy: null,
    voided: false,
    golden,
    goldenRound: golden && g.golden ? g.golden.round : 0,
  };
  return {
    ...d.g,
    readerNext: { ...g.readerNext, [actor.teamId]: rIdx + 1 },
    current: turn,
    role: { wheel: null, pickBy: null, roleNumber: null },
    clock: { startedAt: null, pausedAt: null, pausedTotal: 0, twistShown: false },
    voteCursor: 0,
    phase: 'cardRead',
  };
}

function startRoleStep(g          )           {
  const cur = g.current ;
  if (g.settings.roleSelect === 'sequential') {
    const k = g.sequentialNext[cur.actorId] ?? 0;
    return {
      ...g,
      sequentialNext: { ...g.sequentialNext, [cur.actorId]: k + 1 },
      role: { wheel: null, pickBy: null, roleNumber: (k % 6) + 1 },
      phase: 'role',
    };
  }
  if (g.settings.roleSelect === 'self') return { ...g, role: { wheel: null, pickBy: 'actor', roleNumber: null }, phase: 'role' };
  if (g.settings.roleSelect === 'rival') return { ...g, role: { wheel: null, pickBy: 'rivals', roleNumber: null }, phase: 'role' };
  return { ...g, role: { wheel: null, pickBy: null, roleNumber: null }, phase: 'role' };
}

function spinWheel(g          )           {
  const [n, rng] = roll(g.rng, 8);
  if (n === 7) return { ...g, rng, role: { wheel: 7, pickBy: 'actor', roleNumber: null } };
  if (n === 8) return { ...g, rng, role: { wheel: 8, pickBy: 'rivals', roleNumber: null } };
  return { ...g, rng, role: { wheel: n, pickBy: null, roleNumber: n } };
}

/** İptal (Kırmızı Kart / turu iptal): tur sayılmaz, aynı oyuncu yeni kartla tekrar oynar (s.23, s.37). */
function voidCurrent(g          , by         )           {
  const cur = g.current ;
  let players = g.players;
  // Jeton secretDone'da harcanır; yalnız harcandıysa (hazırlık / sahne) iade edilir.
  const spent = g.phase === 'prep' || g.phase === 'scene';
  if (cur.imitationTargetId && spent) {
    const target = cur.imitationTargetId;
    players = updatePlayer(g, cur.actorId, (p) => ({
      ...p,
      imitationTokens: p.imitationTokens + 1,
      usedImitationTargets: p.usedImitationTargets.filter((x) => x !== target),
    }));
  }
  const voided       = { ...cur, endedBy: by, voided: true };
  return { ...g, players, turns: [...g.turns, voided], current: null, paused: false, phase: 'turnIntro' };
}

function finishTurn(g          )           {
  const cur = g.current ;
  let golden = g.golden;
  let turnIndex = g.turnIndex;
  if (cur.golden && golden) golden = { ...golden, queue: golden.queue.slice(1) };
  else turnIndex += 1;
  return { ...g, golden, turnIndex, turns: [...g.turns, cur], phase: 'turnResult' };
}

function decideEnd(g          )           {
  const rows = standings(g);
  const tied = tiedLeaders(rows);
  if (tied.length > 1) {
    const round = g.golden ? g.golden.round + 1 : 1;
    return { ...g, golden: { teamIds: tied, queue: [], round }, current: null, phase: 'goldenPick' };
  }
  return { ...g, current: null, phase: 'final' };
}

export function teamReduce(g          , a            )           {
  switch (a.type) {
    case 'starterSpin': {
      if (g.phase !== 'starter' || !g.starter.contenders.includes(a.playerId) || g.starter.spins[a.playerId]) return g;
      const [n, rng] = roll(g.rng, 8);
      const spins = { ...g.starter.spins, [a.playerId]: n };
      const last = { playerId: a.playerId, value: n };
      const done = g.starter.contenders.every((id) => spins[id]);
      if (!done) return { ...g, rng, starter: { ...g.starter, spins, last } };
      const max = Math.max(...g.starter.contenders.map((id) => spins[id]));
      const top = g.starter.contenders.filter((id) => spins[id] === max);
      if (top.length > 1) {
        // Eşitlikte yalnızca eşit sayıyı çevirenler tekrar çevirir (s.7).
        const keep                         = {};
        for (const id of Object.keys(spins)) if (!top.includes(id)) keep[id] = spins[id];
        return { ...g, rng, starter: { spins: keep, contenders: top, starterId: null, last } };
      }
      return {
        ...g,
        rng,
        starter: { ...g.starter, spins, starterId: top[0], last },
        starterSeat: player(g, top[0]).seat,
      };
    }
    case 'drawCard':
      if (g.phase === 'starter') return g.starter.starterId ? { ...g, phase: 'turnIntro' } : g;
      if (g.phase !== 'turnIntro') return g;
      return newTurn(g);
    case 'cardDone':
      if (g.phase !== 'cardRead') return g;
      return startRoleStep(g);
    case 'spin':
      if (g.phase !== 'role' || g.role.wheel !== null) return g;
      if (g.settings.roleSelect !== 'wheel' && g.settings.roleSelect !== 'rival') return g;
      return spinWheel(g);
    case 'rivalsToWheel':
      // Rakip seçer: 30 sn'de anlaşamazlarsa çark (s.7).
      if (g.phase !== 'role' || g.settings.roleSelect !== 'rival' || g.role.roleNumber !== null) return g;
      return spinWheel(g);
    case 'veto': {
      if (g.phase !== 'role' || g.settings.roleSelect !== 'wheel' || g.role.wheel === null) return g;
      const cur = g.current ;
      const actor = player(g, cur.actorId);
      if (actor.vetoLeft < 1) return g;
      const players = updatePlayer(g, actor.id, (p) => ({ ...p, vetoLeft: p.vetoLeft - 1 }));
      if (a.what === 'respin') return { ...g, players, role: { wheel: null, pickBy: null, roleNumber: null } };
      const d = drawFrom({ ...g, players }, cur.level);
      return { ...d.g, current: { ...cur, cardId: d.cardId }, role: { wheel: null, pickBy: null, roleNumber: null }, phase: 'cardRead' };
    }
    case 'pickRole':
      if (g.phase !== 'role' || g.role.pickBy === null || a.n < 1 || a.n > 6) return g;
      return { ...g, role: { ...g.role, roleNumber: a.n } };
    case 'roleChange': {
      // Çark dışındaki seçeneklerde Veto yerine oyun başına 1 "Rol değiştir" (s.7).
      if (g.phase !== 'role' || g.settings.roleSelect === 'wheel' || g.role.roleNumber === null) return g;
      const cur = g.current ;
      const actor = player(g, cur.actorId);
      if (actor.roleChangeLeft < 1) return g;
      const players = updatePlayer(g, actor.id, (p) => ({ ...p, roleChangeLeft: p.roleChangeLeft - 1 }));
      if (g.settings.roleSelect === 'sequential') {
        const k = g.sequentialNext[cur.actorId] ?? 0;
        return { ...g, players, sequentialNext: { ...g.sequentialNext, [cur.actorId]: k + 1 }, role: { ...g.role, roleNumber: (k % 6) + 1 } };
      }
      if (g.settings.roleSelect === 'rival') return { ...g, players, role: { wheel: null, pickBy: 'rivals', roleNumber: null } };
      return { ...g, players, role: { ...g.role, roleNumber: null } };
    }
    case 'roleConfirm':
      if (g.phase !== 'role' || g.role.roleNumber === null) return g;
      return { ...g, current: { ...g.current , roleNumber: g.role.roleNumber }, phase: 'secretGate' };
    case 'openSecret':
      if (g.phase !== 'secretGate') return g;
      return { ...g, phase: 'secret' };
    case 'setImitation': {
      if (g.phase !== 'secret') return g;
      const cur = g.current ;
      const actor = player(g, cur.actorId);
      if (a.targetId !== null) {
        if (cur.golden) return g; // Altın Turda taklit yok (sade tutuldu)
        if (actor.imitationTokens < 1) return g;
        if (a.targetId === actor.id || actor.usedImitationTargets.includes(a.targetId)) return g;
        if (!g.players.some((p) => p.id === a.targetId)) return g;
      }
      return { ...g, current: { ...cur, imitationTargetId: a.targetId } };
    }
    case 'secretDone': {
      if (g.phase !== 'secret') return g;
      const cur = g.current ;
      let players = g.players;
      if (cur.imitationTargetId) {
        const target = cur.imitationTargetId;
        players = updatePlayer(g, cur.actorId, (p) => ({
          ...p,
          imitationTokens: p.imitationTokens - 1,
          usedImitationTargets: [...p.usedImitationTargets, target],
        }));
      }
      return { ...g, players, phase: 'prep' };
    }
    case 'startScene':
      if (g.phase !== 'prep') return g;
      return { ...g, phase: 'scene', clock: { startedAt: a.now, pausedAt: null, pausedTotal: 0, twistShown: false } };
    case 'pause':
      if (g.paused) return g;
      if (g.phase === 'scene' && g.clock.pausedAt === null) return { ...g, paused: true, clock: { ...g.clock, pausedAt: a.now } };
      return { ...g, paused: true };
    case 'resume':
      if (!g.paused) return g;
      if (g.phase === 'scene' && g.clock.pausedAt !== null) {
        return { ...g, paused: false, clock: { ...g.clock, pausedAt: null, pausedTotal: g.clock.pausedTotal + (a.now - g.clock.pausedAt) } };
      }
      return { ...g, paused: false };
    case 'twistShown':
      if (g.phase !== 'scene') return g;
      return { ...g, clock: { ...g.clock, twistShown: true } };
    case 'endScene': {
      if (!g.current) return g;
      if (a.by === 'red' || a.by === 'cancel') {
        if (!['cardRead', 'role', 'secretGate', 'secret', 'prep', 'scene'].includes(g.phase)) return g;
        return voidCurrent(g, a.by);
      }
      if (g.phase !== 'scene') return g;
      const voterIds = rivalsOf(g, g.current.actorId);
      return { ...g, paused: false, current: { ...g.current, endedBy: a.by, voterIds }, voteCursor: 0, phase: 'voteGate' };
    }
    case 'openVote':
      if (g.phase !== 'voteGate') return g;
      return { ...g, phase: 'voteInput' };
    case 'submitVote': {
      if (g.phase !== 'voteInput') return g;
      const score = Math.round(a.score);
      if (score < 1 || score > 10) return g;
      const cur = g.current ;
      const voterId = cur.voterIds[g.voteCursor];
      const guessOk = a.guess === 'none' || g.players.some((p) => p.id === a.guess && p.id !== cur.actorId);
      const votes = [...cur.votes, { voterId, score, guess: guessOk ? a.guess : 'none' }];
      const next = { ...g, current: { ...cur, votes }, voteCursor: g.voteCursor + 1 };
      if (next.voteCursor < cur.voterIds.length) return { ...next, phase: 'voteGate' };
      if (cur.imitationTargetId) return { ...next, phase: 'confirmGate' };
      return finishTurn(next);
    }
    case 'openConfirm':
      if (g.phase !== 'confirmGate') return g;
      return { ...g, phase: 'confirmInput' };
    case 'confirm': {
      if (g.phase !== 'confirmInput') return g;
      const cur = g.current ;
      let players = g.players;
      if (a.value === 'uncomfortable' && cur.imitationTargetId) {
        // "Rahatsız": taklit iptal, jeton iade, tur normal puanlanır (s.13).
        const target = cur.imitationTargetId;
        players = updatePlayer(g, cur.actorId, (p) => ({
          ...p,
          imitationTokens: p.imitationTokens + 1,
          usedImitationTargets: p.usedImitationTargets.filter((x) => x !== target),
        }));
      }
      return finishTurn({ ...g, players, current: { ...cur, confirmation: a.value } });
    }
    case 'nextTurn': {
      if (g.phase !== 'turnResult') return g;
      const base = { ...g, current: null };
      if (g.golden) {
        if (g.golden.queue.length) return { ...base, phase: 'turnIntro' };
        return decideEnd(base);
      }
      if (g.turnIndex >= totalTurns(g)) return decideEnd(base);
      return { ...base, phase: 'turnIntro' };
    }
    case 'goldenSelect': {
      if (g.phase !== 'goldenPick' || !g.golden) return g;
      const ids = a.playerIds;
      const teams = ids.map((id) => player(g, id).teamId);
      if (ids.length !== g.golden.teamIds.length || !g.golden.teamIds.every((t) => teams.includes(t))) return g;
      return { ...g, golden: { ...g.golden, queue: ids }, phase: 'turnIntro' };
    }
    case 'endGame':
      return { ...g, current: null, paused: false, endedEarly: true, golden: null, phase: 'final' };
    default:
      return g;
  }
}
