// Online oda çekirdeği (dosya s.39 "Çok Cihazlı Mod v2"). Sunucuda çalışır, taşımadan bağımsızdır:
// Cloudflare Durable Object da yerel test de aynı fonksiyonları çağırır.
// Kurallar kural motorundan gelir (engine/); burada yalnız oda, izinler, eşzamanlı oy ve gizli bilgi süzgeci var.
// Gizli oylar ve taklit hedefi yalnız sunucuda durur; her telefona `viewFor` ile kendi görmesi gereken gider.
                                                                                                       
import { createTeamGame, player, teamReduce, validateSetup } from '../engine/team.js';
                                                    
import { createQuickGame, quickReduce, validateQuick, PREP_SEC as QUICK_PREP_SEC, VOTE_ORDER, VOTE_WINDOW_MS } from '../engine/quickrole.js';
                                                          
import { prepSeconds, sceneTimingFor, GRACE_MS } from '../engine/timing.js';
import { CLASSIC } from '../data/classic.js';
import { QUICK } from '../data/quick.js';

/** İstemci ile sunucunun konuştuğu dil. Değişirse eski APK "güncelle" ekranı görür. */
export const PROTO = 1;
export const MAX_MEMBERS = 12;
export const NAME_MAX = 16;
export const TEAM_NAME_MAX = 18;
/** Hızlı Rol oyunda ağ gecikmesi payı (5 sn penceresinin üstüne). */
export const VOTE_GRACE_MS = 800;
/** Bu kadar süre kimse dokunmazsa oda silinir. */
export const ROOM_TTL_MS = 12 * 3600_000;
export const CODE_CHARS = 'ABCDEFGHJKLMNPRSTUVYZ';
export const CODE_LEN = 4;

const DURATION_BY_CARD                         = Object.fromEntries(CLASSIC.map((c) => [c.id, c.durationMin]));
const TWIST_BY_CARD                          = Object.fromEntries(CLASSIC.map((c) => [c.id, !!c.twist]));

                         
             
                                                          
               
                                                
                                                                
 

                             
                          
                     
                            
                     
 

                        
                         
                      
                     
                    
 

                       
               
                
                    
                    
                 
                    
                     
               
                    
                                                                              
                                
                                  
                                                                                    
                                                            
                                                                                              
                                                     
                                                        
                                                                      
                                         
 

                       
                                                                
                                                                                                                                                                              
                                 
                             
                  
                    
                    
                  
                                                                      
                                                            
                                              
                  

                             
             
               
               
                  
 

                           
             
               
                
                    
              
               
                                                                              
                 
                        
               
                    
                                
                  
                                                                       
                              
                                       
                                                                                              
                            
 

// ---------- oda ----------

export function randomCode(rand               = Math.random)         {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return s;
}

export const validCode = (code        )          => new RegExp(`^[${CODE_CHARS}]{${CODE_LEN}}$`).test(code);

export function createRoom(code        , now        )       {
  return {
    code,
    proto: PROTO,
    createdAt: now,
    touchedAt: now,
    hostId: '',
    members: [],
    nextMember: 1,
    lobby: {
      mode: 'team',
      teamNames: ['Takım A', 'Takım B'],
      team: { roleSelect: 'wheel', levelMode: 'ladder', length: 'fast', freeTurns: 3, timing: 'timed' },
      quick: { relation: 'arkadas', imitation: true, durationSec: 30, parentIndex: 0 },
    },
    game: null,
    seats: {},
    rev: 0,
    grev: 0,
    phaseAt: now,
    votes: {},
    qvotes: {},
    voteOpenedAt: null,
    spin: { seq: 0, value: 0 },
    lastAt: now,
  };
}

const cleanName = (s         , max = NAME_MAX)         =>
  String(s ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const sameName = (a        , b        )          => a.toLocaleLowerCase('tr') === b.toLocaleLowerCase('tr');

export function newToken(rand               = Math.random)         {
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(rand() * 16).toString(16);
  return s;
}

const memberById = (r      , id        )                     => r.members.find((m) => m.id === id);

/** Ev sahibi ya da ev sahibi çevrimdışıyken herkes: oyunu takılmaktan kurtarır. */
export function privileged(r      , memberId        )          {
  if (r.hostId === memberId) return true;
  const host = memberById(r, r.hostId);
  return !host || !host.online;
}

/** Üyenin oyundaki kimliği. */
export function pidOf(r      , memberId        )                {
  for (const [pid, mid] of Object.entries(r.seats)) if (mid === memberId) return pid;
  return null;
}

function touch(r      , now        )       {
  r.rev += 1;
  r.touchedAt = now;
}

                                                                                                                    

/**
 * Odaya giriş. Jetonu tanıyan üye kendi yerine döner. Yoksa adla girer: lobide yeni üye olur;
 * oyun başladıysa yalnız çevrimdışı bir oyuncunun yerini (aynı adla) alabilir.
 */
export function join(r      , msg                                                  , now        , rand               = Math.random)             {
  if (msg.proto !== PROTO) return { ok: false, error: 'Uygulama sürümün bu odayla uyuşmuyor. Uygulamayı güncelle.', code: 'proto' };
  if (msg.token) {
    const m = r.members.find((x) => x.token === msg.token);
    if (m) {
      touch(r, now);
      return { ok: true, member: m, fresh: false };
    }
  }
  const name = cleanName(msg.name);
  if (!name) return { ok: false, error: 'Adını yaz.', code: 'name' };
  const same = r.members.find((x) => sameName(x.name, name));
  if (same) {
    if (same.online) return { ok: false, error: `“${same.name}” adı bu odada kullanılıyor. Başka bir ad yaz.`, code: 'taken' };
    // Telefonu değişen / uygulamayı silen oyuncu kendi yerine döner.
    same.token = newToken(rand);
    touch(r, now);
    return { ok: true, member: same, fresh: true };
  }
  if (r.game) {
    const off = r.members.filter((m) => !m.online && pidOf(r, m.id)).map((m) => m.name);
    return {
      ok: false,
      error: off.length
        ? `Oyun başladı. Yalnız bağlantısı kopan bir oyuncunun yerine girebilirsin: ${off.join(', ')}.`
        : 'Oyun başladı; yeni oyuncu bir sonraki oyunda katılabilir.',
      code: 'started',
    };
  }
  if (r.members.length >= MAX_MEMBERS) return { ok: false, error: `Oda dolu (en fazla ${MAX_MEMBERS} kişi).`, code: 'full' };
  // Yeni üye en az kişili takıma girer.
  const counts = r.lobby.teamNames.map((_, i) => r.members.filter((m) => m.team === i).length);
  const team = counts.indexOf(Math.min(...counts));
  const m         = { id: `m${r.nextMember++}`, token: newToken(rand), name, team: Math.max(0, team), online: true };
  r.members.push(m);
  if (!r.hostId || !memberById(r, r.hostId)) r.hostId = m.id;
  touch(r, now);
  return { ok: true, member: m, fresh: true };
}

// ---------- oyun ----------

/** Oyunun hangi evresinde olduğumuz: istemci eylemi bu anahtarla gönderir. */
export function gameKey(g      )         {
  return g.mode === 'team' ? `t:${g.phase}:${g.turns.length}:${g.turnIndex}` : `q:${g.phase}:${g.scenarios.length}`;
}

function setGame(r      , next      , now        )       {
  const prev = r.game;
  r.game = next;
  if (!prev || prev.phase !== next.phase) r.phaseAt = now;
  r.grev += 1;
  r.lastAt = now;
  touch(r, now);
}

function startGame(r      , now        , seed        )                {
  const L = r.lobby;
  if (L.mode === 'team') {
    const teams = L.teamNames.map((name, i) => ({ name, players: r.members.filter((m) => m.team === i).map((m) => m.name) }));
    const orphans = r.members.filter((m) => m.team >= L.teamNames.length);
    if (orphans.length) return `${orphans.map((m) => m.name).join(', ')} bir takım seçmeli.`;
    const err = validateSetup({ teams, settings: L.team });
    if (err) return err;
    const g = createTeamGame({ teams, settings: { ...L.team } }, CLASSIC, seed);
    const seats                         = {};
    L.teamNames.forEach((_, i) => {
      r.members.filter((m) => m.team === i).forEach((m, j) => (seats[`p${i}_${j}`] = m.id));
    });
    r.seats = seats;
    resetPending(r);
    setGame(r, g, now);
    return null;
  }
  if (r.members.length !== 2) return `Hızlı Rol iki kişiliktir; odada ${r.members.length} kişi var.`;
  const names                   = [r.members[0].name, r.members[1].name];
  const setup = { ...L.quick, names };
  const err = validateQuick(setup);
  if (err) return err;
  r.seats = { '0': r.members[0].id, '1': r.members[1].id };
  resetPending(r);
  setGame(r, createQuickGame(setup, QUICK, seed), now);
  return null;
}

function resetPending(r      )       {
  r.votes = {};
  r.qvotes = {};
  r.voteOpenedAt = null;
}

/** Bir sonraki zamanlı olay (sunucu alarmı bunun için kurulur). Yoksa null. */
export function nextDeadline(r      )                {
  const g = r.game;
  if (!g) return null;
  if (g.mode === 'team') {
    if (g.paused) return null;
    if (g.phase === 'prep') return r.phaseAt + prepSeconds(g) * 1000;
    if (g.phase === 'scene' && g.current && g.clock.startedAt !== null) {
      const dur = (DURATION_BY_CARD[g.current.cardId] ?? 2) * 60_000;
      const base = g.clock.startedAt + g.clock.pausedTotal;
      const out           = [];
      if (TWIST_BY_CARD[g.current.cardId] && !g.clock.twistShown) out.push(base + dur / 2);
      if (g.settings.timing === 'timed') out.push(base + dur + GRACE_MS);
      return out.length ? Math.min(...out) : null;
    }
    return null;
  }
  if (g.phase === 'prep') return r.phaseAt + QUICK_PREP_SEC * 1000;
  if (g.phase === 'scene' && g.clock.startedAt !== null) return g.clock.startedAt + g.durationSec * 1000;
  if (g.phase === 'voteGate' && r.voteOpenedAt !== null) return r.voteOpenedAt + VOTE_WINDOW_MS + VOTE_GRACE_MS;
  return null;
}

/**
 * Sunucunun kendiliğinden yaptığı ilerlemeler: gizli kapıları atla (herkes kendi telefonunda),
 * zamanı dolan evreleri ilerlet, tüm oylar gelince turu kapat. Değişiklik olduysa true.
 */
export function advance(r      , now        )          {
  let changed = false;
  for (let guard = 0; guard < 12; guard++) {
    const g = r.game;
    if (!g) break;
    const next = g.mode === 'team' ? stepTeam(r, g, now) : stepQuick(r, g, now);
    if (!next) break;
    setGame(r, next, now);
    changed = true;
  }
  return changed;
}

function stepTeam(r      , g          , now        )                  {
  switch (g.phase) {
    case 'secretGate':
      return teamReduce(g, { type: 'openSecret' });
    case 'confirmGate':
      return teamReduce(g, { type: 'openConfirm' });
    case 'voteGate': {
      const cur = g.current ;
      if (!cur.voterIds.every((id) => r.votes[id])) return null;
      // Herkes aynı anda oy verdi; kural motoruna oylayıcı sırasıyla işlenir (s.35).
      let x           = g;
      for (const id of cur.voterIds) {
        const v = r.votes[id];
        x = teamReduce(x, { type: 'openVote' });
        x = teamReduce(x, { type: 'submitVote', score: v.score, guess: v.guess });
      }
      r.votes = {};
      return x;
    }
    case 'prep':
      if (!g.paused && now >= r.phaseAt + prepSeconds(g) * 1000) return teamReduce(g, { type: 'startScene', now });
      return null;
    case 'scene': {
      if (g.paused || !g.current) return null;
      const tm = sceneTimingFor(g, DURATION_BY_CARD[g.current.cardId] ?? 2, now);
      if (TWIST_BY_CARD[g.current.cardId] && !g.clock.twistShown && tm.elapsed >= tm.duration / 2) return teamReduce(g, { type: 'twistShown' });
      if (tm.remaining !== null && tm.remaining <= -GRACE_MS) return teamReduce(g, { type: 'endScene', by: 'time', now });
      return null;
    }
    default:
      return null;
  }
}

function stepQuick(r      , g           , now        )                   {
  switch (g.phase) {
    case 'prep':
      return now >= r.phaseAt + QUICK_PREP_SEC * 1000 ? quickReduce(g, { type: 'startScene', now }) : null;
    case 'scene':
      return g.clock.startedAt !== null && now >= g.clock.startedAt + g.durationSec * 1000 ? quickReduce(g, { type: 'sceneEnd' }) : null;
    case 'voteGate': {
      if (r.voteOpenedAt === null) {
        // İkisi aynı anda, 5 saniye içinde oy verir (s.16, s.39).
        r.voteOpenedAt = now;
        r.qvotes = {};
        touch(r, now);
        return null;
      }
      const both = VOTE_ORDER.every((i) => r.qvotes[String(i)] !== undefined);
      if (!both && now < r.voteOpenedAt + VOTE_WINDOW_MS + VOTE_GRACE_MS) return null;
      const t0 = r.voteOpenedAt;
      let x            = g;
      for (const i of VOTE_ORDER) {
        const s = r.qvotes[String(i)];
        x = quickReduce(x, { type: 'openVote', now: t0 });
        x = quickReduce(x, { type: 'vote', score: s === undefined ? null : s, now: t0 }); // gelmeyen oy otomatik 10
      }
      r.qvotes = {};
      r.voteOpenedAt = null;
      return x;
    }
    default:
      return null;
  }
}

// ---------- izinler ----------

/** Eylemi kimin adına yaptığı: kendisi, ya da (yetkiliyse) bağlantısı kopan bir oyuncu. */
function effectivePid(r      , memberId        , as         )                                         {
  if (!as) return { pid: pidOf(r, memberId) };
  const mid = r.seats[as];
  if (!mid) return { pid: null, error: 'Böyle bir oyuncu yok.' };
  if (mid === memberId) return { pid: as };
  const target = memberById(r, mid);
  if (target?.online) return { pid: null, error: `${target.name} bağlı; kendi telefonundan yapsın.` };
  if (!privileged(r, memberId)) return { pid: null, error: 'Bunu yalnız odayı kuran yapabilir.' };
  return { pid: as };
}

const TEAM_ANYONE = new Set(['drawCard', 'cardDone', 'startScene', 'pause', 'resume', 'nextTurn', 'goldenSelect']);
const ACTOR_ONLY = new Set(['spin', 'veto', 'roleChange', 'roleConfirm', 'setImitation', 'secretDone']);

function teamAllowed(r      , g          , memberId        , pid               , a            )                {
  const actorId = g.current?.actorId ?? null;
  if (TEAM_ANYONE.has(a.type)) return null;
  if (a.type === 'endScene') return a.by === 'time' ? 'Süreyi sunucu tutar.' : null;
  if (a.type === 'endGame') return privileged(r, memberId) ? null : 'Oyunu yalnız odayı kuran bitirebilir.';
  if (a.type === 'starterSpin') return pid && a.playerId === pid ? null : 'Herkes kendi çarkını çevirir.';
  if (ACTOR_ONLY.has(a.type)) return pid && pid === actorId ? null : 'Bunu Ana Oyuncu yapar.';
  if (a.type === 'pickRole') {
    if (!pid || !actorId) return 'Rol seçilemez.';
    if (g.role.pickBy === 'actor') return pid === actorId ? null : 'Rolü Ana Oyuncu seçer.';
    return player(g, pid).teamId !== player(g, actorId).teamId ? null : 'Rolü rakipler seçer.';
  }
  if (a.type === 'rivalsToWheel') {
    if (!pid || !actorId) return 'Olmaz.';
    return player(g, pid).teamId !== player(g, actorId).teamId ? null : 'Çarka rakipler karar verir.';
  }
  if (a.type === 'confirm') return pid && pid === g.current?.imitationTargetId ? null : 'Bu soru yalnız taklit edilene.';
  return 'Bu eylem sunucuya ait.';
}

const QUICK_ANYONE = new Set(['ready', 'startScene', 'sceneEnd', 'cancelScene', 'next']);

/** Bir mesajı işler. Hata metni ya da null döner. Değişiklik varsa `rev` artar. */
export function handle(r      , memberId        , msg           , now        , seed               = () => (Math.random() * 0x7fffffff) | 0)                {
  const me = memberById(r, memberId);
  if (!me) return 'Odada değilsin.';
  r.touchedAt = now;
  const err = handleInner(r, me, msg, now, seed);
  advance(r, now);
  return err;
}

function handleInner(r      , me        , msg           , now        , seed              )                {
  const priv = privileged(r, me.id);
  switch (msg.t) {
    case 'hello':
    case 'tick':
      return null;
    case 'myTeam': {
      if (r.game) return 'Oyun sürerken takım değişmez.';
      const t = Math.floor(Number(msg.team));
      if (!(t >= 0 && t < r.lobby.teamNames.length)) return 'Böyle bir takım yok.';
      me.team = t;
      touch(r, now);
      return null;
    }
    case 'lobby': {
      if (r.game) return 'Oyun sürüyor.';
      if (!priv) return 'Ayarları odayı kuran değiştirir.';
      const p = msg.patch ?? {};
      const L = r.lobby;
      if (p.mode === 'team' || p.mode === 'quick') L.mode = p.mode;
      if (p.teamCount !== undefined) {
        const n = Math.max(2, Math.min(4, Math.floor(Number(p.teamCount))));
        while (L.teamNames.length < n) L.teamNames.push(`Takım ${'ABCD'[L.teamNames.length]}`);
        L.teamNames.length = n;
        for (const m of r.members) if (m.team >= n) m.team = n - 1;
      }
      if (p.teamName && L.teamNames[p.teamName.i] !== undefined) {
        L.teamNames[p.teamName.i] = cleanName(p.teamName.name, TEAM_NAME_MAX) || `Takım ${'ABCD'[p.teamName.i]}`;
      }
      if (p.team) {
        const s = p.team;
        if (s.roleSelect && ['wheel', 'self', 'rival', 'sequential'].includes(s.roleSelect)) L.team.roleSelect = s.roleSelect;
        if (s.levelMode && ['basit', 'orta', 'hayal', 'ladder'].includes(s.levelMode)) L.team.levelMode = s.levelMode;
        if (s.length && ['fast', 'long', 'free'].includes(s.length)) L.team.length = s.length;
        if (s.freeTurns !== undefined) L.team.freeTurns = Math.max(2, Math.min(6, Math.floor(Number(s.freeTurns)) || 2));
        if (s.timing && ['timed', 'untimed'].includes(s.timing)) L.team.timing = s.timing;
      }
      if (p.quick) {
        const q = p.quick;
        if (q.relation && ['ebeveyn', 'arkadas', 'partner'].includes(q.relation)) L.quick.relation = q.relation;
        if (typeof q.imitation === 'boolean') L.quick.imitation = q.imitation;
        if (q.durationSec === 15 || q.durationSec === 30 || q.durationSec === 60) L.quick.durationSec = q.durationSec;
        if (q.parentIndex === 0 || q.parentIndex === 1) L.quick.parentIndex = q.parentIndex;
      }
      touch(r, now);
      return null;
    }
    case 'kick': {
      if (r.game) return 'Oyun sürerken kimse çıkarılamaz.';
      if (!priv) return 'Yalnız odayı kuran çıkarabilir.';
      if (msg.id === me.id) return null;
      r.members = r.members.filter((m) => m.id !== msg.id);
      touch(r, now);
      return null;
    }
    case 'leave': {
      if (r.game && pidOf(r, me.id)) {
        // Oyundaki oyuncu silinemez (turlar ona bağlı); yalnız çevrimdışı sayılır.
        me.online = false;
        touch(r, now);
        return null;
      }
      r.members = r.members.filter((m) => m.id !== me.id);
      if (r.hostId === me.id) r.hostId = (r.members.find((m) => m.online) ?? r.members[0])?.id ?? '';
      touch(r, now);
      return null;
    }
    case 'start':
      if (r.game) return 'Oyun zaten başladı.';
      if (!priv) return 'Oyunu odayı kuran başlatır.';
      return startGame(r, now, seed());
    case 'restart':
      if (!priv) return 'Yeni oyunu odayı kuran başlatır.';
      if (r.game && r.game.phase !== 'final') return 'Oyun bitmeden yeniden başlamaz.';
      r.game = null;
      return startGame(r, now, seed());
    case 'toLobby':
      if (!priv) return 'Lobiye odayı kuran döndürür.';
      r.game = null;
      r.seats = {};
      resetPending(r);
      r.grev += 1;
      touch(r, now);
      return null;
    case 'act': {
      const g = r.game;
      if (!g) return 'Oyun yok.';
      // Başka bir evrenin ekranından gelen geç dokunuş sessizce yok sayılır (aynı evrede art arda dokunuşlar geçer).
      if (msg.at !== gameKey(g)) return null;
      const { pid, error } = effectivePid(r, me.id, msg.as);
      if (error) return error;
      if (g.mode === 'team') {
        const a = { ...(msg.a              ) }              ;
        const why = teamAllowed(r, g, me.id, pid, a);
        if (why) return why;
        if ('now' in a) (a                   ).now = now;
        const next = teamReduce(g, a);
        if (next === g) return null;
        const resumedPrep = a.type === 'resume' && g.phase === 'prep';
        if (a.type === 'starterSpin' || a.type === 'spin' || a.type === 'rivalsToWheel') {
          const v = a.type === 'starterSpin' ? next.starter.last?.value : next.role.wheel;
          if (v) r.spin = { seq: r.spin.seq + 1, value: v };
        }
        setGame(r, next, now);
        if (resumedPrep) r.phaseAt = now; // duraklatılan hazırlık baştan sayar
        if (a.type === 'endScene' && (a.by === 'red' || a.by === 'cancel')) r.votes = {};
        return null;
      }
      const a = { ...(msg.a               ) }               ;
      if (!QUICK_ANYONE.has(a.type)) return 'Bu eylem sunucuya ait.';
      if (!pid) return 'Bu oyunda oyuncu değilsin.';
      if ('now' in a) (a                   ).now = now;
      const next = quickReduce(g, a);
      if (next === g) return null;
      setGame(r, next, now);
      return null;
    }
    case 'vote': {
      const g = r.game;
      if (!g || g.mode !== 'team' || g.phase !== 'voteGate' || !g.current) return 'Şu an oy verilmez.';
      const { pid, error } = effectivePid(r, me.id, msg.as);
      if (error) return error;
      const cur = g.current;
      if (!pid || !cur.voterIds.includes(pid)) return 'Bu sahneyi sen puanlamıyorsun.';
      if (r.votes[pid]) return 'Oyun zaten alındı.';
      const score = Math.round(Number(msg.score));
      if (!(score >= 1 && score <= 10)) return 'Puan 1-10 arası.';
      let guess = String(msg.guess ?? 'none');
      if (cur.golden) guess = 'none';
      if (guess !== 'none' && !g.players.some((p) => p.id === guess && p.id !== cur.actorId)) return 'Tahmin geçersiz.';
      r.votes[pid] = { score, guess };
      touch(r, now);
      return null;
    }
    case 'qvote': {
      const g = r.game;
      if (!g || g.mode !== 'quick' || g.phase !== 'voteGate' || r.voteOpenedAt === null) return 'Şu an oy verilmez.';
      const { pid, error } = effectivePid(r, me.id, msg.as);
      if (error) return error;
      if (pid !== '0' && pid !== '1') return 'Bu oyunda oyuncu değilsin.';
      if (r.qvotes[pid] !== undefined) return 'Oyun zaten alındı.';
      if (now > r.voteOpenedAt + VOTE_WINDOW_MS + VOTE_GRACE_MS) return 'Süre doldu; oy otomatik 10.';
      const score = Math.round(Number(msg.score));
      if (!(score >= 1 && score <= 10)) return 'Puan 1-10 arası.';
      r.qvotes[pid] = score;
      touch(r, now);
      return null;
    }
    default:
      return 'Bilinmeyen mesaj.';
  }
}

// ---------- gizli bilgi süzgeci ----------

const IMITATION_HIDDEN                      = ['secret', 'prep', 'scene', 'voteGate', 'voteInput', 'confirmGate', 'confirmInput'];

function anonymize(t      )       {
  // Kimin ne verdiği hiç gösterilmez (s.12); puan için yalnız değerler gerekir.
  const votes = t.votes.map((v) => ({ voterId: '', score: v.score, guess: v.guess })).sort((a, b) => a.score - b.score || a.guess.localeCompare(b.guess));
  return { ...t, votes };
}

export function redactTeam(g          , viewer               )           {
  const cur = g.current;
  const hiding = !!cur && IMITATION_HIDDEN.includes(g.phase);
  const actorId = cur?.actorId ?? null;
  const secretFromMe = hiding && viewer !== actorId;
  let current = cur ? anonymize(cur) : null;
  if (current && secretFromMe) {
    const isTargetAsked = viewer !== null && viewer === cur .imitationTargetId && (g.phase === 'confirmGate' || g.phase === 'confirmInput');
    if (!isTargetAsked) current = { ...current, imitationTargetId: null };
  }
  const players = g.players.map((p) => {
    if (p.id === viewer) return p;
    let q = { ...p, usedImitationTargets: []             };
    // Jeton sayısı da taklidi ele vermesin: tur bitene kadar harcanmamış görünür.
    if (secretFromMe && p.id === actorId && cur .imitationTargetId && g.phase !== 'secret') q = { ...q, imitationTokens: q.imitationTokens + 1 };
    return q;
  });
  return {
    ...g,
    rng: 0,
    decks: { basit: [], orta: [], hayal: [] },
    pool: { basit: [], orta: [], hayal: [] },
    players,
    current,
    turns: g.turns.map(anonymize),
  };
}

function redactQuick(g           )            {
  return { ...g, rng: 0, deck: [] };
}

export function viewFor(r      , memberId        , now        )           {
  const pid = pidOf(r, memberId);
  const priv = privileged(r, memberId);
  const g = r.game;
  let game              = null;
  let voted           = [];
  let confirmFor                = null;
  if (g && g.mode === 'team') {
    game = redactTeam(g, pid);
    voted = Object.keys(r.votes);
    const target = g.current?.imitationTargetId;
    if (priv && target && (g.phase === 'confirmGate' || g.phase === 'confirmInput')) {
      const tm = memberById(r, r.seats[target] ?? '');
      if (!tm || !tm.online) confirmFor = target;
    }
  } else if (g) {
    game = redactQuick(g);
    voted = Object.keys(r.qvotes);
  }
  return {
    t: 'state',
    code: r.code,
    proto: PROTO,
    serverNow: now,
    rev: r.rev,
    grev: r.grev,
    you: { id: memberId, host: r.hostId === memberId, pid, privileged: priv },
    hostId: r.hostId,
    members: r.members.map((m) => ({ id: m.id, name: m.name, team: m.team, online: m.online })),
    lobby: r.lobby,
    game,
    seats: r.seats,
    phaseAt: r.phaseAt,
    voted,
    voteOpenedAt: r.voteOpenedAt,
    spin: r.spin,
    confirmFor,
  };
}
