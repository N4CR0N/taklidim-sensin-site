// Takımlı oyun ekranları (s.30-33).
                                                         
                                     
import { CLASSIC_BY_ID } from './state.js';
import {
  acc, avatar, dat, esc, fmt1, gen, holdButton, LEVEL_LABEL, primary, screen, secondary, TEAM_COLORS, upper, wheel,
} from './common.js';
import { player, totalTurns, upcoming } from '../engine/team.js';
import { PREP_SEC, PREP_UNTIMED_SEC, sceneTimingFor } from '../engine/timing.js';
                                                  
import { ctxOf, netBanner, waitScreen } from './onlineviews.js';
import {
  imitationBonus, imitationSuccess, playerTotal, standings, teamScore, teamSizesUnequal, tiedLeaders, titles, turnScore, turnTotal,
} from '../engine/rules.js';

const nm = (g          , id        )         => player(g, id).name;
const teamIdx = (g          , teamId        )         => g.teams.findIndex((t) => t.id === teamId);
const colorOf = (g          , playerId        )         => TEAM_COLORS[teamIdx(g, player(g, playerId).teamId)];
const teamName = (g          , teamId        )         => g.teams.find((t) => t.id === teamId)?.name ?? '';

export { PREP_SEC, PREP_UNTIMED_SEC };

/** Sahne zamanı: geçen süre ve (Süreli modda) kalan süre, ms. */
export function sceneTiming(g          , now        )                                                                  {
  const card = g.current ? CLASSIC_BY_ID[g.current.cardId] : null;
  return sceneTimingFor(g, card ? card.durationMin : 2, now);
}

export const mmss = (ms        )         => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function strip(g          )         {
  return `<div class="strip">${g.teams
    .map((t, i) => `<span class="ts" style="--c:${TEAM_COLORS[i]}"><span class="lt">${t.letter}</span>${fmt1(teamScore(g, t.id))}</span>`)
    .join('')}</div>`;
}

function roleText(turnOrNull             , n               )         {
  if (!turnOrNull || !n) return '';
  return CLASSIC_BY_ID[turnOrNull.cardId]?.roles[n - 1] ?? '';
}

const HELP                         = {
  starter: 'Herkes çarkı bir kez çevirir. En yüksek sayı başlar; eşitlikte yalnız eşit çevirenler tekrar çevirir (s.7).',
  turnIntro: 'Sıradaki oyuncu Ana Oyuncu olur. Takım arkadaşı Okuyucudur: kartı okur, kendisi oy vermez (s.9).',
  cardRead: 'Okuyucu olayı ve 6 rolü sesli okur. Dönüş satırı okunmaz; sahne ortasında gelir (s.9).',
  role: 'Çark: 1-6 kartta yazan rol, 7 Joker (sen seç), 8 Zor Rol (rakipler seçer). Veto: kişi başı 1, sahne başlamadan (s.7).',
  secretGate: 'Rol ve taklit seçimini yalnız Ana Oyuncu görür (s.31).',
  secret: 'Taklit gizlidir. Rakiplerin en az yarısı doğru tahmin eder ve taklit edilen onaylarsa tur puanının yarısı bonus (s.13).',
  prep: '15 saniye hazırlık. Dakikasız modda 1 dakikaya kadar (s.9).',
  scene: 'Karakterde kal. Rakipler sahne sırasında yorum yapmaz. Kırmızı Kart sahneyi anında durdurur, ceza yok (s.23).',
  voteGate: 'Oylar gizlidir. Telefon saat yönünde dolaşır; başkası ekrana bakmasın (s.12, s.35).',
  voteInput: 'Sahneyi bir bütün olarak 1-10 puanla. Taklit yoksa “Taklit yoktu” seç (s.11, s.13).',
  confirmGate: 'Taklit edilen kişi sahnenin kendisini yansıtıp yansıtmadığını söyler (s.13).',
  confirmInput: '“Rahatsız oldum” dersen taklit iptal olur, jeton iade edilir, tur normal puanlanır (s.13).',
  turnResult: 'Tur puanı rakiplerin ortalamasıdır. Kimin kaç puan verdiği hiçbir zaman gösterilmez (s.12).',
  goldenPick: 'Eşitlik bozma: 1) daha çok başarılı taklit, 2) tek turdaki en yüksek puan, 3) Altın Tur (s.23).',
  final: 'İttifak ihbarı bu prototipte yok (dosyada Faz 2). Kazanan en çok puanı toplayan takımdır (s.23).',
};

export function teamGameView(ui    , g          , now        )         {
  const on = ctxOf(ui);
  const body = phaseView(ui, g, now, on);
  return netBanner(ui) + body + sheets(ui, g, on) + twistOverlay(ui, g);
}

/** Online: bu telefon bu oyuncunun yerine davranabilir mi (kendisi ya da bağlantısı kopan oyuncu için odayı kuran). */
const actsFor = (on                  , pid        )          => !on || on.me === pid || (on.priv && !on.online[pid]);

/** Bağlantısı kopan oyuncu için "telefonu ona ver" düğmesi (yalnız odayı kuran görür). */
function proxyButton(g          , on           , pid        , label        )         {
  if (!on.priv || on.online[pid] || on.me === pid) return '';
  return `<button class="btn outline small" data-act="proxy" data-id="${pid}">${esc(nm(g, pid))} bağlı değil: ${esc(label)}</button>`;
}

/** Bağlantısı kopan oyuncunun gizli ekranı bu telefonda: önce kapı (1 sn basılı). */
function proxyGate(g          , pid        , help        )         {
  return screen({
    kind: 'GİZLİ',
    back: 'proxyCancel',
    help,
    body: `<div class="gate"><div class="to">SADECE ${esc(upper(nm(g, pid)))} BAKSIN</div>
      ${avatar(nm(g, pid), colorOf(g, pid), 'lg')}<div class="who">${esc(nm(g, pid))}</div>
      <p class="muted">${esc(nm(g, pid))} bağlı değil. Telefonu ${esc(dat(nm(g, pid)))} ver.</p></div>`,
    footer: holdButton(`Ben ${nm(g, pid)}`, 'proxyOpen'),
  });
}

function phaseView(ui    , g          , now        , on                  )         {
  const help = HELP[g.phase];
  const spinning = now < ui.spinUntil;
  const BACK = on ? 'onlineBack' : 'pause';
  switch (g.phase) {
    case 'starter': {
      const st = g.starter;
      const next = g.players.find((p) => st.contenders.includes(p.id) && !st.spins[p.id]);
      const hideLast = spinning && st.last ? st.last.playerId : null;
      const rows = g.players
        .map((p) => {
          const v = st.spins[p.id];
          const shown = v && p.id !== hideLast ? String(v) : '';
          return `<tr><td>${avatar(p.name, colorOf(g, p.id))}</td><td>${esc(p.name)}</td><td class="num">${shown}${st.starterId === p.id && !spinning ? ' ★' : ''}</td></tr>`;
        })
        .join('');
      const tie = !spinning && st.contenders.length < g.players.length && !st.starterId;
      let onlineFoot = '';
      if (on) {
        const mine = !!on.me && st.contenders.includes(on.me) && !st.spins[on.me];
        const offline = g.players.filter((p) => st.contenders.includes(p.id) && !st.spins[p.id] && on.priv && !on.online[p.id] && p.id !== on.me);
        onlineFoot = mine
          ? `<button class="btn primary" data-act="starterSpin" data-id="${on.me}" ${spinning ? 'disabled' : ''}>ÇEVİR</button>`
          : `<p class="hint center">${spinning ? 'Dönüyor…' : 'Herkes kendi telefonundan çeviriyor…'}</p>`;
        onlineFoot += offline
          .map((p) => `<button class="btn outline small" data-act="starterSpin" data-id="${p.id}" ${spinning ? 'disabled' : ''}>${esc(p.name)} bağlı değil: onun yerine çevir</button>`)
          .join('');
      }
      return screen({
        kind: 'MASA',
        title: 'Kim başlıyor?',
        back: on ? 'onlineBack' : 'askQuit',
        help,
        body: `${wheel(ui.wheelFrom, ui.wheelTo)}
          ${tie ? `<div class="notice">Eşitlik! Yalnız eşit çevirenler tekrar çevirir.</div>` : ''}
          <table class="table">${rows}</table>`,
        footer: st.starterId && !spinning
          ? `<p class="center"><b>${esc(nm(g, st.starterId))}</b> başlıyor.</p>${primary('Oyuna başla', 'team', 'data-a="drawCard"')}`
          : on
            ? onlineFoot
            : next
            ? `<button class="btn primary" data-act="starterSpin" data-id="${next.id}" ${spinning ? 'disabled' : ''}>${esc(next.name)}: ÇEVİR</button>`
            : `<button class="btn primary" disabled>Dönüyor…</button>`,
      });
    }
    case 'turnIntro': {
      const u = upcoming(g);
      const total = totalTurns(g);
      return screen({
        kind: 'MASA',
        title: u.golden ? 'ALTIN TUR' : `TUR ${Math.min(g.turnIndex + 1, total)} / ${total}`,
        right: LEVEL_LABEL[u.level],
        back: BACK,
        help,
        body: `<div class="turn-hero">${avatar(nm(g, u.actorId), colorOf(g, u.actorId), 'xl')}
            <div class="big-name">${esc(nm(g, u.actorId))}</div>
            <p class="muted">${on && on.me !== u.actorId ? (on.me === u.readerId ? 'sahne sırası onda · Okuyucu sensin' : 'sahne sırası onda') : 'sahne sırası sende'}</p>
            <span class="chip ${u.level}">${LEVEL_LABEL[u.level]}</span>
            <p>Okuyucu: <b>${esc(nm(g, u.readerId))}</b></p></div>
          <div style="margin-top:auto">${strip(g)}</div>`,
        footer: `${primary('Kartı çek', 'team', 'data-a="drawCard"')}${secondary('Skor tablosu', 'sheet', 'data-v="scores"')}`,
      });
    }
    case 'cardRead': {
      const t = g.current ;
      const card = CLASSIC_BY_ID[t.cardId];
      return screen({
        kind: 'MASA',
        title: `Okuyucu: ${nm(g, t.readerId)}`,
        back: BACK,
        help,
        body: `<div class="scenario"><span class="chip ${card.level}">${LEVEL_LABEL[card.level]} · ${card.durationMin} dk</span>
            <h2>${esc(upper(card.title))}</h2><p class="sit">${esc(card.situation)}</p></div>
          <h3>Roller</h3><ol class="roles">${card.roles.map((r, i) => `<li><span class="n">${i + 1}</span>${esc(r)}</li>`).join('')}</ol>
          <p class="hint">Sesli okuyun. ${card.twist ? 'Bu kartta bir Dönüş var; sahne ortasında gelecek.' : ''}</p>`,
        footer: primary(g.settings.roleSelect === 'wheel' ? 'Okudum → Çark' : 'Okudum → Rol', 'team', 'data-a="cardDone"'),
      });
    }
    case 'role':
      return roleView(ui, g, spinning, help, on);
    case 'secret':
      if (!on) return secretView(g, null);
    // eslint-disable-next-line no-fallthrough
    case 'secretGate': {
      if (on) {
        const t = g.current ;
        if (on.me === t.actorId) return secretView(g, on);
        if (on.proxyAs === t.actorId && on.proxyOpen) {
          // Sunucu hedefi bu telefondan gizler; vekâleten yapılan seçimi yerel kayıttan göster.
          return secretView({ ...g, current: { ...t, imitationTargetId: on.proxyPick } }, on);
        }
        if (on.proxyAs === t.actorId) return proxyGate(g, t.actorId, help);
        return waitScreen({
          title: `Rol ${t.roleNumber}`,
          back: BACK,
          help,
          who: { name: nm(g, t.actorId), color: colorOf(g, t.actorId) },
          lines: `<p>Rolünü okuyor ve gizli seçimini yapıyor.</p><p class="scene-title">ROL ${t.roleNumber} · ${esc(roleText(t, t.roleNumber))}</p>`,
          footer: proxyButton(g, on, t.actorId, 'telefonu ona ver'),
        });
      }
      const t = g.current ;
      return screen({
        kind: 'GİZLİ',
        back: 'pause',
        help,
        body: `<div class="gate"><div class="to">SADECE ${esc(upper(nm(g, t.actorId)))} BAKSIN</div>
          ${avatar(nm(g, t.actorId), colorOf(g, t.actorId), 'lg')}<div class="who">${esc(nm(g, t.actorId))}</div>
          <p class="muted">Telefonu ${esc(dat(nm(g, t.actorId)))} ver.</p></div>`,
        footer: holdButton(`Ben ${nm(g, t.actorId)}`, 'team:openSecret'),
      });
    }
    case 'prep': {
      const t = g.current ;
      const sec = g.settings.timing === 'timed' ? PREP_SEC : PREP_UNTIMED_SEC;
      const left = Math.max(0, sec * 1000 - (now - ui.prepAt));
      return screen({
        kind: 'MASA',
        title: `Hazırlan, ${nm(g, t.actorId)}`,
        back: BACK,
        help,
        body: `${ring(left, sec * 1000, 'prep')}
          <p class="scene-title">ROL ${t.roleNumber} · ${esc(roleText(t, t.roleNumber))}</p>
          <p class="scene-sub">Okuyucu hazır: ${esc(nm(g, t.readerId))}</p>`,
        footer: primary('Hazırım, başlat', 'startScene'),
      });
    }
    case 'scene': {
      const t = g.current ;
      const card = CLASSIC_BY_ID[t.cardId];
      const tm = sceneTiming(g, now);
      const timed = tm.remaining !== null;
      const shown = timed ? mmss(tm.remaining          ) : mmss(tm.elapsed);
      return screen({
        kind: 'MASA',
        title: upper(card.title),
        help,
        body: `<p class="scene-sub">${esc(nm(g, t.actorId))} · ROL ${t.roleNumber}</p>
          <div class="clock ${timed && (tm.remaining          ) <= 30_000 ? 'warn' : ''}" data-clock="scene">${shown}</div>
          <p class="scene-sub" data-grace></p>
          ${card.twist ? `<p class="center"><span class="chip hayal">Dönüş yarıda gelir</span></p>` : ''}
          <p class="center muted">${timed ? `Süre: ${card.durationMin} dk` : 'Dakikasız: bitirmek için Perde'}</p>`,
        footer: `${primary('Perde', 'endScene', 'data-by="curtain"')}
          <div class="row">${g.settings.timing === 'untimed' ? `<button class="btn outline small" data-act="sheet" data-v="confirmUzadi">Uzadı</button>` : ''}
          <button class="btn danger small" data-act="endScene" data-by="red">Kırmızı Kart</button>
          <button class="btn outline small" data-act="pause">Duraklat</button></div>`,
      });
    }
    case 'voteInput':
      if (!on) return voteInputView(ui, g, g.current .voterIds[g.voteCursor], null);
    // eslint-disable-next-line no-fallthrough
    case 'voteGate': {
      const t = g.current ;
      if (on) {
        // Herkes kendi telefonunda, aynı anda oy verir (s.39).
        const pending = (id        ) => !on.voted.includes(id);
        if (on.proxyAs && t.voterIds.includes(on.proxyAs) && pending(on.proxyAs)) {
          return on.proxyOpen ? voteInputView(ui, g, on.proxyAs, on) : proxyGate(g, on.proxyAs, help);
        }
        if (on.me && t.voterIds.includes(on.me) && pending(on.me)) return voteInputView(ui, g, on.me, on);
        const rows = t.voterIds
          .map((id) => `<div class="member">${avatar(nm(g, id), colorOf(g, id))}<span class="nm">${esc(nm(g, id))}${id === on.me ? ' <small>(sen)</small>' : ''}</span>
            <span class="${pending(id) ? 'muted' : 'ok'}">${pending(id) ? (on.online[id] ? 'düşünüyor…' : 'bağlı değil') : '✓ oy verdi'}</span></div>`)
          .join('');
        const proxies = t.voterIds.filter((id) => pending(id)).map((id) => proxyButton(g, on, id, 'onun oyunu bu telefondan al')).join('');
        const role = on.me === t.actorId ? 'Rakipler sahneni puanlıyor.' : on.me && t.voterIds.includes(on.me) ? 'Oyun alındı. Diğerleri bekleniyor.' : 'Rakipler puanlıyor; takım arkadaşları oy vermez.';
        return screen({
          kind: 'MASA',
          title: `Oylar ${t.voterIds.length - t.voterIds.filter(pending).length} / ${t.voterIds.length}`,
          back: BACK,
          help,
          body: `<p class="center"><b>${esc(gen(nm(g, t.actorId)))} sahnesi</b></p><p class="center muted">${role}</p>
            <div class="card">${rows}</div><p class="hint center">Kimin kaç verdiği hiç gösterilmez (s.12).</p>`,
          footer: proxies || undefined,
        });
      }
      const voterId = t.voterIds[g.voteCursor];
      return screen({
        kind: 'GİZLİ',
        title: 'Telefonu ver',
        back: 'pause',
        help,
        body: `<div class="gate">${avatar(nm(g, voterId), colorOf(g, voterId), 'lg')}<div class="who">${esc(upper(nm(g, voterId)))}</div>
          <p>${esc(gen(nm(g, t.actorId)))} sahnesini puanlayacak. Başkası ekrana bakmasın.</p>
          <p class="muted">oylayıcı ${g.voteCursor + 1} / ${t.voterIds.length}</p></div>`,
        footer: holdButton(`Ben ${nm(g, voterId)}`, 'team:openVote'),
      });
    }
    case 'confirmInput':
      if (!on) return confirmInputView(g);
    // eslint-disable-next-line no-fallthrough
    case 'confirmGate': {
      if (on) {
        const t = g.current ;
        if (t.imitationTargetId && on.me === t.imitationTargetId) return confirmInputView(g);
        if (on.confirmFor && on.proxyAs === on.confirmFor) return on.proxyOpen ? confirmInputView(g) : proxyGate(g, on.confirmFor, help);
        const known = on.me === t.actorId && t.imitationTargetId ? nm(g, t.imitationTargetId) : null;
        return waitScreen({
          title: 'Taklit onayı',
          back: BACK,
          help,
          lines: `<p>${known ? `${esc(known)} sahnenin onu yansıtıp yansıtmadığını söylüyor.` : 'Taklit edilen kişi kendi telefonunda onay veriyor.'}</p><p class="muted">Oylar tamam.</p>`,
          footer: on.confirmFor ? proxyButton(g, on, on.confirmFor, 'onayı bu telefondan al') : undefined,
        });
      }
      const t = g.current ;
      const target = t.imitationTargetId ;
      return screen({
        kind: 'GİZLİ',
        back: 'pause',
        help,
        body: `<div class="gate"><div class="to">${esc(upper(dat(nm(g, target))))} VER</div>
          ${avatar(nm(g, target), colorOf(g, target), 'lg')}<div class="who">${esc(nm(g, target))}</div>
          <p>Sana özel bir soru var. Başkası ekrana bakmasın.</p></div>`,
        footer: holdButton(`Ben ${nm(g, target)}`, 'team:openConfirm'),
      });
    }
    case 'turnResult': {
      const t = g.turns[g.turns.length - 1];
      const done = !g.golden && g.turnIndex >= totalTurns(g);
      const lastGolden = !!g.golden && g.golden.queue.length === 0;
      let imi = '';
      if (t.imitationTargetId) {
        const who = esc(nm(g, t.imitationTargetId));
        if (t.confirmation === 'uncomfortable') imi = `<p class="center muted">Taklit iptal edildi (${who} rahatsız oldu). Jeton iade.</p>`;
        else if (imitationSuccess(t)) imi = `<div class="bonus">+${fmt1(imitationBonus(t))}</div><p class="center">Taklit ✓ ${who}</p>`;
        else imi = `<p class="center muted">Taklit tutmadı (${who}). Jeton gitti, ceza yok.</p>`;
      }
      return screen({
        kind: 'MASA',
        title: `${upper(gen(nm(g, t.actorId)))} TURU`,
        help,
        body: `<div class="score-hero"><div class="big">${fmt1(turnScore(t))}</div><p class="muted">${t.votes.length} rakip oyuncunun ortalaması</p></div>
          ${imi}
          <div class="card center"><b>Tur toplamı: ${fmt1(turnTotal(t))}</b><p class="hint">Tek tek oylar hiç gösterilmez.</p></div>
          ${strip(g)}`,
        footer: `${primary(done || lastGolden ? 'Sonuçları gör' : 'Sonraki tur', 'team', 'data-a="nextTurn"')}${secondary('Skor tablosu', 'sheet', 'data-v="scores"')}`,
      });
    }
    case 'goldenPick': {
      const gd = g.golden ;
      const blocks = gd.teamIds
        .map((tid) => {
          const ps = g.players.filter((p) => p.teamId === tid);
          return `<div class="team-box" style="--c:${TEAM_COLORS[teamIdx(g, tid)]}"><b>${esc(teamName(g, tid))}</b>
            <div class="people">${ps.map((p) => `<button class="${ui.goldenPick[tid] === p.id ? 'on' : ''}" data-act="goldenPick" data-t="${tid}" data-id="${p.id}">${avatar(p.name, colorOf(g, p.id))}${esc(p.name)}</button>`).join('')}</div></div>`;
        })
        .join('');
      const ready = gd.teamIds.every((tid) => ui.goldenPick[tid]);
      return screen({
        kind: 'MASA',
        title: 'Beraberlik!',
        help,
        body: `<div class="podium"><div class="crown">ALTIN TUR${gd.round > 1 ? ` · ${gd.round}` : ''}</div>
          <p>Puan, başarılı taklit ve en iyi tur da eşit. Her takımdan bir oyuncu yeni bir kartla sahne yapar, rakipler gizli oy verir.</p></div>
          ${blocks}`,
        footer: `<button class="btn primary" data-act="goldenStart" ${ready ? '' : 'disabled'}>Altın Turu başlat</button>`,
      });
    }
    case 'final':
      return finalView(g, help, on);
    default:
      return screen({ kind: 'MASA', body: `<p>Bilinmeyen durum: ${esc(g.phase)}</p>`, footer: primary('Ana menü', 'home') });
  }
}

function secretView(g          , on                  )         {
  const help = HELP.secret;
  const t = g.current ;
  const me = player(g, t.actorId);
  const canImitate = !t.golden && (me.imitationTokens > 0 || !!t.imitationTargetId);
  const others = g.players.filter((p) => p.id !== me.id);
  const people = others
    .map((p) => {
      const used = me.usedImitationTargets.includes(p.id);
      return `<button class="${t.imitationTargetId === p.id ? 'on' : ''}" data-act="team" data-a="setImitation" data-id="${p.id}" ${used ? 'disabled' : ''}>
        ${avatar(p.name, colorOf(g, p.id))}${esc(p.name)}${used ? '<small>kullanıldı</small>' : ''}</button>`;
    })
    .join('');
  return screen({
    kind: 'GİZLİ',
    title: `Rolün, ${nm(g, me.id)}`,
    help,
    body: `<div class="card result"><div class="lbl">ROL ${t.roleNumber}</div><div class="val">${esc(roleText(t, t.roleNumber))}</div></div>
      ${canImitate ? `<h3>Taklit yap? (${me.imitationTokens} jeton)</h3>
        <p class="hint">Kimi taklit edeceksin? Sadece sen görürsün. Aynı kişiyi oyun boyunca bir kez taklit edebilirsin.</p>
        <div class="people">${people}<button class="none ${t.imitationTargetId ? '' : 'on'}" data-act="team" data-a="setImitation" data-id="">Taklit yok</button></div>
        ${t.imitationTargetId ? `<p class="center"><b>Taklit edilen: ${esc(nm(g, t.imitationTargetId))}</b> · 1 jeton harcanır</p>` : ''}`
        : `<p class="hint">${t.golden ? 'Altın Turda taklit yok.' : 'Taklit jetonun kalmadı.'}</p>`}`,
    footer: `${primary('Hazırım', 'team', 'data-a="secretDone"')}${on ? (on.proxyAs ? '<p class="hint center">Sonra telefonu geri ver</p>' : '') : '<p class="hint center">Sonra telefonu masaya bırak</p>'}`,
  });
}

function voteInputView(ui    , g          , voterId        , on                  )         {
  const help = HELP.voteInput;
  const t = g.current ;
  const needGuess = !t.golden;
  const ready = ui.score !== null && (!needGuess || ui.guess !== null);
  const people = g.players
    .filter((p) => p.id !== t.actorId)
    .map((p) => `<button class="${ui.guess === p.id ? 'on' : ''}" data-act="guess" data-id="${p.id}">${avatar(p.name, colorOf(g, p.id))}${esc(p.name)}</button>`)
    .join('');
  return screen({
    kind: 'GİZLİ',
    title: 'Beğeni puanın',
    right: nm(g, voterId),
    help,
    body: `<p class="center"><b>${esc(gen(nm(g, t.actorId)))} sahnesi</b></p>
      <div class="grid10">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button class="${ui.score === n ? 'on' : ''}" data-act="score" data-v="${n}">${n}</button>`).join('')}</div>
      <p class="hint center">1 = zayıf · 10 = muhteşem</p>
      ${needGuess ? `<h3>${esc(nm(g, t.actorId))} kimi taklit etti?</h3>
        <div class="people">${people}<button class="none ${ui.guess === 'none' ? 'on' : ''}" data-act="guess" data-id="none">Taklit yoktu</button></div>` : ''}`,
    footer: `<button class="btn primary" data-act="submitVote" data-as="${on && on.me !== voterId ? voterId : ''}" ${ready ? '' : 'disabled'}>Gönder</button>
      <p class="hint center">${on ? 'Oyunu yalnız sunucu görür; kimin kaç verdiği hiç gösterilmez.' : 'Gönderince ekran hemen gizlenir'}</p>`,
  });
}

function confirmInputView(g          )         {
  const help = HELP.confirmInput;
  const t = g.current ;
  return screen({
    kind: 'GİZLİ',
    help,
    body: `<div class="gate" style="padding-top:20px"><div class="who" style="font-size:30px">${esc(nm(g, t.actorId))} bu sahnede seni taklit ediyordu.</div>
      <p class="muted">Sahne seni yansıttı mı?</p></div>`,
    footer: `<button class="btn primary" data-act="confirm" data-v="yes">Evet, beni yansıttı</button>
      <button class="btn outline" data-act="confirm" data-v="no">Hayır, benzemedi</button>
      <button class="btn danger" data-act="confirm" data-v="uncomfortable">Rahatsız oldum</button>
      <p class="hint center">Rahatsız dersen taklit iptal olur, jeton iade edilir.</p>`,
  });
}

function roleView(ui    , g          , spinning         , help        , on                  )         {
  const t = g.current ;
  const card = CLASSIC_BY_ID[t.cardId];
  const r = g.role;
  const me = player(g, t.actorId);
  const mode = g.settings.roleSelect;
  // Online: Ana Oyuncunun düğmeleri yalnız onun telefonunda; Zor Rol / Rakip seçer'de rol listesi rakiplerde.
  const canA = actsFor(on, t.actorId);
  const canR = !on || (!!on.me && player(g, on.me).teamId !== me.teamId);
  const canPick = r.pickBy === 'rivals' ? canR : canA;
  const rivalsTeams = Array.from(new Set(g.players.filter((p) => p.teamId !== me.teamId).map((p) => teamName(g, p.teamId)))).join(', ');
  const pickList = (who        ) => `<p class="center"><b>${esc(who)}</b></p><div class="roles">${card.roles
    .map((x, i) => `<button class="${r.roleNumber === i + 1 ? 'on' : ''}" data-act="team" data-a="pickRole" data-n="${i + 1}" ${canPick ? '' : 'disabled'}><span class="n">${i + 1}</span>${esc(x)}</button>`)
    .join('')}</div>`;
  let body = '';
  let footer = '';
  if (mode === 'wheel' || r.wheel !== null) {
    body += wheel(ui.wheelFrom, ui.wheelTo);
    if (r.wheel === null) {
      footer = `<button class="btn primary" data-act="spin" ${spinning ? 'disabled' : ''}>${esc(me.name)}: ÇEVİR</button>`;
      if (mode === 'rival') footer += `<p class="hint center">Rakipler anlaşamadı: çark çevriliyor.</p>`;
    } else if (spinning) {
      footer = `<button class="btn primary" disabled>Dönüyor…</button>`;
    } else {
      if (r.wheel === 7) body += pickList('7 · JOKER: rolünü sen seç');
      else if (r.wheel === 8) body += pickList(`8 · ZOR ROL: rakipler (${rivalsTeams}) senin için seçer`);
      else body += `<div class="card result"><div class="lbl">${r.wheel} · ROL</div><div class="val">${esc(roleText(t, r.roleNumber))}</div></div>`;
      if (mode === 'wheel' && me.vetoLeft > 0) {
        body += `<div class="row"><button class="btn outline small" data-act="team" data-a="veto" data-w="respin">Veto: yeniden çevir</button>
          <button class="btn outline small" data-act="team" data-a="veto" data-w="card">Veto: kartı değiştir</button></div>
          <p class="hint center">Veto jetonu: 1 hak · yalnızca şimdi</p>`;
      }
      footer = `<button class="btn primary" data-act="team" data-a="roleConfirm" ${r.roleNumber ? '' : 'disabled'}>Devam</button>`;
    }
  } else if (mode === 'self') {
    body += pickList(`Rolünü seç, ${me.name}`);
    footer = `<button class="btn primary" data-act="team" data-a="roleConfirm" ${r.roleNumber ? '' : 'disabled'}>Bu rolü oynayacağım</button>`;
  } else if (mode === 'rival') {
    if (r.roleNumber === null) {
      body += pickList(`Rakipler (${rivalsTeams}) ${dat(me.name)} bir rol seçsin`);
      footer = `<button class="btn outline" data-act="team" data-a="rivalsToWheel">Anlaşamadık → Çark</button>`;
    } else {
      body += pickList(`Rakipler (${rivalsTeams}) ${dat(me.name)} bir rol seçsin`);
      footer = `<button class="btn primary" data-act="team" data-a="roleConfirm">Devam</button>
        ${me.roleChangeLeft > 0 ? `<button class="btn ghost" data-act="team" data-a="roleChange">Rol değiştir (rakipler yeniden seçer) · ${me.roleChangeLeft} hak</button>` : ''}`;
    }
  } else {
    body += `<div class="card result"><div class="lbl">SIRAYLA · ROL ${r.roleNumber}</div><div class="val">${esc(roleText(t, r.roleNumber))}</div></div>`;
    footer = `${primary('Devam', 'team', 'data-a="roleConfirm"')}
      ${me.roleChangeLeft > 0 ? `<button class="btn ghost" data-act="team" data-a="roleChange">Rol değiştir · ${me.roleChangeLeft} hak</button>` : ''}`;
  }
  if (on && !canA) {
    // Bu telefon Ana Oyuncu değil: onun düğmeleri yerine durum yazısı.
    const rivalsPicking = r.pickBy === 'rivals' && r.roleNumber === null;
    if (rivalsPicking && canR) {
      footer = `<p class="hint center">Rakipler anlaşıp bir rol seçsin (ilk dokunan seçer).</p>${mode === 'rival' && r.wheel === null ? `<button class="btn outline" data-act="team" data-a="rivalsToWheel">Anlaşamadık → Çark</button>` : ''}`;
    } else if (rivalsPicking) {
      footer = `<p class="hint center">Rakipler ${esc(dat(me.name))} bir rol seçiyor…</p>`;
    } else if (spinning) {
      footer = `<button class="btn primary" disabled>Dönüyor…</button>`;
    } else {
      footer = `<p class="hint center">${esc(me.name)} ${r.wheel === null && (mode === 'wheel' || mode === 'rival') ? 'çarkı çevirecek' : 'rolünü onaylayacak'}…</p>${proxyButton(g, on, t.actorId, 'onun yerine sen devam et')}`;
    }
  }
  return screen({ kind: 'MASA', title: 'Rol', right: me.name, back: on ? 'onlineBack' : 'pause', help, body, footer });
}

function ring(leftMs        , totalMs        , key        )         {
  const C = 2 * Math.PI * 90;
  const frac = Math.max(0, Math.min(1, leftMs / totalMs));
  return `<div class="ring"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="none" stroke="#E8DDF5" stroke-width="14"/>
    <circle data-ring="${key}" data-total="${totalMs}" cx="100" cy="100" r="90" fill="none" stroke="#FF5A5F" stroke-width="14" stroke-linecap="round"
      stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}"/></svg>
    <div class="num" data-clock="${key}">${Math.ceil(leftMs / 1000)}</div></div>`;
}
export { ring };

function finalView(g          , help        , on                  )         {
  const rows = standings(g);
  const tied = tiedLeaders(rows);
  const winner = tied.length === 1 ? rows[0].teamId : null;
  const tt = titles(g);
  const unequal = teamSizesUnequal(g);
  const table = rows
    .map((r, i) => `<tr><td>${i + 1}</td><td><span class="avatar" style="--c:${TEAM_COLORS[teamIdx(g, r.teamId)]};width:28px;height:28px;font-size:13px">${g.teams[teamIdx(g, r.teamId)].letter}</span> ${esc(teamName(g, r.teamId))}</td>
      <td class="num">${fmt1(r.score)}</td><td class="num">${r.imitations}</td></tr>`)
    .join('');
  const players = g.players
    .slice()
    .sort((a, b) => playerTotal(g, b.id) - playerTotal(g, a.id))
    .map((p) => `<tr><td>${avatar(p.name, colorOf(g, p.id))}</td><td>${esc(p.name)}</td><td class="num">${fmt1(playerTotal(g, p.id))}</td></tr>`)
    .join('');
  return screen({
    kind: 'MASA',
    title: 'Sonuç',
    help,
    body: `<div class="podium"><div class="crown">${winner ? 'KAZANAN' : 'BERABERE'}</div>
        <div class="win">${winner ? esc(teamName(g, winner)) : tied.map((t) => esc(teamName(g, t))).join(' · ')}</div>
        ${g.endedEarly ? '<p class="hint">Oyun erken bitirildi; turlar eksik olabilir.</p>' : ''}</div>
      <div class="titles">
        ${tt.actor ? `<span class="chip">Yılın Aktörü: ${esc(nm(g, tt.actor.playerId))} (${fmt1(tt.actor.score)})</span>` : ''}
        ${tt.mimic ? `<span class="chip">Taklit Ustası: ${esc(nm(g, tt.mimic.playerId))}</span>` : ''}
      </div>
      <table class="table"><tr><th>#</th><th>Takım</th><th class="num">Puan</th><th class="num">Taklit</th></tr>${table}</table>
      ${unequal ? '<p class="hint">Takımlar eşit sayıda olmadığı için puan, tur başına ortalamadır (s.11).</p>' : ''}
      <h3>Oyuncular</h3><table class="table">${players}</table>`,
    footer: on
      ? on.priv
        ? `${primary('Yeniden oyna (aynı takımlar)', 'onlineRestart')}${secondary('Lobiye dön', 'onlineToLobby')}${secondary('Ana menü', 'sheet', 'data-v="onlineLeave"')}`
        : `<p class="hint center">Yeni oyunu odayı kuran başlatır.</p>${secondary('Ana menü', 'sheet', 'data-v="onlineLeave"')}`
      : `${primary('Yeniden oyna', 'replayTeam')}${secondary('Ana menü', 'quitToMenu')}`,
  });
}

function sheets(ui    , g          , on                  )         {
  if (!ui.sheet) return '';
  const wrap = (inner        ) => `<div class="overlay" data-act="closeSheet"><div class="sheet" data-stop>${inner}</div></div>`;
  switch (ui.sheet) {
    case 'pause':
      return wrap(`<h2>Duraklatıldı</h2>${on ? '<p class="hint">Oyun herkes için duraklatıldı; herhangi biri devam ettirebilir.</p>' : ''}
        ${primary('Devam et', 'resumeGame')}
        <div class="card"><b>Kural</b><p class="hint">${HELP[g.phase] ?? ''}</p></div>
        ${g.current && ['cardRead', 'role', 'secretGate', 'secret', 'prep', 'scene'].includes(g.phase) ? `<button class="btn outline" data-act="sheet" data-v="confirmCancel">Turu iptal et (yeni kart)</button>` : ''}
        <button class="btn outline" data-act="sheet" data-v="scores">Skor tablosu</button>
        ${!on || on.priv ? `<button class="btn danger" data-act="sheet" data-v="confirmEnd">Oyunu bitir</button>` : ''}
        ${on ? `<button class="btn ghost" data-act="sheet" data-v="onlineLeave">Ana menüye dön (oyun sürer)</button>` : `<button class="btn ghost" data-act="quitToMenu">Ana menüye dön (oyun kayıtlı kalır)</button>`}`);
    case 'scores': {
      const teamRows = g.teams
        .map((t, i) => `<tr><td><span class="avatar" style="--c:${TEAM_COLORS[i]};width:28px;height:28px;font-size:13px">${t.letter}</span> ${esc(t.name)}</td><td class="num">${fmt1(teamScore(g, t.id))}</td></tr>`)
        .join('');
      const pRows = g.players
        .map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${fmt1(playerTotal(g, p.id))}</td><td class="num">${p.imitationTokens}</td><td class="num">${p.vetoLeft}</td></tr>`)
        .join('');
      return wrap(`<h2>Skor</h2><table class="table">${teamRows}</table>
        <table class="table"><tr><th>Oyuncu</th><th class="num">Puan</th><th class="num">Taklit j.</th><th class="num">Veto</th></tr>${pRows}</table>
        <p class="hint">Turlar: ${g.turnIndex} / ${totalTurns(g)}</p>
        ${primary('Oyuna dön', 'closeSheet')}`);
    }
    case 'confirmCancel':
      return wrap(`<h2>Turu iptal et?</h2><p>Tur sayılmaz, aynı oyuncu yeni bir kartla oynar. Taklit jetonu iade edilir.</p>
        <button class="btn danger" data-act="endScene" data-by="cancel">Evet, iptal et</button>${secondary('Vazgeç', 'closeSheet')}`);
    case 'confirmEnd':
      return wrap(`<h2>Oyunu bitir?</h2><p>Kalan turlar oynanmaz, şimdiki skorla sonuç gösterilir.</p>
        <button class="btn danger" data-act="team" data-a="endGame">Evet, bitir</button>${secondary('Vazgeç', 'closeSheet')}`);
    case 'confirmUzadi':
      return wrap(`<h2>Uzadı mı?</h2><p>Rakip oyuncuların çoğunluğu (yarısından fazlası) “Uzadı” diyorsa sahne biter.</p>
        <button class="btn primary" data-act="endScene" data-by="uzadi">Evet, çoğunluk uzadı diyor</button>${secondary('Vazgeç', 'closeSheet')}`);
    case 'confirmQuit':
      return wrap(`<h2>Ana menüye dön?</h2><p>Oyun kayıtlı kalır; menüden devam edebilirsin.</p>
        ${primary('Ana menü', 'quitToMenu')}${secondary('Vazgeç', 'closeSheet')}`);
    default:
      return '';
  }
}

function twistOverlay(ui    , g          )         {
  if (!ui.twistOpen || g.phase !== 'scene' || !g.current) return '';
  const card = CLASSIC_BY_ID[g.current.cardId];
  return `<div class="twist"><div class="w">DÖNÜŞ!</div><div class="t">${esc(card.twist ?? '')}</div>
    <p>Okuyucu sesli okur. Sayaç durmaz.</p>
    <button class="btn primary" data-act="closeTwist" style="max-width:320px">Sahneye devam</button></div>`;
}

export { acc };
