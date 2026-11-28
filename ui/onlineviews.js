// Online ekranlar: oda kur / katıl, lobi, bekleme ekranları ve oyun ekranlarının "bu telefon kim" bağlamı.
                                     
                                                  
import { MAX_MEMBERS } from '../online/room.js';
import { avatar, esc, primary, screen, secondary, seg, TEAM_COLORS } from './common.js';
import { turnsPerPlayer } from '../engine/rules.js';
                                          

/** Oyun ekranlarının ihtiyaç duyduğu online bağlam. Tek telefonda null. */
                            
                                                        
                                                               
                                                                
                  
                            
                         
                     
                           
                              
 

export function ctxOf(ui    )                   {
  const o = ui.online;
  const r = o?.room;
  if (!o || !r) return null;
  const online                          = {};
  for (const [pid, mid] of Object.entries(r.seats)) online[pid] = !!r.members.find((m) => m.id === mid)?.online;
  return {
    me: r.you.pid,
    priv: r.you.privileged,
    online,
    voted: r.voted,
    confirmFor: r.confirmFor,
    proxyAs: o.proxyAs,
    proxyOpen: o.proxyOpen,
    proxyPick: o.proxyPick,
    voteOpenedAt: r.voteOpenedAt,
  };
}

const STATUS_TEXT                         = {
  connecting: 'Bağlanıyor…',
  retrying: 'Bağlantı koptu, yeniden deneniyor…',
  closed: 'Bağlantı kapalı',
};

/** Bağlantı sorunu varsa ekranın üstünde ince bir şerit. */
export function netBanner(ui    )         {
  const s = ui.online?.status;
  if (!s || s === 'open') return '';
  return `<div class="net-banner ${s}">${esc(STATUS_TEXT[s] ?? '')}</div>`;
}

export function onlineHomeView(ui    , saved                  , hasServer         )         {
  const f = ui.form;
  const err = ui.online?.error ?? null;
  const busy = !!ui.online && !ui.online.room && ui.online.status !== 'closed';
  return screen({
    kind: 'KURULUM',
    title: 'Online oyna',
    back: 'onlineBack',
    help: 'Herkes kendi telefonundan (uygulama ya da internet sitesi) aynı odaya katılır. Gizli oylar ve taklit seçimi yalnız sahibinin ekranında görünür (s.39).',
    body: `${!hasServer ? '<div class="error">Oda sunucusu bu sürümde ayarlı değil. Şimdilik tek telefonla oynayabilirsin.</div>' : ''}
      ${saved ? `<div class="card"><b>${esc(saved.code)} odasına geri dön</b><p class="hint">${esc(saved.name)} olarak katılmıştın.</p>
        <div class="row" style="margin-top:10px">${primary('Odaya dön', 'onlineRejoin')}</div>
        <button class="btn ghost" data-act="onlineForget">Bu odayı unut</button></div>` : ''}
      <div class="field"><label>Adın</label>
        <div class="pl"><input data-in="oname" value="${esc(f.name)}" placeholder="Oyunda görünecek ad" maxlength="16" autocomplete="nickname" enterkeyhint="done"></div></div>
      <div class="card"><b>Oda kur</b><p class="hint">Kodu arkadaşlarına söyle ya da bağlantıyı paylaş.</p>
        <div style="margin-top:10px">${primary('Yeni oda kur', 'onlineCreate', busy || !hasServer ? 'disabled' : '')}</div></div>
      <div class="card"><b>Odaya katıl</b>
        <div class="pl" style="margin-top:8px"><input data-in="ocode" class="code-in" value="${esc(f.code)}" placeholder="KOD" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go"></div>
        <div style="margin-top:10px"><button class="btn teal" data-act="onlineJoin" ${busy || !hasServer ? 'disabled' : ''}>Katıl</button></div></div>
      ${busy ? '<p class="hint center">Bağlanıyor…</p>' : ''}
      ${err ? `<div class="error">${esc(err)}</div>` : ''}`,
  });
}

function shareBlock(r          , link        )         {
  return `<div class="room-code"><span class="lbl">ODA KODU</span><span class="code">${esc(r.code)}</span>
    <button class="btn outline small" data-act="share">Bağlantıyı paylaş</button>
    <p class="hint">${esc(link)}</p></div>`;
}

export function lobbyView(ui    , link        )         {
  const r = ui.online .room ;
  const L = r.lobby;
  const me = r.you;
  const priv = me.privileged;
  const dot = (on         ) => `<span class="dot ${on ? 'on' : ''}" title="${on ? 'bağlı' : 'bağlı değil'}"></span>`;
  const memberRow = (m                             , color        ) =>
    `<div class="member">${avatar(m.name, color)}<span class="nm">${esc(m.name)}${m.id === me.id ? ' <small>(sen)</small>' : ''}${m.id === r.hostId ? ' <small>★ kuran</small>' : ''}</span>${dot(m.online)}
      ${priv && m.id !== me.id ? `<button class="x" data-act="kick" data-id="${m.id}" aria-label="Çıkar">×</button>` : ''}</div>`;
  let people = '';
  if (L.mode === 'team') {
    people = L.teamNames
      .map((tn, i) => {
        const ms = r.members.filter((m) => m.team === i);
        const mine = r.members.find((m) => m.id === me.id)?.team === i;
        return `<div class="team-box" style="--c:${TEAM_COLORS[i]}">
          <div class="team-head"><span class="avatar" style="--c:${TEAM_COLORS[i]};width:32px;height:32px;font-size:15px">${'ABCD'[i]}</span>
            ${priv ? `<input data-in="lteam" data-t="${i}" value="${esc(tn)}" maxlength="18" aria-label="Takım adı">` : `<b style="flex:1;color:var(--purple);font-size:18px">${esc(tn)}</b>`}</div>
          ${ms.map((m) => memberRow(m, TEAM_COLORS[i])).join('') || '<p class="hint">Henüz kimse yok</p>'}
          ${mine ? '' : `<button class="add" data-act="myTeam" data-t="${i}">+ Bu takıma geç</button>`}</div>`;
      })
      .join('');
  } else {
    people = `<div class="card">${r.members.map((m, i) => memberRow(m, TEAM_COLORS[i % 4])).join('')}</div>
      ${r.members.length !== 2 ? `<div class="notice">Hızlı Rol iki kişiliktir; odada ${r.members.length} kişi var.</div>` : ''}`;
  }
  let settings = '';
  if (priv) {
    const s = L.team;
    const q = L.quick;
    settings = `<div class="field"><label>Oyun</label>${seg('mode', [['team', 'Takımlı'], ['quick', 'Hızlı Rol']], L.mode, 'oset')}</div>`;
    if (L.mode === 'team') {
      const players = r.members.length;
      const per = turnsPerPlayer(s.length, s.freeTurns);
      settings += `<div class="field"><label>Takım sayısı</label>${seg('teamCount', [['2', '2'], ['3', '3'], ['4', '4']], String(L.teamNames.length), 'oset')}</div>
        <div class="field"><label>Rol seçimi</label>${seg('roleSelect', [['wheel', 'Çark'], ['self', 'Kendi'], ['rival', 'Rakip'], ['sequential', 'Sırayla']], s.roleSelect, 'oset')}</div>
        <div class="field"><label>Uzunluk</label>${seg('length', [['fast', 'Hızlı 4'], ['long', 'Uzun 8'], ['free', 'Serbest']], s.length, 'oset')}
          ${s.length === 'free' ? `<div class="row" style="align-items:center"><span class="muted">Kişi başı tur</span>${seg('freeTurns', [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], String(s.freeTurns), 'oset')}</div>` : ''}</div>
        <div class="field"><label>Seviye</label>${seg('levelMode', [['basit', 'Basit'], ['orta', 'Orta'], ['hayal', 'Hayal'], ['ladder', 'Merdiven']], s.levelMode, 'oset')}</div>
        <div class="field"><label>Süre</label>${seg('timing', [['timed', 'Süreli'], ['untimed', 'Dakikasız']], s.timing, 'oset')}</div>
        <p class="hint">${players} oyuncu × ${per} tur = ${players * per} sahne</p>`;
    } else {
      const n0 = r.members[0]?.name ?? '1. oyuncu';
      const n1 = r.members[1]?.name ?? '2. oyuncu';
      settings += `<div class="field"><label>Kim kimle?</label>${seg('relation', [['ebeveyn', 'Ebeveyn-Evlat'], ['arkadas', 'Arkadaş'], ['partner', 'Partner']], q.relation, 'oset')}</div>
        ${q.relation === 'ebeveyn' ? `<div class="field"><label>Ebeveyn kim?</label>${seg('parentIndex', [['0', n0], ['1', n1]], String(q.parentIndex), 'oset')}</div>` : ''}
        <div class="field"><label>Karşılıklı taklit</label>${seg('imitation', [['on', 'Açık'], ['off', 'Kapalı']], q.imitation ? 'on' : 'off', 'oset')}</div>
        <div class="field"><label>Sahne süresi</label>${seg('durationSec', [['15', '15 sn'], ['30', '30 sn'], ['60', '60 sn']], String(q.durationSec), 'oset')}</div>`;
    }
  } else {
    const RS                         = { wheel: 'Çark', self: 'Oyuncu seçer', rival: 'Rakip seçer', sequential: 'Sırayla' };
    settings = `<div class="card"><b>${L.mode === 'team' ? 'Takımlı' : 'Hızlı Rol'}</b><p class="hint">${
      L.mode === 'team'
        ? `${L.teamNames.length} takım · ${RS[L.team.roleSelect]} · ${L.team.length === 'fast' ? 'Hızlı 4' : L.team.length === 'long' ? 'Uzun 8' : `Serbest ${L.team.freeTurns}`} · ${L.team.timing === 'timed' ? 'Süreli' : 'Dakikasız'}`
        : `${L.quick.relation === 'ebeveyn' ? 'Ebeveyn-Evlat' : L.quick.relation === 'arkadas' ? 'Arkadaş' : 'Partner'} · taklit ${L.quick.imitation ? 'açık' : 'kapalı'} · ${L.quick.durationSec} sn`
    }</p><p class="hint">Ayarları odayı kuran seçer.</p></div>`;
  }
  const err = ui.online?.error;
  return (
    netBanner(ui) +
    screen({
      kind: 'KURULUM',
      title: 'Oda',
      back: 'onlineBack',
      right: `${r.members.length}/${MAX_MEMBERS}`,
      help: 'Herkes kendi telefonundan katılır. Takımlıda takımını kendin seç; masada takımlar dönüşümlü otursun (s.4). Gizli oylar yalnız sunucuda tutulur (s.39).',
      body: `${shareBlock(r, link)}
        ${people}
        ${settings}
        ${err ? `<div class="error">${esc(err)}</div>` : ''}`,
      footer: priv
        ? `${primary('Oyunu başlat', 'onlineStart')}<p class="hint center">Herkes katılınca başlat.</p>`
        : `<p class="hint center">Odayı kuranın oyunu başlatması bekleniyor…</p>${secondary('Odadan çık', 'sheet', 'data-v="onlineLeave"')}`,
    })
  );
}

/** Başkasının gizli adımını bekleyen ekran. */
export function waitScreen(o                                                                                                                        )         {
  return screen({
    kind: 'MASA',
    title: o.title,
    back: o.back,
    help: o.help,
    body: `<div class="gate">${o.who ? `${avatar(o.who.name, o.who.color, 'lg')}<div class="who" style="font-size:34px">${esc(o.who.name)}</div>` : ''}
      <div class="dots"><span></span><span></span><span></span></div>${o.lines}</div>`,
    footer: o.footer,
  });
}

export function leaveSheet(ui    )         {
  if (ui.sheet !== 'onlineLeave') return '';
  const inGame = !!ui.online?.room?.game;
  return `<div class="overlay" data-act="closeSheet"><div class="sheet" data-stop><h2>${inGame ? 'Ana menüye dön?' : 'Odadan çık?'}</h2>
    <p>${inGame ? 'Oyun diğerleri için sürer. Menüden “Odaya dön” ile geri gelebilirsin; sen yokken odayı kuran senin yerine oy verebilir.' : 'Odadan çıkarsın; kodla yeniden katılabilirsin.'}</p>
    ${inGame ? primary('Ana menü', 'onlineDetach') : `<button class="btn danger" data-act="onlineLeave">Odadan çık</button>`}
    ${secondary('Vazgeç', 'closeSheet')}</div></div>`;
}
