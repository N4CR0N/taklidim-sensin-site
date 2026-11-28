// Kurulum ekranları: ana menü, biçim, oyuncular/takımlar, rol seçimi, ayarlar, Hızlı Rol kurulumu, kurallar.
                                     
import { esc, primary, screen, secondary, seg, TEAM_COLORS } from './common.js';
import { TEAM_LETTERS } from '../engine/team.js';
import { turnsPerPlayer } from '../engine/rules.js';
import { serverUrl } from './net.js';

export function menuView(ui    , hasSaved         , build        )         {
  return screen({
    kind: 'KURULUM',
    body: `
      <div class="logo"><div class="t1">TAKLİDİM</div><div class="t2">SENSİN</div>
        <div class="sub">Rol yap, taklit et, gizlice puanla.</div></div>
      ${hasSaved ? `<div class="card"><b>Yarım kalan oyun var.</b><p class="hint">Kaldığın turdan devam edebilirsin.</p>
        <div class="row" style="margin-top:10px">${primary('Oyuna devam et', 'resume')}</div>
        <button class="btn ghost" data-act="discardSaved">Sil ve yeni başla</button></div>` : ''}
      <div class="menu-links">
        ${secondary('Nasıl oynanır?', 'go', 'data-v="rules"')}
      </div>
      <p class="version">Prototip · ${esc(build)} · telefonu dik tutun</p>`,
    footer: `${primary('Tek telefonla oyna', 'go', 'data-v="format"')}
      ${
        serverUrl()
          ? `<button class="btn teal" data-act="go" data-v="onlineHome">Online oyna</button>
      <p class="hint center">Online: herkes kendi telefonundan, uygulama ya da siteden katılır.</p>`
          : ''
      }`,
  });
}

export function formatView()         {
  const c = (act        , ic        , title        , sub        , badge = '', disabled = false) =>
    `<button class="choice" ${disabled ? 'disabled' : `data-act="${act}"`}><span class="ic">${ic}</span>
      <span class="tx"><b>${esc(title)}</b><span>${esc(sub)}</span></span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
  return screen({
    kind: 'KURULUM',
    title: 'Oyun biçimi',
    back: 'home',
    help: 'Takımlıda takımlar yarışır, rakipler puanlar. Hızlı Rol iki kişiliktir, çarksızdır, 10 rolde biter (s.3).',
    body: `<div class="choices">
      ${c('pickTeam', 'A·B', 'Takımlı', 'Takımlar yarışır, rakipler gizlice puanlar')}
      ${c('pickQuick', '⚡', 'Hızlı Rol · Reels', '1v1, çarksız, karşılıklı taklit, 10 rolde biter', 'YENİ')}
      ${c('', '1', 'Tek Tek', 'Herkes kendi adına oynar', 'YAKINDA', true)}
      ${c('', '2', 'Takımlı Çift Rol', 'Takımdaki iki kişi tek rolü birlikte oynar', 'YAKINDA', true)}
    </div>
    <p class="hint">Bu prototipte: Arkadaşlarla kategorisi, Klasik havuz, Türkçe, Serbest puanlama.</p>`,
  });
}

export function teamPlayersView(ui    )         {
  const t = ui.team;
  const boxes = t.teams
    .map((team, ti) => {
      const rows = team.players
        .map(
          (name, pi) => `<div class="pl"><input data-in="player" data-t="${ti}" data-p="${pi}" value="${esc(name)}" placeholder="Oyuncu adı" maxlength="16" autocomplete="off" enterkeyhint="next">
          ${team.players.length > 2 ? `<button class="x" data-act="delPlayer" data-t="${ti}" data-p="${pi}" aria-label="Sil">×</button>` : ''}</div>`,
        )
        .join('');
      return `<div class="team-box" style="--c:${TEAM_COLORS[ti]}">
        <div class="team-head"><span class="avatar" style="--c:${TEAM_COLORS[ti]};width:32px;height:32px;font-size:15px">${TEAM_LETTERS[ti]}</span>
          <input data-in="teamName" data-t="${ti}" value="${esc(team.name)}" maxlength="18" aria-label="Takım adı">
          ${t.teams.length > 2 ? `<button class="x" data-act="delTeam" data-t="${ti}" aria-label="Takımı sil">×</button>` : ''}</div>
        ${rows}
        ${team.players.length < 6 ? `<button class="add" data-act="addPlayer" data-t="${ti}">+ Oyuncu ekle</button>` : ''}
        <p class="hint">Okuyucu / Sayman: takım arkadaşı</p></div>`;
    })
    .join('');
  const count = t.teams.reduce((a, x) => a + x.players.filter((n) => n.trim()).length, 0);
  return screen({
    kind: 'KURULUM',
    title: 'Oyuncular',
    right: '1/3',
    back: 'go" data-v="format',
    help: 'Her takımda en az 2 oyuncu olur, çünkü sahnedeki oyuncunun takım arkadaşı Okuyucudur. Takımlar dönüşümlü oturur: A, B, A, B (s.4).',
    body: `${boxes}
      ${t.teams.length < 4 ? `<button class="btn outline small" data-act="addTeam">+ Takım ekle</button>` : ''}
      <p class="hint">${count} oyuncu · ${t.teams.length} takım. Telefon saat yönünde dolaşır; masada takımlar dönüşümlü otursun.</p>
      ${ui.error ? `<div class="error">${esc(ui.error)}</div>` : ''}`,
    footer: `${primary('Devam', 'teamNext1')}
      <button class="btn ghost" data-act="quickStartTeam">Hızlı Başlangıç (varsayılan ayarlarla başla)</button>`,
  });
}

export function teamRolesView(ui    )         {
  const v = ui.team.settings.roleSelect;
  const c = (val        , title        , sub        ) =>
    `<button class="choice ${v === val ? 'on' : ''}" data-act="set" data-k="roleSelect" data-v="${val}"><span class="tx"><b>${title}</b><span>${sub}</span></span></button>`;
  return screen({
    kind: 'KURULUM',
    title: 'Rol seçimi',
    right: '2/3',
    back: 'go" data-v="teamPlayers',
    help: 'Çarkta 1-6 rol, 7 Joker (sen seçersin), 8 Zor Rol (rakipler seçer). Çark dışındaki seçeneklerde Veto yerine oyun başına 1 "Rol değiştir" hakkı vardır (s.7).',
    body: `<div class="choices">
      ${c('wheel', 'Çark', 'Rolü çark belirler (Joker ve Zor Rol dahil). Sürpriz isteyenler için.')}
      ${c('self', 'Oyuncu seçer', 'Sıradaki oyuncu rolünü kendisi seçer. Yeni başlayanlar için.')}
      ${c('rival', 'Rakip seçer', 'Rakipler ona bir rol verir. Rekabetçi gruplar için.')}
      ${c('sequential', 'Sırayla', 'Roller 1’den 6’ya tekrarsız dağıtılır.')}
    </div>`,
    footer: primary('Devam', 'go', 'data-v="teamSettings"'),
  });
}

export function teamSettingsView(ui    )         {
  const s = ui.team.settings;
  const players = ui.team.teams.reduce((a, x) => a + x.players.filter((n) => n.trim()).length, 0);
  const per = turnsPerPlayer(s.length, s.freeTurns);
  const mins = players * per * 4;
  const sizes = ui.team.teams.map((t) => t.players.filter((n) => n.trim()).length);
  const fewest = Math.min(...sizes.map((n) => players - n));
  return screen({
    kind: 'KURULUM',
    title: 'Oyun ayarı',
    right: '3/3',
    back: 'go" data-v="teamRoles',
    help: 'Hızlı: kişi başı 4 tur, Uzun: 8 tur. Merdiven: seviye her oyuncunun turuyla Basit → Orta → Hayalperest ilerler. Tur başına ortalama 4 dk (s.8, s.10).',
    body: `
      <div class="field"><label>Uzunluk</label>${seg('length', [['fast', 'Hızlı 4'], ['long', 'Uzun 8'], ['free', 'Serbest']], s.length)}
        ${s.length === 'free' ? `<div class="row" style="align-items:center"><span class="muted">Kişi başı tur</span>${seg('freeTurns', [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], String(s.freeTurns))}</div>` : ''}</div>
      <div class="field"><label>Seviye</label>${seg('levelMode', [['basit', 'Basit'], ['orta', 'Orta'], ['hayal', 'Hayal'], ['ladder', 'Merdiven']], s.levelMode)}</div>
      <div class="field"><label>Süre</label>${seg('timing', [['timed', 'Süreli'], ['untimed', 'Dakikasız']], s.timing)}
        <p class="hint">${s.timing === 'timed' ? 'Süre kartta yazar (1-5 dk). 30 sn kala uyarı, bitince 5 sn tolerans.' : 'Süre sınırı yok. Ana Oyuncu “Perde” der; çok uzarsa rakiplerin çoğunluğu “Uzadı” der.'}</p></div>
      <div class="card"><b>Özet</b><p class="hint" style="margin-top:4px">Arkadaşlarla · Klasik · Türkçe · Serbest puan (1-10) ·
        ${players} oyuncu × ${per} tur = ${players * per} sahne · tahmini ${mins >= 60 ? `${Math.floor(mins / 60)} sa ${mins % 60 ? `${mins % 60} dk` : ''}` : `${mins} dk`}</p></div>
      ${fewest <= 2 ? `<div class="notice">Bazı sahneleri yalnız ${fewest} rakip puanlayacak. Ortalama açıklanınca oylar tahmin edilebilir; mümkünse 3 veya daha çok takım kurun (s.35, s.40).</div>` : ''}`,
    footer: primary('Oyunu başlat', 'startTeam'),
  });
}

export function quickSetupView(ui    )         {
  const q = ui.quick;
  const rel = (val        , ic        , title        , sub        ) =>
    `<button class="choice ${q.relation === val ? 'on' : ''}" data-act="qset" data-k="relation" data-v="${val}"><span class="ic">${ic}</span><span class="tx"><b>${title}</b><span>${sub}</span></span></button>`;
  const [a, b] = q.names;
  return screen({
    kind: 'KURULUM',
    title: 'Hızlı Rol',
    back: 'go" data-v="format',
    help: 'Kart hem olayı hem iki rolü verir. İkiniz aynı anda oynarsınız. Taklit açıkken taklit edilen kişi, onu taklit edeni puanlar: “Seni ne kadar iyi yansıttı?” (s.16).',
    body: `
      <div class="field"><label>Kim kimle oynuyor?</label><div class="choices">
        ${rel('ebeveyn', 'E↔E', 'Ebeveyn ↔ Evlat', 'Rol takası: ebeveyn evladı, evlat ebeveyni taklit eder')}
        ${rel('arkadas', 'A↔A', 'Arkadaş ↔ Arkadaş', 'Birbirinizi taklit edersiniz')}
        ${rel('partner', 'P↔P', 'Partner ↔ Partner', 'Birbirinizi taklit edersiniz')}
      </div></div>
      <div class="field"><label>Oyuncular</label>
        <div class="pl"><input data-in="qname" data-i="0" value="${esc(a)}" placeholder="1. oyuncu" maxlength="16" autocomplete="off"></div>
        <div class="pl"><input data-in="qname" data-i="1" value="${esc(b)}" placeholder="2. oyuncu" maxlength="16" autocomplete="off"></div></div>
      ${q.relation === 'ebeveyn' ? `<div class="field"><label>Ebeveyn kim?</label>${seg('parentIndex', [['0', a.trim() || '1. oyuncu'], ['1', b.trim() || '2. oyuncu']], String(q.parentIndex), 'qset')}</div>` : ''}
      <div class="field"><label>Karşılıklı taklit</label>${seg('imitation', [['on', 'Açık'], ['off', 'Kapalı']], q.imitation ? 'on' : 'off', 'qset')}</div>
      <div class="field"><label>Sahne süresi</label>${seg('durationSec', [['15', '15 sn'], ['30', '30 sn'], ['60', '60 sn']], String(q.durationSec), 'qset')}</div>
      ${ui.error ? `<div class="error">${esc(ui.error)}</div>` : ''}`,
    footer: primary('Başla', 'startQuick'),
  });
}

export function rulesView()         {
  const li = (s        ) => `<li style="margin-bottom:6px">${s}</li>`;
  return screen({
    kind: 'KURULUM',
    title: 'Nasıl oynanır?',
    back: 'home',
    body: `<div class="card"><h3>Takımlı</h3><ol style="padding-left:20px;margin:8px 0 0">
      ${li('Sıradaki oyuncu <b>Ana Oyuncu</b> olur; takım arkadaşı <b>Okuyucu</b> kartı sesli okur.')}
      ${li('Çark rolü verir: 1-6 kartta yazan rol, 7 <b>Joker</b> (sen seç), 8 <b>Zor Rol</b> (rakipler seçer). Veto: kişi başı 1, kartı veya çarkı değiştirir.')}
      ${li('İstersen gizlice bir arkadaşını <b>taklit</b> edersin (jeton harcar).')}
      ${li('Sahneyi oyna. Hayalperest kartlarda süre yarılanınca <b>Dönüş</b> gelir.')}
      ${li('Telefon rakiplere tek tek gider: 1-10 gizli puan ve “taklit edilen kimdi?” tahmini.')}
      ${li('Rakiplerin en az yarısı doğru tahmin eder ve taklit edilen “beni yansıttı” derse tur puanının <b>yarısı bonus</b>.')}
      ${li('En çok puanı toplayan takım kazanır. Kırmızı Kart sahneyi anında durdurur, ceza yoktur.')}
      </ol></div>
      <div class="card"><h3>Hızlı Rol</h3><ol style="padding-left:20px;margin:8px 0 0">
      ${li('İki kişi, çark yok. Kart olayı ve iki rolü verir; ikiniz aynı anda oynarsınız.')}
      ${li('Karşılıklı taklit: herkes rolünü karşısındakinin tarzıyla oynar. Ebeveyn-Evlat’ta rol takası vardır.')}
      ${li('Sahneden sonra taklit edilen, taklit edeni 1-10 puanlar. 5 saniyede basmazsan oy otomatik 10 gider.')}
      ${li('5 senaryo × 2 rol = 10 rol. Toplamı yüksek olan kazanır; eşitlikte Altın Sahne.')}
      </ol></div>
      <p class="hint">Kaynak: Taklidim Sensin oyun kılavuzu v2.1. Taklit sevgiyle yapılır; alay yok.</p>`,
    footer: primary('Tamam', 'home'),
  });
}
