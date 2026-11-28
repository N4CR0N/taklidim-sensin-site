// Hızlı Rol ekranları (s.34).
                                                    
                                     
import { QUICK_BY_ID } from './state.js';
import { esc, fmt1, gen, holdButton, primary, screen, secondary, upper } from './common.js';
import { currentVoter, PREP_SEC, VOTE_WINDOW_MS } from '../engine/quickrole.js';
import { QUICK_SCENARIOS, quickAverages, quickTotals, quickWinner } from '../engine/rules.js';
import { ring } from './teamviews.js';
import { ctxOf, netBanner, waitScreen } from './onlineviews.js';

const REL                         = { ebeveyn: 'Ebeveyn ↔ Evlat', arkadas: 'Arkadaş ↔ Arkadaş', partner: 'Partner ↔ Partner' };

const HELP                         = {
  card: 'Kart olayı ve iki rolü verir. Herkes kendi rolünü oynar ama karşısındakinin konuşması ve tavırlarıyla; puanı karşısındaki verir (s.16).',
  prep: 'Hazırlık 10 sn. Karşındakinin sözlerini, ses tonunu, jestlerini düşün. Abartı serbest, alay yok (s.17).',
  scene: 'İkiniz aynı anda oynarsınız. Kırmızı Kart veya “Rahatsız oldum” sahneyi iptal eder, ceza yok (s.16).',
  voteGate: 'Oy gizli. Sırayla: önce biri, sonra telefon diğerine geçer (s.17).',
  voteInput: '5 saniyede bir sayıya dokun. Basmazsan oy otomatik 10 gider (s.16).',
  roundResult: '10 rol (5 senaryo × 2 rol) sonunda toplam puanı yüksek olan kazanır (s.16).',
  final: 'Eşitlikte Altın Sahne oynanır. Unvan: Taklit Ustası (s.16).',
};

                
                
                
               
                 
 

/** Bu senaryoda kim hangi rolü oynuyor. */
export function sides(g           )               {
  const sc = g.scenarios[g.scenarios.length - 1];
  const card = QUICK_BY_ID[sc.cardId];
  const a = sc.roleAPlayer;
  const b = (1 - a)         ;
  const labelA = g.relation === 'ebeveyn' ? 'EVLAT' : g.relation === 'arkadas' ? 'ARKADAŞ A' : 'PARTNER A';
  const labelB = g.relation === 'ebeveyn' ? 'EBEVEYN' : g.relation === 'arkadas' ? 'ARKADAŞ B' : 'PARTNER B';
  const sA       = { player: a, label: labelA, role: card.roleA, stage: card.childStage };
  const sB       = { player: b, label: labelB, role: card.roleB };
  return a === 0 ? [sA, sB] : [sB, sA];
}

const nm = (g           , i        )         => g.players[i].name;

/** Rolü kimin tarzıyla oynayacağı: "Said gibi oyna: sesi, jestleri, lafları". */
function styleLine(g           , i       )         {
  if (!g.imitation) return 'Kendi tarzınla oyna';
  const other = nm(g, 1 - i);
  const who = g.relation === 'ebeveyn' ? `${i === g.parentIndex ? 'evladın' : 'ebeveynin'} ${other}` : other;
  return `…ama ${who} gibi oyna: sesi, jestleri, lafları`;
}

/** Kartın altındaki tek satırlık "ne yapıyoruz" açıklaması. */
function howLine(g           )         {
  return g.imitation
    ? 'İkiniz bu olayı aynı anda, karşılıklı oynarsınız. Herkes kendi rolündedir ama karşısındakinin kılığında. Sahne bitince herkes, karşısındakinin kendisini ne kadar iyi yansıttığını puanlar.'
    : 'İkiniz bu olayı aynı anda, karşılıklı oynarsınız. Sahne bitince herkes, karşısındakinin rolünü ne kadar inandırıcı oynadığını puanlar.';
}

function duo(g           )         {
  const ss = sides(g);
  return `<div class="duo">${ss
    .map(
      (s) => `<div class="side"><span class="who">${esc(upper(nm(g, s.player)))} OYNAR</span>
        <span class="role">${esc(s.label)}${s.stage ? ` <span class="chip">${esc(s.stage)}</span>` : ''}</span>
        <span>${esc(s.role)}</span><span class="imi">${esc(styleLine(g, s.player))}</span></div>`,
    )
    .join('')}</div>`;
}

/** Hazırlık ve sahne ekranında kısa hatırlatma: kim, hangi rol, kimin gibi. */
function roleList(g           )         {
  return `<div class="roles">${sides(g)
    .map(
      (s) => `<div class="rl"><b>${esc(nm(g, s.player))}</b> → ${esc(s.role)}${s.stage ? ` <span class="chip">${esc(s.stage)}</span>` : ''}
        <span class="imi">${esc(styleLine(g, s.player))}</span></div>`,
    )
    .join('')}</div>`;
}

export function quickGameView(ui    , g           , now        )         {
  return netBanner(ui) + quickPhaseView(ui, g, now);
}

function quickPhaseView(ui    , g           , now        )         {
  const on = ctxOf(ui);
  const BACK = on ? 'onlineBack' : 'askQuit';
  const help = HELP[g.phase];
  const sc = g.scenarios[g.scenarios.length - 1];
  const card = QUICK_BY_ID[sc.cardId];
  const regularDone = g.scenarios.filter((s) => !s.golden).length;
  const label = sc.golden ? 'Altın Sahne' : `${regularDone} / ${QUICK_SCENARIOS}`;
  switch (g.phase) {
    case 'card':
      return screen({
        kind: 'MASA',
        title: 'Senaryo',
        right: label,
        back: BACK,
        help,
        body: `<div class="scenario"><span class="chip">${esc(REL[g.relation])}</span><h2>${esc(upper(card.title))}</h2><p class="sit">${esc(card.situation)}</p></div>
          ${duo(g)}
          <p class="how">${esc(howLine(g))}</p>
          ${g.relation === 'ebeveyn' ? '<p class="hint">Rol takası: ebeveyn evladı, evlat ebeveyni oynar. Okul düzeyi yalnız Evlat rolünde yazar.</p>' : ''}`,
        footer: `${primary('Hazırız', 'q', 'data-a="ready"')}${secondary('Bu kartı geç', 'qCancel')}`,
      });
    case 'prep': {
      const left = Math.max(0, PREP_SEC * 1000 - (now - ui.prepAt));
      return screen({
        kind: 'MASA',
        title: 'Reels hazırlığı',
        back: BACK,
        help,
        body: `<div class="row" style="align-items:center"><div class="frame916">9:16<br>dikey çerçeve</div>
            <div>${ring(left, PREP_SEC * 1000, 'qprep')}</div></div>
          <p class="scenario-mini"><b>${esc(card.title)}:</b> ${esc(card.situation)}</p>
          ${roleList(g)}
          <p class="hint center">${g.imitation ? 'Karşındakinin konuşmasını, ses tonunu, jestlerini düşün. ' : ''}Sahne ${g.durationSec} sn · Kamerayı başka bir telefondan aç; uygulama kayıt yapmaz.</p>`,
        footer: primary('3, 2, 1 … Başlat', 'qStart'),
      });
    }
    case 'scene': {
      const left = g.durationSec * 1000 - (now - (g.clock.startedAt ?? now));
      return screen({
        kind: 'MASA',
        title: upper(card.title),
        help,
        body: `<p class="scene-sub"><b>Oynayın!</b> ${esc(card.situation)}</p>
          <div class="clock ${left <= 5000 ? 'warn' : ''}" data-clock="qscene">${Math.max(0, Math.ceil(left / 1000))}</div>
          ${roleList(g)}
          <p class="hint center">Süre bitince puanlamaya geçilir. Erken biterse “Sahne bitti”ye basın.</p>`,
        footer: `${primary('Sahne bitti', 'q', 'data-a="sceneEnd"')}<button class="btn danger small" data-act="qCancel">Kırmızı Kart</button>`,
      });
    }
    case 'voteGate': {
      if (on) {
        // İkisi aynı anda, kendi telefonunda oy verir (s.39). 5 saniye sunucu saatiyle.
        const me = on.me === '0' || on.me === '1' ? (Number(on.me)         ) : null;
        const opened = on.voteOpenedAt ?? now;
        const left = VOTE_WINDOW_MS - (now - opened);
        if (me !== null && !on.voted.includes(String(me)) && left > -800) {
          const other = nm(g, 1 - me);
          const q = g.imitation ? `${esc(other)} seni ne kadar iyi yansıttı?` : `${esc(other)} rolünü ne kadar inandırıcı oynadı?`;
          return screen({
            kind: 'GİZLİ',
            title: nm(g, me),
            help: HELP.voteInput,
            body: `<p class="center" style="font-size:22px;font-weight:800;color:var(--purple)">${q}</p>
              ${ring(Math.max(0, left), VOTE_WINDOW_MS, 'qvote')}
              <div class="grid10">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button data-act="qVote" data-v="${n}">${n}</button>`).join('')}</div>
              <p class="hint center">5 saniyede basmazsan oy otomatik 10 gider. ${esc(other)} de şu an seni puanlıyor.</p>`,
          });
        }
        return waitScreen({
          title: 'Oylar',
          back: BACK,
          help,
          lines: `<p>${me !== null && on.voted.includes(String(me)) ? 'Oyun alındı.' : 'Oy süresi doldu.'} Sonuç birazdan.</p>`,
        });
      }
      const v = currentVoter(g);
      return screen({
        kind: 'GİZLİ',
        back: BACK,
        help,
        body: `<div class="gate"><div class="to">TELEFONU VER</div><div class="who">${esc(upper(nm(g, v)))}</div>
          <p>Oy gizli. 5 saniyen olacak.</p><p class="muted">oy ${g.voteCursor + 1} / 2</p></div>`,
        footer: holdButton(`Ben ${nm(g, v)}`, 'qOpenVote'),
      });
    }
    case 'voteInput': {
      const v = currentVoter(g);
      const other = nm(g, 1 - v);
      const left = VOTE_WINDOW_MS - (now - (g.voteOpenedAt ?? now));
      const q = g.imitation ? `${esc(other)} seni ne kadar iyi yansıttı?` : `${esc(other)} rolünü ne kadar inandırıcı oynadı?`;
      return screen({
        kind: 'GİZLİ',
        title: nm(g, v),
        help,
        body: `<p class="center" style="font-size:22px;font-weight:800;color:var(--purple)">${q}</p>
          ${ring(left, VOTE_WINDOW_MS, 'qvote')}
          <div class="grid10">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button data-act="qVote" data-v="${n}">${n}</button>`).join('')}</div>
          <p class="hint center">5 saniyede basmazsan oy otomatik 10 gider. Oy gizli${g.imitation ? ' · taklit edilen puanlar' : ''}.</p>`,
      });
    }
    case 'roundResult': {
      const [t0, t1] = quickTotals(g, sc.golden);
      const autos = [0, 1]
        .filter((i) => sc.auto[i])
        .map((i) => `<p class="notice">${esc(gen(nm(g, 1 - i)))} oyu otomatik 10 gitti.</p>`)
        .join('');
      const isLast = !sc.golden && regularDone >= QUICK_SCENARIOS;
      return screen({
        kind: 'MASA',
        title: sc.golden ? 'Altın Sahne sonucu' : `Senaryo ${regularDone} / ${QUICK_SCENARIOS}`,
        back: BACK,
        help,
        body: `<div class="vs">${[0, 1]
            .map((i) => `<div class="card"><div class="nm">${esc(nm(g, i))}</div><div class="pt">${sc.received[i] ?? '-'}</div><p class="hint">bu sahne</p></div>`)
            .join('')}</div>
          ${autos}
          ${g.remind ? '<div class="notice"><b>Hızlı karar ver!</b> Üst üste 3 oy otomatik 10 gitti.</div>' : ''}
          <div class="card center"><b>Toplam</b><p>${esc(nm(g, 0))} ${t0} · ${esc(nm(g, 1))} ${t1}</p></div>`,
        footer: primary(isLast || sc.golden ? 'Sonucu gör' : 'Sonraki senaryo', 'q', 'data-a="next"'),
      });
    }
    case 'final': {
      const [t0, t1] = quickTotals(g);
      const w = quickWinner(g);
      const [a0, a1] = quickAverages(g);
      const name = (i        ) => (ui.hideNames ? (i === 0 ? 'Oyuncu 1' : 'Oyuncu 2') : nm(g, i));
      const golden = g.scenarios.filter((s) => s.golden).length;
      return screen({
        kind: 'MASA',
        title: '10 ROL TAMAM',
        help,
        body: `<div class="podium"><div class="crown">${w === null ? 'BERABERE' : 'KAZANAN'}</div>
            <div class="win">${w === null ? '' : esc(name(w))}</div>
            ${w !== null && g.imitation ? '<div class="titles"><span class="chip">Taklit Ustası</span></div>' : ''}</div>
          <div class="vs">${[0, 1]
            .map((i) => `<div class="card ${w === i ? 'w' : ''}"><div class="nm">${esc(name(i))}</div><div class="pt">${i === 0 ? t0 : t1}</div><p class="hint">ortalama ${fmt1(i === 0 ? a0 : a1)}</p></div>`)
            .join('')}</div>
          ${golden ? `<p class="hint center">Eşitlik ${golden} Altın Sahne ile bozuldu.</p>` : ''}
          <p class="hint center">Puan = ${g.imitation ? 'taklit kalitesi' : 'inandırıcılık'} (rakibin verdiği). Reels için ekran görüntüsü al; paylaşmadan önce ikinizin de izni olsun.</p>
          <button class="btn ghost" data-act="toggleNames">${ui.hideNames ? 'İsimleri göster' : 'İsimleri gizle'}</button>`,
        footer: on
          ? on.priv
            ? `${primary('Yeni 10 rol', 'onlineRestart')}${secondary('Lobiye dön', 'onlineToLobby')}${secondary('Ana menü', 'sheet', 'data-v="onlineLeave"')}`
            : `<p class="hint center">Yeni oyunu odayı kuran başlatır.</p>${secondary('Ana menü', 'sheet', 'data-v="onlineLeave"')}`
          : `${primary('Yeni 10 rol', 'replayQuick')}${secondary('Ana menü', 'quitToMenu')}`,
      });
    }
    default:
      return screen({ kind: 'MASA', body: '', footer: primary('Ana menü', 'home') });
  }
}

export function quickSheets(ui    )         {
  if (ui.sheet !== 'confirmQuit') return '';
  return `<div class="overlay" data-act="closeSheet"><div class="sheet" data-stop><h2>Ana menüye dön?</h2><p>Oyun kayıtlı kalır; menüden devam edebilirsin.</p>
    ${primary('Ana menü', 'quitToMenu')}${secondary('Vazgeç', 'closeSheet')}</div></div>`;
}
