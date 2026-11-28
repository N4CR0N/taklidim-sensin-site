// Ortak arayüz yardımcıları: kaçış, sayı biçimi, ekran iskeleti, çark.

export const esc = (s         )         =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]          );

export const fmt1 = (n        )         => n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const upper = (s        )         => s.toLocaleUpperCase('tr');

                                                      

                             
                   
                 
                            
                                                           
                
               
                  
               
 

/** Her ekran: üst çubuk (geri, başlık, ?), gövde, altta sabit ana buton alanı (s.26). */
export function screen(o            )         {
  const helpBtn = o.help ? `<button class="icon" data-act="toggleHelp" aria-label="Kural">?</button>` : '<span class="icon-space"></span>';
  return `
  <div class="screen ${o.cls ?? ''} kind-${o.kind === 'GİZLİ' ? 'secret' : o.kind === 'MASA' ? 'table' : 'setup'}">
    <header class="bar">
      ${o.back ? `<button class="icon" data-act="${o.back}" aria-label="Geri">‹</button>` : '<span class="icon-space"></span>'}
      <div class="bar-title">${o.title ? esc(o.title) : ''}</div>
      <div class="bar-right">${o.right ? `<span>${esc(o.right)}</span>` : ''}${helpBtn}</div>
    </header>
    ${o.help ? `<div class="help" role="note"><b>Kural</b> ${o.help}</div>` : ''}
    <main class="body">${o.body}</main>
    ${o.footer ? `<footer class="foot">${o.footer}</footer>` : ''}
    <div class="kind-tag">${o.kind}</div>
  </div>`;
}

export const primary = (label        , act        , extra = '')         =>
  `<button class="btn primary" data-act="${act}" ${extra}>${esc(label)}</button>`;

export const secondary = (label        , act        , extra = '')         =>
  `<button class="btn ghost" data-act="${act}" ${extra}>${esc(label)}</button>`;

/** 1 sn basılı tutunca açılan kapı butonu (s.35: yanlışlıkla açılmaz). */
export const holdButton = (label        , act        )         =>
  `<button class="btn primary hold" data-hold="${act}"><span class="hold-fill"></span><span class="hold-label">${esc(label)}</span></button>
   <p class="hint center">Açmak için 1 saniye basılı tut</p>`;

export const TEAM_COLORS = ['var(--coral)', 'var(--teal)', 'var(--yellow)', 'var(--violet)'];

export function avatar(name        , color        , size = '')         {
  const ch = upper(name.trim().charAt(0) || '?');
  return `<span class="avatar ${size}" style="--c:${color}">${esc(ch)}</span>`;
}

export function seg(name        , options                    , value        , act = 'set')         {
  return `<div class="seg">${options
    .map(([v, l]) => `<button class="${v === value ? 'on' : ''}" data-act="${act}" data-k="${name}" data-v="${esc(v)}">${esc(l)}</button>`)
    .join('')}</div>`;
}

// ---------- Çark (s.7) ----------

const SLICES = ['1', '2', '3', '4', '5', '6', 'JOKER', 'ZOR ROL'];
const SLICE_COLORS = ['#FF5A5F', '#17B8A6', '#FFC93C', '#7B4BC9', '#FF5A5F', '#17B8A6', '#3B1F6E', '#FFC93C'];

/** n (1-8) dilimini üstteki işaretin altına getiren açı. */
export function wheelAngleFor(n        , from        )         {
  const center = (n - 0.5) * 45;
  const base = from - (((from % 360) + 360) % 360);
  return base + 360 * 5 + (360 - center);
}

export function wheel(from        , to        )         {
  const r = 100;
  const parts           = [];
  for (let i = 0; i < 8; i++) {
    const a0 = ((i * 45 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * 45 - 90) * Math.PI) / 180;
    const x0 = 110 + r * Math.cos(a0);
    const y0 = 110 + r * Math.sin(a0);
    const x1 = 110 + r * Math.cos(a1);
    const y1 = 110 + r * Math.sin(a1);
    const am = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
    const lx = 110 + 66 * Math.cos(am);
    const ly = 110 + 66 * Math.sin(am);
    const label = SLICES[i];
    const small = label.length > 1;
    const textColor = SLICE_COLORS[i] === '#FFC93C' ? '#3B1F6E' : '#fff';
    parts.push(
      `<path d="M110 110 L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${SLICE_COLORS[i]}" stroke="#FFF8EC" stroke-width="2"/>` +
        `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="${textColor}" font-size="${small ? 11 : 22}" font-weight="800" text-anchor="middle" dominant-baseline="middle" transform="rotate(${i * 45 + 22.5} ${lx.toFixed(1)} ${ly.toFixed(1)})">${small ? label.replace(' ', ' ') : label}</text>`,
    );
  }
  return `<div class="wheel-wrap"><div class="wheel-pin"></div>
    <svg class="wheel" viewBox="0 0 220 220" data-wheel data-from="${from}" data-to="${to}" style="transform:rotate(${from}deg)" aria-hidden="true">
      ${parts.join('')}<circle cx="110" cy="110" r="16" fill="#FFF8EC"/></svg></div>`;
}

export const LEVEL_LABEL                         = { basit: 'Basit', orta: 'Orta', hayal: 'Hayalperest' };

// ---------- Türkçe ek (kişi adları için) ----------

const V = 'aeıioöuü';
function lastVowel(w        )         {
  const s = w.toLocaleLowerCase('tr');
  for (let i = s.length - 1; i >= 0; i--) if (V.includes(s[i])) return s[i];
  return 'e';
}
const endsVowel = (w        )          => V.includes(w.slice(-1).toLocaleLowerCase('tr'));
const four                         = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' };

/** İlgi hâli: Ayşe'nin, Can'ın */
export const gen = (n        )         => `${n}'${endsVowel(n) ? 'n' : ''}${four[lastVowel(n)]}n`;
/** Yönelme: Eda'ya, Mert'e */
export const dat = (n        )         => `${n}'${endsVowel(n) ? 'y' : ''}${'aıou'.includes(lastVowel(n)) ? 'a' : 'e'}`;
/** Belirtme: Ayşe'yi, Can'ı */
export const acc = (n        )         => `${n}'${endsVowel(n) ? 'y' : ''}${four[lastVowel(n)]}`;
