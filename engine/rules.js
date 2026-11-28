// Kural motoru: puan, bonus, takım puanı, kazanan. Ekrandan bağımsız saf fonksiyonlar (s.37).
                                                                                                    

export const round1 = (x        )         => Math.round(x * 10) / 10;

/** Tur puanı: rakip oyuncuların verdiği puanların ortalaması, bir ondalık (s.11). */
export function turnScore(turn      )         {
  if (turn.votes.length === 0) return 0;
  const sum = turn.votes.reduce((a, v) => a + v.score, 0);
  return round1(sum / turn.votes.length);
}

/** Rakiplerin kaçta kaçı taklit edileni doğru yazdı. */
export function recognizedShare(turn      )         {
  if (!turn.imitationTargetId || turn.votes.length === 0) return 0;
  const hit = turn.votes.filter((v) => v.guess === turn.imitationTargetId).length;
  return hit / turn.votes.length;
}

/** Başarı: rakiplerin en az yarısı tanıdı VE taklit edilen "Beni yansıttı" dedi (s.13). */
export function imitationSuccess(turn      )          {
  return !!turn.imitationTargetId && turn.confirmation === 'yes' && recognizedShare(turn) >= 0.5;
}

/** Bonus = tur puanının yarısı (s.13). */
export function imitationBonus(turn      )         {
  return imitationSuccess(turn) ? round1(0.5 * turnScore(turn)) : 0;
}

export function turnTotal(turn      )         {
  return round1(turnScore(turn) + imitationBonus(turn));
}

export function teamOf(game          , playerId        )         {
  const p = game.players.find((x) => x.id === playerId);
  return p ? p.teamId : '';
}

export function countedTurns(game          )         {
  return game.turns.filter((t) => !t.voided && !t.golden);
}

export function teamSizesUnequal(game          )          {
  const sizes = game.teams.map((t) => game.players.filter((p) => p.teamId === t.id).length);
  return new Set(sizes).size > 1;
}

/**
 * Takım puanı: takımın tüm turlarının toplamı. Takımlar eşit sayıda değilse
 * kişi başı ortalama (toplam / oynanan tur) esas alınır (s.11, s.37).
 */
export function teamScore(game          , teamId        )         {
  const turns = countedTurns(game).filter((t) => teamOf(game, t.actorId) === teamId);
  const total = turns.reduce((a, t) => a + turnTotal(t), 0);
  if (teamSizesUnequal(game)) return turns.length ? round1(total / turns.length) : 0;
  return round1(total);
}

export function teamImitations(game          , teamId        )         {
  return countedTurns(game).filter((t) => teamOf(game, t.actorId) === teamId && imitationSuccess(t)).length;
}

export function teamBestTurn(game          , teamId        )         {
  const ts = countedTurns(game).filter((t) => teamOf(game, t.actorId) === teamId).map(turnTotal);
  return ts.length ? Math.max(...ts) : 0;
}

export function playerTotal(game          , playerId        )         {
  return round1(countedTurns(game).filter((t) => t.actorId === playerId).reduce((a, t) => a + turnTotal(t), 0));
}

// ---------- Tur sayısı, seviye, sıra ----------

export function turnsPerPlayer(length        , freeTurns        )         {
  if (length === 'fast') return 4;
  if (length === 'long') return 8;
  return Math.max(2, Math.floor(freeTurns));
}

/** Taklit jetonu: Hızlı modda 2, Uzun modda 3 (s.13). Serbest uzunlukta tur sayısına göre. */
export function imitationTokensFor(perPlayer        )         {
  return perPlayer <= 4 ? 2 : 3;
}

const FAST          = ['basit', 'orta', 'orta', 'hayal'];
const LONG          = ['basit', 'basit', 'orta', 'orta', 'orta', 'hayal', 'hayal', 'hayal'];

/**
 * Merdiven: seviye oyuncunun KENDİ tur sırasına göre ilerler (s.8, s.37).
 * Yorum: s.37'deki `turnNo` genel sayaç olarak okunursa 4 kişilik Hızlı oyunda
 * her oyuncu hep aynı seviyeyi alır; bu yüzden oyuncunun kaçıncı turu olduğu kullanılır.
 */
export function levelFor(mode           , perPlayer        , playerRound        )        {
  if (mode !== 'ladder') return mode;
  const seq = perPlayer <= 4 ? FAST : LONG;
  return seq[playerRound % seq.length];
}

/** Takımları dönüşümlü oturtur: A, B, C, A, B, C (s.4). */
export function seatOrder(teams        , members                          )           {
  const out           = [];
  const max = Math.max(...teams.map((t) => (members[t.id] || []).length));
  for (let i = 0; i < max; i++) {
    for (const t of teams) {
      const m = members[t.id] || [];
      if (i < m.length) out.push(m[i]);
    }
  }
  return out;
}

/** Oylayıcılar: oynayanın takımı dışındaki herkes, oynayandan sonra saat yönünde (s.35). */
export function votersFor(players          , actorId        )           {
  const n = players.length;
  const actor = players.find((p) => p.id === actorId);
  if (!actor) return [];
  const out           = [];
  for (let k = 1; k < n; k++) {
    const p = players[(actor.seat + k) % n];
    if (p.teamId !== actor.teamId) out.push(p.id);
  }
  return out;
}

// ---------- Kazanan ----------

                           
                 
                
                     
                   
                        
 

export function standings(game          )             {
  const rows             = game.teams.map((t) => ({
    teamId: t.id,
    score: teamScore(game, t.id),
    imitations: teamImitations(game, t.id),
    bestTurn: teamBestTurn(game, t.id),
    golden: goldenScore(game, t.id),
  }));
  return rows.sort(compareStanding);
}

function goldenScore(game          , teamId        )                {
  if (!game.golden) return null;
  const round = game.golden.round;
  const g = game.turns.filter(
    (t) => t.golden && !t.voided && t.goldenRound === round && teamOf(game, t.actorId) === teamId,
  );
  return g.length ? turnTotal(g[g.length - 1]) : null;
}

/** Eşitlik bozma: 1) daha çok başarılı taklit, 2) tek turda en yüksek puan, 3) Altın Tur (s.23). */
export function compareStanding(a          , b          )         {
  if (b.score !== a.score) return b.score - a.score;
  if (b.imitations !== a.imitations) return b.imitations - a.imitations;
  if (b.bestTurn !== a.bestTurn) return b.bestTurn - a.bestTurn;
  const ga = a.golden ?? -1;
  const gb = b.golden ?? -1;
  return gb - ga;
}

/** Birinciyle tamamen berabere kalan takımlar (Altın Tur gerekir). Tek takım dönerse kazanan bellidir. */
export function tiedLeaders(rows            )           {
  if (rows.length === 0) return [];
  const top = rows[0];
  return rows.filter((r) => compareStanding(r, top) === 0).map((r) => r.teamId);
}

                         
                                                    
                                                    
 

/** Unvanlar: Yılın Aktörü (tek turda en yüksek), Taklit Ustası (en çok başarılı taklit) (s.23). */
export function titles(game          )         {
  let actor                  = null;
  for (const t of countedTurns(game)) {
    const s = turnTotal(t);
    if (!actor || s > actor.score) actor = { playerId: t.actorId, score: s };
  }
  let mimic                  = null;
  for (const p of game.players) {
    const c = countedTurns(game).filter((t) => t.actorId === p.id && imitationSuccess(t)).length;
    if (c > 0 && (!mimic || c > mimic.count)) mimic = { playerId: p.id, count: c };
  }
  return { actor, mimic };
}

// ---------- Hızlı Rol ----------

export const QUICK_SCENARIOS = 5; // 10 rol = 5 senaryo x 2 rol (s.16, önerilen yorum)

export function quickTotals(game           , includeGolden = false)                   {
  const t                   = [0, 0];
  for (const s of game.scenarios) {
    if (s.golden && !includeGolden) continue;
    t[0] += s.received[0] ?? 0;
    t[1] += s.received[1] ?? 0;
  }
  return t;
}

export function quickAverages(game           )                   {
  const regular = game.scenarios.filter((s) => !s.golden);
  const n = regular.length || 1;
  const [a, b] = quickTotals(game);
  return [round1(a / n), round1(b / n)];
}

/** Kazanan index'i; eşitlikte son Altın Sahne'ye bakılır; hâlâ eşitse null. */
export function quickWinner(game           )               {
  const [a, b] = quickTotals(game);
  if (a !== b) return a > b ? 0 : 1;
  const golden = game.scenarios.filter((s) => s.golden && s.received[0] !== null && s.received[1] !== null);
  const last = golden[golden.length - 1];
  if (!last) return null;
  const ga = last.received[0]          ;
  const gb = last.received[1]          ;
  if (ga === gb) return null;
  return ga > gb ? 0 : 1;
}
