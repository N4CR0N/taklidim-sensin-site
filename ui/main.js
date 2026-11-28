// Uygulama girişi: durum, olaylar, sayaçlar, kayıt. Kurallar engine/'da, ekranlar *views.ts'de.
                                                                             
                                                    
                                                          
import { createTeamGame, teamReduce, validateSetup } from '../engine/team.js';
import { createQuickGame, quickReduce, validateQuick, PREP_SEC as QUICK_PREP_SEC, VOTE_WINDOW_MS } from '../engine/quickrole.js';
import { newSeed } from '../engine/rng.js';
import { CLASSIC } from '../data/classic.js';
import { QUICK } from '../data/quick.js';
import { CLASSIC_BY_ID, initialUI } from './state.js';
                                           
import { wheelAngleFor } from './common.js';
import { formatView, menuView, quickSetupView, rulesView, teamPlayersView, teamRolesView, teamSettingsView } from './setupviews.js';
import { mmss, PREP_SEC, PREP_UNTIMED_SEC, sceneTiming, teamGameView } from './teamviews.js';
import { quickGameView, quickSheets } from './quickviews.js';
import { keepAwake, onBackButton, vibrate } from './platform.js';
import { forgetSeat, Net, savedSeat, serverUrl } from './net.js';
                                          
import { leaveSheet, lobbyView, onlineHomeView } from './onlineviews.js';
import { gameKey, nextDeadline, validCode } from '../online/room.js';
                                                                   

const KEY_GAME = 'taklidim.v1.game';
const KEY_DRAFT = 'taklidim.v1.draft';
const SPIN_MS = 2700;
const BUILD         = (globalThis                          ).__BUILD__ ?? 'dev';

const root = document.getElementById('app')               ;
const ui     = initialUI();
const KEY_NAME = 'taklidim.v1.name';
const SITE         = (globalThis                         ).__SITE__ ?? '';

// ---------- online ----------

let net             = null;
let toastTimer                    ;
let lastTickSent = 0;

const serverNow = ()         => Date.now() + (ui.online?.offset ?? 0);
const siteBase = ()         => (SITE && !SITE.startsWith('%') ? SITE : location.origin + location.pathname);
const roomLink = (code        )         => `${siteBase().replace(/[?#].*$/, '')}?oda=${code}`;

function toast(msg        )       {
  if (!ui.online) return;
  ui.online.error = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (ui.online && ui.online.error === msg && ui.view !== 'onlineHome') {
      ui.online.error = null;
      render();
    }
  }, 3500);
  render();
}

function send(msg           )       {
  if (!net || !net.send(msg)) toast('Bağlantı yok; birazdan yeniden dene.');
}

function connect(code               , token               )       {
  net?.close(false);
  ui.online = { room: null, status: 'connecting', offset: 0, error: null, proxyAs: null, proxyOpen: false, proxyPick: null, spinSeq: -1, twistSeen: '', busy: true };
  ui.view = 'onlineHome';
  ui.sheet = null;
  const conn      = new Net(serverUrl(), { code, name: ui.form.name.trim(), token }, {
    onState: (v) => net === conn && onState(v),
    onError: (m, c) => net === conn && onNetError(m, c),
    onStatus: (st) => net === conn && onStatus(st),
    onWelcome: (c) => {
      if (net !== conn) return;
      ui.form.code = c;
    },
  });
  net = conn;
  render();
}

function dropOnline()       {
  net?.close(false);
  net = null;
  ui.online = null;
  ui.game = null;
  ui.sheet = null;
  ui.view = 'menu';
  void keepAwake(false);
}

function onStatus(st           )       {
  if (!ui.online || ui.online.status === st) return;
  ui.online.status = st;
  render();
}

function onNetError(msg        , code         )       {
  if (!ui.online) return;
  if (code === 'gone') {
    dropOnline();
    return render();
  }
  if (!ui.online.room || code === 'noroom' || code === 'proto') {
    // Oda yok / sürüm eski / ad kullanılıyor: giriş ekranında göster.
    if (code === 'noroom' || code === 'proto') {
      net?.close(false);
      net = null;
      ui.online.room = null;
      ui.online.status = 'closed';
      ui.game = null;
      ui.view = 'onlineHome';
    } else if (!ui.online.room) {
      net?.close(false);
      net = null;
      ui.online.status = 'closed';
    }
    ui.online.error = msg;
    return render();
  }
  toast(msg);
}

/** Bu telefona özel gizli adım geldi mi (titreşim için). */
function myMoment(v          )          {
  const g = v.game;
  const me = v.you.pid;
  if (!g || !me) return false;
  if (g.mode === 'team') {
    const t = g.current;
    if (!t) return false;
    if (g.phase === 'secret') return t.actorId === me;
    if (g.phase === 'voteGate') return t.voterIds.includes(me);
    if (g.phase === 'confirmInput') return t.imitationTargetId === me;
    return g.phase === 'role' && t.actorId === me;
  }
  return g.phase === 'voteGate';
}

function onState(v          )       {
  const o = ui.online;
  if (!o) return;
  const prev = o.room;
  o.room = v;
  o.busy = false;
  o.offset = v.serverNow - Date.now();
  if (o.status !== 'open') o.status = 'open';
  if (ui.view === 'onlineHome' && o.error) o.error = null;
  // Çark: herkes aynı dönüşü görür.
  if (o.spinSeq === -1) {
    o.spinSeq = v.spin.seq;
    if (v.spin.value) ui.wheelFrom = ui.wheelTo = wheelAngleFor(v.spin.value, 0);
  } else if (v.spin.seq > o.spinSeq) {
    o.spinSeq = v.spin.seq;
    animateSpin(v.spin.value);
  }
  const g = v.game;
  const pg = prev?.game ?? null;
  if (!g) {
    ui.game = null;
    if (ui.view === 'game' || ui.view === 'onlineHome') ui.view = 'lobby';
    o.proxyAs = null;
    if (ui.sheet === 'pause') ui.sheet = null;
    void keepAwake(true);
    return render();
  }
  const phaseChanged = !pg || pg.phase !== g.phase || pg.mode !== g.mode;
  if (phaseChanged) {
    o.proxyAs = null;
    o.proxyOpen = false;
    o.proxyPick = null;
    ui.score = null;
    ui.guess = null;
    if (g.phase === 'scene') ui.warned = false;
    if (myMoment(v)) vibrate(g.mode === 'quick' ? [40, 60, 40] : 40);
  }
  ui.game = g;
  ui.view = 'game';
  ui.prepAt = v.phaseAt;
  if (g.mode === 'team') {
    const wasPaused = pg && pg.mode === 'team' ? pg.paused : false;
    if (g.paused && !wasPaused) ui.sheet = 'pause';
    if (!g.paused && ui.sheet === 'pause') ui.sheet = null;
    if (g.phase === 'scene' && g.clock.twistShown && g.current) {
      const key = `${g.turns.length}:${g.current.cardId}`;
      if (o.twistSeen !== key) {
        o.twistSeen = key;
        ui.twistOpen = true;
        vibrate(700);
      }
    }
    if (g.phase !== 'scene') ui.twistOpen = false;
  }
  if (phaseChanged && g.mode === 'team' && g.phase === 'voteGate' && g.current?.endedBy === 'time') vibrate([200, 100, 200]);
  if (phaseChanged && g.mode === 'quick' && g.phase === 'voteGate') vibrate([200, 100, 200]);
  void keepAwake(g.phase !== 'final');
  render();
}

/** Online eylem: kendi adına ya da (odayı kuransa) bağlantısı kopan oyuncu adına. */
function autoAs(a            )                     {
  const r = ui.online?.room;
  const g = ui.game;
  if (!r || !g || g.mode !== 'team') return undefined;
  const me = r.you.pid;
  const actor = g.current?.actorId;
  if (['spin', 'veto', 'roleChange', 'roleConfirm', 'setImitation', 'secretDone'].includes(a.type) && actor && actor !== me) return actor;
  if (a.type === 'starterSpin' && a.playerId !== me) return a.playerId;
  if (a.type === 'confirm' && ui.online?.proxyAs) return ui.online.proxyAs;
  return undefined;
}

function sendAct(a                          , as         )       {
  const r = ui.online?.room;
  if (!r) return;
  if (!r.game) return;
  send({ t: 'act', at: gameKey(r.game), a, as });
}

// ---------- kayıt ----------

function store(key        , value         )       {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* gizli sekme vb. */
  }
}
function load   (key        )           {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw)     ) : null;
  } catch {
    return null;
  }
}
function savedGame()              {
  const g = load      (KEY_GAME);
  if (!g || g.version !== 1 || g.phase === 'final') return null;
  return g;
}
const draft = load                                          (KEY_DRAFT);
if (draft) {
  if (draft.team) ui.team = draft.team;
  if (draft.quick) ui.quick = draft.quick;
}
const saveDraft = ()       => store(KEY_DRAFT, { team: ui.team, quick: ui.quick });

// Titreşim, ekran uyanıklığı ve Android geri tuşu: platform.ts

// ---------- çizim ----------

function render()       {
  const now = ui.online ? serverNow() : Date.now();
  let html = '';
  if (ui.view === 'game' && ui.game) {
    html = ui.game.mode === 'team' ? teamGameView(ui, ui.game, now) : quickGameView(ui, ui.game, now) + quickSheets(ui);
  } else {
    const views                                              = {
      menu: () => menuView(ui, !!savedGame(), BUILD),
      format: formatView,
      teamPlayers: () => teamPlayersView(ui),
      teamRoles: () => teamRolesView(ui),
      teamSettings: () => teamSettingsView(ui),
      quickSetup: () => quickSetupView(ui),
      rules: rulesView,
      onlineHome: () => onlineHomeView(ui, net ? null : savedSeat(), !!serverUrl()),
      lobby: () => (ui.online?.room ? lobbyView(ui, roomLink(ui.online.room.code)) : onlineHomeView(ui, null, !!serverUrl())),
    };
    html = views[(ui.view === 'game' ? 'menu' : ui.view)                         ]();
  }
  if (ui.online) {
    html += leaveSheet(ui);
    if (ui.online.error && ui.view !== 'onlineHome') html += `<div class="toast" role="status">${ui.online.error.replace(/[<&]/g, '')}</div>`;
  }
  const scrollY = window.scrollY;
  const sameScreen = root.dataset.key === screenKey();
  root.innerHTML = html;
  root.dataset.key = screenKey();
  if (sameScreen) window.scrollTo(0, scrollY);
  else window.scrollTo(0, 0);
  // çark animasyonu
  const w = root.querySelector            ('[data-wheel]');
  if (w && w.dataset.from !== w.dataset.to) {
    requestAnimationFrame(() => requestAnimationFrame(() => (w.style.transform = `rotate(${w.dataset.to}deg)`)));
  }
  tick();
}

function screenKey()         {
  const g = ui.game;
  const px = ui.online?.proxyAs ? `:${ui.online.proxyAs}:${ui.online.proxyOpen}` : '';
  return ui.view === 'game' && g ? `${g.mode}:${g.phase}:${g.mode === 'team' ? g.turnIndex : g.scenarios.length}${px}` : ui.view;
}

// ---------- oyun eylemleri ----------

function afterChange(prev             , next      )       {
  const now = Date.now();
  if (!prev || prev.phase !== next.phase) {
    if (next.phase === 'prep') ui.prepAt = now;
    if (next.phase === 'scene') {
      ui.warned = false;
      ui.twistOpen = false;
    }
    if (next.phase === 'voteInput') {
      ui.score = null;
      ui.guess = null;
    }
    if (next.phase === 'voteGate' || next.phase === 'confirmGate' || next.phase === 'secretGate') vibrate(40);
  }
  store(KEY_GAME, next.phase === 'final' ? null : next);
}

function team(a            )       {
  if (!ui.game || ui.game.mode !== 'team') return;
  if (ui.online) return sendAct(a, autoAs(a));
  const prev = ui.game;
  const next = teamReduce(prev, a);
  if (next === prev) return;
  ui.game = next;
  afterChange(prev, next);
  render();
}

function quick(a             )       {
  if (!ui.game || ui.game.mode !== 'quick') return;
  if (ui.online) return sendAct(a);
  const prev = ui.game;
  const next = quickReduce(prev, a);
  if (next === prev) return;
  ui.game = next;
  afterChange(prev, next);
  render();
}

function animateSpin(n        )       {
  ui.wheelFrom = ui.wheelTo;
  ui.wheelTo = wheelAngleFor(n, ui.wheelFrom);
  ui.spinUntil = Date.now() + SPIN_MS;
  vibrate(30);
  setTimeout(() => {
    ui.wheelFrom = ui.wheelTo;
    vibrate([20, 40, 20]);
    render();
  }, SPIN_MS + 50);
}

function startGame(g      )       {
  ui.game = g;
  ui.view = 'game';
  ui.sheet = null;
  ui.error = null;
  ui.goldenPick = {};
  ui.wheelFrom = ui.wheelTo = 0;
  store(KEY_GAME, g);
  void keepAwake(true);
  render();
}

function cleanTeamSetup()             {
  return { ...ui.team, teams: ui.team.teams.map((t) => ({ name: t.name, players: t.players.map((p) => p.trim()).filter(Boolean) })) };
}

// ---------- tıklamalar ----------

                         

const handlers                                    = {
  go: (d) => {
    ui.view = d.v        ;
    ui.error = null;
    render();
  },
  home: () => {
    ui.view = 'menu';
    render();
  },
  toggleHelp: () => root.querySelector('.help')?.classList.toggle('open'),
  pickTeam: () => handlers.go({ v: 'teamPlayers' }),
  pickQuick: () => handlers.go({ v: 'quickSetup' }),
  addPlayer: (d) => {
    ui.team.teams[Number(d.t)].players.push('');
    saveDraft();
    render();
    const ins = root.querySelectorAll                  (`input[data-t="${d.t}"][data-in="player"]`);
    ins[ins.length - 1]?.focus();
  },
  delPlayer: (d) => {
    ui.team.teams[Number(d.t)].players.splice(Number(d.p), 1);
    saveDraft();
    render();
  },
  addTeam: () => {
    if (ui.team.teams.length >= 4) return;
    ui.team.teams.push({ name: `Takım ${'ABCD'[ui.team.teams.length]}`, players: ['', ''] });
    saveDraft();
    render();
  },
  delTeam: (d) => {
    if (ui.team.teams.length <= 2) return;
    ui.team.teams.splice(Number(d.t), 1);
    saveDraft();
    render();
  },
  teamNext1: () => {
    const err = validateSetup(cleanTeamSetup());
    ui.error = err;
    if (!err) ui.view = 'teamRoles';
    render();
  },
  quickStartTeam: () => {
    const err = validateSetup(cleanTeamSetup());
    ui.error = err;
    if (err) return render();
    // Hızlı Başlangıç (s.8): Çark, Merdiven, Hızlı, Serbest puan, Süreli, Kartla.
    ui.team.settings = { roleSelect: 'wheel', levelMode: 'ladder', length: 'fast', freeTurns: 3, timing: 'timed' };
    saveDraft();
    handlers.startTeam({});
  },
  set: (d) => {
    const s = ui.team.settings                                      ;
    s[d.k          ] = d.k === 'freeTurns' ? Number(d.v) : d.v;
    saveDraft();
    render();
  },
  qset: (d) => {
    const q = ui.quick                                      ;
    if (d.k === 'imitation') q.imitation = d.v === 'on';
    else if (d.k === 'parentIndex' || d.k === 'durationSec') q[d.k] = Number(d.v);
    else q[d.k          ] = d.v;
    saveDraft();
    render();
  },
  startTeam: () => {
    const setup = cleanTeamSetup();
    const err = validateSetup(setup);
    ui.error = err;
    if (err) {
      ui.view = 'teamPlayers';
      return render();
    }
    startGame(createTeamGame(setup, CLASSIC, newSeed()));
  },
  startQuick: () => {
    const err = validateQuick(ui.quick);
    ui.error = err;
    if (err) return render();
    startGame(createQuickGame(ui.quick, QUICK, newSeed()));
  },
  resume: () => {
    const g = savedGame();
    if (!g) return render();
    ui.game = g;
    ui.view = 'game';
    ui.sheet = null;
    ui.prepAt = Date.now();
    if (g.mode === 'team') {
      // Gizli ekranda kaydedildiyse kapıdan yeniden açılır; kimse başkasının ekranını görmesin.
      const back                                    = { secret: 'secretGate', voteInput: 'voteGate', confirmInput: 'confirmGate' };
      let t           = back[g.phase] ? { ...g, phase: back[g.phase] } : g;
      // Kaldığı sahne duraklatılmış olarak açılır.
      if (t.phase === 'scene' && !t.paused) t = teamReduce(t, { type: 'pause', now: Date.now() });
      if (t.paused) ui.sheet = 'pause';
      ui.game = t;
    }
    if (g.mode === 'quick' && (g.phase === 'scene' || g.phase === 'voteInput')) {
      ui.game = { ...g, phase: g.phase === 'scene' ? 'prep' : 'voteGate' }             ;
    }
    void keepAwake(true);
    render();
  },
  discardSaved: () => {
    store(KEY_GAME, null);
    render();
  },
  team: (d) => {
    const a = d.a          ;
    if (a === 'pickRole') return team({ type: 'pickRole', n: Number(d.n) });
    if (a === 'setImitation') {
      if (ui.online?.proxyAs) {
        ui.online.proxyPick = (d.id          ) || null;
        render();
      }
      return team({ type: 'setImitation', targetId: d.id ? d.id : null });
    }
    if (a === 'veto') {
      team({ type: 'veto', what: d.w                      });
      return;
    }
    if (a === 'rivalsToWheel') {
      team({ type: 'rivalsToWheel' });
      if (ui.online) return;
      const g = ui.game            ;
      if (g.role.wheel) animateSpin(g.role.wheel);
      return render();
    }
    if (a === 'endGame') {
      ui.sheet = null;
      return team({ type: 'endGame' });
    }
    team({ type: a }              );
  },
  starterSpin: (d) => {
    if (Date.now() < ui.spinUntil) return;
    team({ type: 'starterSpin', playerId: d.id           });
    if (ui.online) return;
    const g = ui.game            ;
    if (g.starter.last) animateSpin(g.starter.last.value);
    render();
  },
  spin: () => {
    if (Date.now() < ui.spinUntil) return;
    team({ type: 'spin' });
    if (ui.online) return;
    const g = ui.game            ;
    if (g.role.wheel) animateSpin(g.role.wheel);
    render();
  },
  startScene: () => team({ type: 'startScene', now: Date.now() }),
  endScene: (d) => {
    ui.sheet = null;
    ui.twistOpen = false;
    if (d.by === 'red') vibrate(300);
    team({ type: 'endScene', by: d.by           , now: Date.now() });
    render();
  },
  pause: () => {
    if (ui.game?.mode === 'team') team({ type: 'pause', now: Date.now() });
    ui.sheet = 'pause';
    render();
  },
  resumeGame: () => {
    ui.sheet = null;
    if (ui.game?.mode === 'team') team({ type: 'resume', now: Date.now() });
    render();
  },
  sheet: (d) => {
    ui.sheet = d.v               ;
    render();
  },
  closeSheet: () => {
    const wasPause = ui.sheet === 'pause';
    const g = ui.game;
    ui.sheet = null;
    if (wasPause && g?.mode === 'team') return handlers.resumeGame({});
    // Hızlı Rol hazırlığında menü kapanınca geri sayım baştan başlar.
    if (g?.mode === 'quick' && g.phase === 'prep') ui.prepAt = Date.now();
    // Duraklatma menüsünden açılan alt sayfa kapanınca sahne duraklı kalır: menüye geri dön.
    if (g?.mode === 'team' && g.paused) ui.sheet = 'pause';
    render();
  },
  score: (d) => {
    ui.score = Number(d.v);
    render();
  },
  guess: (d) => {
    ui.guess = d.id          ;
    render();
  },
  submitVote: (d) => {
    if (ui.score === null) return;
    const g = ui.game            ;
    const guess = g.current?.golden ? 'none' : ui.guess;
    if (guess === null) return;
    if (ui.online) {
      send({ t: 'vote', score: ui.score, guess, as: d.as || undefined });
      return;
    }
    team({ type: 'submitVote', score: ui.score, guess });
  },
  confirm: (d) => team({ type: 'confirm', value: d.v                                   }),
  goldenPick: (d) => {
    ui.goldenPick[d.t          ] = d.id          ;
    render();
  },
  goldenStart: () => {
    const g = ui.game            ;
    const ids = (g.golden?.teamIds ?? []).map((t) => ui.goldenPick[t]).filter(Boolean);
    ui.goldenPick = {};
    team({ type: 'goldenSelect', playerIds: ids });
  },
  closeTwist: () => {
    ui.twistOpen = false;
    render();
  },
  askQuit: () => {
    ui.sheet = 'confirmQuit';
    render();
  },
  quitToMenu: () => {
    if (ui.game?.mode === 'team' && ui.game.phase === 'scene' && !ui.game.paused) team({ type: 'pause', now: Date.now() });
    ui.sheet = null;
    ui.view = 'menu';
    ui.game = null;
    void keepAwake(false);
    render();
  },
  replayTeam: () => handlers.startTeam({}),
  replayQuick: () => handlers.startQuick({}),
  q: (d) => quick({ type: d.a }               ),
  qStart: () => quick({ type: 'startScene', now: Date.now() }),
  qCancel: () => quick({ type: 'cancelScene' }),
  qOpenVote: () => quick({ type: 'openVote', now: Date.now() }),
  qVote: (d) => {
    if (ui.online) return send({ t: 'qvote', score: Number(d.v) });
    quick({ type: 'vote', score: Number(d.v), now: Date.now() });
  },
  toggleNames: () => {
    ui.hideNames = !ui.hideNames;
    render();
  },
  // ---------- online ----------
  onlineBack: () => {
    if (ui.view === 'onlineHome') {
      if (net) dropOnline();
      ui.online = null;
      ui.view = 'menu';
      return render();
    }
    ui.sheet = 'onlineLeave';
    render();
  },
  onlineCreate: () => {
    if (!onlineName()) return;
    connect(null, null);
  },
  onlineJoin: () => {
    if (!onlineName()) return;
    const code = ui.form.code.trim().toLocaleUpperCase('tr').replace(/İ/g, 'I');
    if (!validCode(code)) return onlineFormError('Oda kodu 4 harftir.');
    const s = savedSeat();
    connect(code, s && s.code === code ? s.token : null);
  },
  onlineRejoin: () => {
    const s = savedSeat();
    if (!s) return render();
    ui.form.name = s.name;
    connect(s.code, s.token);
  },
  onlineForget: () => {
    forgetSeat();
    render();
  },
  onlineDetach: () => {
    // Odadan çıkmadan menüye: yer saklı kalır, "Odaya dön" ile geri gelinir.
    dropOnline();
    render();
  },
  onlineLeave: () => {
    net?.close(true);
    net = null;
    dropOnline();
    render();
  },
  oset: (d) => {
    const k = d.k          ;
    const v = d.v          ;
    const patch                          = {};
    if (k === 'mode') patch.mode = v;
    else if (k === 'teamCount') patch.teamCount = Number(v);
    else if (k === 'freeTurns') patch.team = { freeTurns: Number(v) };
    else if (['roleSelect', 'length', 'levelMode', 'timing'].includes(k)) patch.team = { [k]: v };
    else if (k === 'imitation') patch.quick = { imitation: v === 'on' };
    else if (k === 'durationSec' || k === 'parentIndex') patch.quick = { [k]: Number(v) };
    else if (k === 'relation') patch.quick = { relation: v };
    send({ t: 'lobby', patch }             );
  },
  myTeam: (d) => send({ t: 'myTeam', team: Number(d.t) }),
  kick: (d) => send({ t: 'kick', id: d.id           }),
  onlineStart: () => send({ t: 'start' }),
  onlineRestart: () => send({ t: 'restart' }),
  onlineToLobby: () => send({ t: 'toLobby' }),
  share: () => {
    const code = ui.online?.room?.code;
    if (!code) return;
    const url = roomLink(code);
    const text = `Taklidim Sensin odası ${code}: ${url}`;
    const nav = navigator                                                        ;
    if (nav.share) {
      nav.share({ title: 'Taklidim Sensin', text: `Taklidim Sensin odası ${code}`, url }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(text).then(
      () => toast('Bağlantı kopyalandı.'),
      () => toast(url),
    );
  },
  proxy: (d) => {
    if (!ui.online) return;
    ui.online.proxyAs = d.id          ;
    ui.online.proxyOpen = false;
    ui.online.proxyPick = null;
    ui.score = null;
    ui.guess = null;
    render();
  },
  proxyOpen: () => {
    if (!ui.online) return;
    ui.online.proxyOpen = true;
    render();
  },
  proxyCancel: () => {
    if (!ui.online) return;
    ui.online.proxyAs = null;
    ui.online.proxyOpen = false;
    ui.online.proxyPick = null;
    render();
  },
};

function onlineFormError(msg        )       {
  ui.online = ui.online ?? { room: null, status: 'closed', offset: 0, error: null, proxyAs: null, proxyOpen: false, proxyPick: null, spinSeq: -1, twistSeen: '', busy: false };
  ui.online.error = msg;
  render();
}

function onlineName()          {
  const n = ui.form.name.trim();
  if (!n) {
    onlineFormError('Önce adını yaz.');
    return false;
  }
  try {
    localStorage.setItem(KEY_NAME, n);
  } catch {
    /* yok */
  }
  return true;
}

let swallowClicksUntil = 0;
root.addEventListener('click', (e) => {
  // Kapı açıldıktan hemen sonra parmağın kalkması yeni ekrandaki düğmeye basmasın.
  if (Date.now() < swallowClicksUntil) {
    e.preventDefault();
    return;
  }
  const target = e.target               ;
  const el = target.closest             ('[data-act]');
  if (!el || (el                     ).disabled) return;
  if (el.classList.contains('overlay') && target.closest('[data-stop]')) return;
  const fn = handlers[el.dataset.act          ];
  if (fn) fn(el.dataset);
});

root.addEventListener('input', (e) => {
  const el = e.target                    ;
  const kind = el.dataset.in;
  if (kind === 'player') ui.team.teams[Number(el.dataset.t)].players[Number(el.dataset.p)] = el.value;
  else if (kind === 'teamName') ui.team.teams[Number(el.dataset.t)].name = el.value;
  else if (kind === 'qname') ui.quick.names[Number(el.dataset.i)] = el.value;
  else if (kind === 'oname') return void (ui.form.name = el.value);
  else if (kind === 'ocode') {
    const up = el.value.toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/[^A-Z]/g, '');
    if (up !== el.value) el.value = up;
    ui.form.code = up;
    return;
  } else return;
  saveDraft();
});

// Hızlı Rol: ad yazılınca "Ebeveyn kim?" düğmeleri güncellensin.
root.addEventListener('change', (e) => {
  const el = e.target                    ;
  if (el.dataset.in === 'qname' && ui.view === 'quickSetup') render();
  if (el.dataset.in === 'lteam') send({ t: 'lobby', patch: { teamName: { i: Number(el.dataset.t), name: el.value } } });
});

root.addEventListener('keydown', (e) => {
  const el = e.target                    ;
  if (e.key === 'Enter' && el.dataset.in === 'ocode') return handlers.onlineJoin({});
  if (e.key === 'Enter' && (el.dataset.in === 'oname' || el.dataset.in === 'lteam')) return el.blur();
  if (e.key !== 'Enter' || el.dataset.in !== 'player') return;
  const ins = Array.from(root.querySelectorAll                  ('input[data-in="player"]'));
  const i = ins.indexOf(el);
  if (i >= 0 && i < ins.length - 1) ins[i + 1].focus();
  else el.blur();
});

// ---------- basılı tutma kapısı (1 sn) ----------

let holdTimer                    ;
function holdAction(act        )       {
  if (act.startsWith('team:')) team({ type: act.slice(5) }              );
  else if (handlers[act]) handlers[act]({});
}
root.addEventListener('pointerdown', (e) => {
  const el = (e.target               ).closest             ('[data-hold]');
  if (!el) return;
  el.classList.add('holding');
  const act = el.dataset.hold          ;
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(() => {
    vibrate(30);
    swallowClicksUntil = Date.now() + 450;
    holdAction(act);
  }, 1000);
});
const cancelHold = ()       => {
  window.clearTimeout(holdTimer);
  root.querySelectorAll('.holding').forEach((x) => x.classList.remove('holding'));
};
root.addEventListener('pointerup', cancelHold);
root.addEventListener('pointercancel', cancelHold);
root.addEventListener('pointerleave', cancelHold, true);
root.addEventListener('contextmenu', (e) => {
  if ((e.target               ).closest('[data-hold]')) e.preventDefault();
});

// ---------- sayaçlar ----------

function setClock(key        , text        , leftMs         )       {
  const el = root.querySelector             (`[data-clock="${key}"]`);
  if (el && el.textContent !== text) el.textContent = text;
  const ring = root.querySelector                  (`[data-ring="${key}"]`);
  if (ring && leftMs !== undefined) {
    const total = Number(ring.dataset.total);
    const C = 2 * Math.PI * 90;
    ring.setAttribute('stroke-dashoffset', (C * (1 - Math.max(0, Math.min(1, leftMs / total)))).toFixed(1));
  }
}

/** Online sayaçlar: yalnız gösterir; zamanı sunucu tutar. Sunucu alarmı gecikirse bir "tick" ile dürter. */
function onlineTick()       {
  const g = ui.game;
  const r = ui.online?.room;
  if (ui.view !== 'game' || !g || !r) return;
  const now = serverNow();
  if (g.mode === 'team') {
    if (g.phase === 'prep') {
      const sec = g.settings.timing === 'timed' ? PREP_SEC : PREP_UNTIMED_SEC;
      const left = sec * 1000 - (now - ui.prepAt);
      setClock('prep', String(Math.max(0, Math.ceil(left / 1000))), left);
    } else if (g.phase === 'scene') {
      const tm = sceneTiming(g, now);
      if (tm.remaining === null) setClock('scene', mmss(tm.elapsed));
      else {
        setClock('scene', mmss(tm.remaining));
        if (tm.remaining <= 30_000 && !ui.warned && !g.paused) {
          ui.warned = true;
          vibrate(200);
          root.querySelector('[data-clock="scene"]')?.classList.add('warn');
        }
        const grace = root.querySelector             ('[data-grace]');
        if (tm.remaining <= 0 && grace) grace.textContent = `Süre doldu! Cümleni bitir: ${Math.max(0, Math.ceil((5000 + tm.remaining) / 1000))}`;
      }
    }
  } else if (g.phase === 'prep') {
    const left = QUICK_PREP_SEC * 1000 - (now - ui.prepAt);
    setClock('qprep', String(Math.max(0, Math.ceil(left / 1000))), left);
  } else if (g.phase === 'scene') {
    const left = g.durationSec * 1000 - (now - (g.clock.startedAt ?? now));
    setClock('qscene', String(Math.max(0, Math.ceil(left / 1000))));
    if (left <= 5000) root.querySelector('[data-clock="qscene"]')?.classList.add('warn');
  } else if (g.phase === 'voteGate' && r.voteOpenedAt !== null) {
    const left = VOTE_WINDOW_MS - (now - r.voteOpenedAt);
    setClock('qvote', String(Math.max(0, Math.ceil(left / 1000))), left);
    if (left < -800 && root.querySelector('[data-clock="qvote"]')) render();
  }
  const due = nextDeadline({ game: g, phaseAt: r.phaseAt, voteOpenedAt: r.voteOpenedAt }        );
  if (due !== null && now > due + 1500 && Date.now() - lastTickSent > 2500) {
    lastTickSent = Date.now();
    net?.send({ t: 'tick' });
  }
}

function tick()       {
  if (ui.online) return onlineTick();
  const g = ui.game;
  if (ui.view !== 'game' || !g) return;
  const now = Date.now();
  if (g.mode === 'team') {
    if (g.paused || ui.sheet) return;
    if (g.phase === 'prep') {
      const sec = g.settings.timing === 'timed' ? PREP_SEC : PREP_UNTIMED_SEC;
      const left = sec * 1000 - (now - ui.prepAt);
      setClock('prep', String(Math.max(0, Math.ceil(left / 1000))), left);
      if (left <= 0) team({ type: 'startScene', now });
      return;
    }
    if (g.phase === 'scene') {
      const tm = sceneTiming(g, now);
      const card = g.current ? CLASSIC_BY_ID[g.current.cardId] : null;
      if (card?.twist && !g.clock.twistShown && tm.elapsed >= tm.duration / 2) {
        ui.twistOpen = true;
        vibrate(700);
        team({ type: 'twistShown' });
        return;
      }
      if (tm.remaining === null) {
        setClock('scene', mmss(tm.elapsed));
        return;
      }
      setClock('scene', mmss(tm.remaining));
      if (tm.remaining <= 30_000 && !ui.warned) {
        ui.warned = true;
        vibrate(200);
        root.querySelector('[data-clock="scene"]')?.classList.add('warn');
      }
      const grace = root.querySelector             ('[data-grace]');
      if (tm.remaining <= 0 && grace) grace.textContent = `Süre doldu! Cümleni bitir: ${Math.max(0, Math.ceil((5000 + tm.remaining) / 1000))}`;
      if (tm.remaining <= -5000) {
        vibrate([200, 100, 200]);
        team({ type: 'endScene', by: 'time', now });
      }
    }
    return;
  }
  // Hızlı Rol
  if (ui.sheet) return;
  if (g.phase === 'prep') {
    const left = QUICK_PREP_SEC * 1000 - (now - ui.prepAt);
    setClock('qprep', String(Math.max(0, Math.ceil(left / 1000))), left);
    if (left <= 0) quick({ type: 'startScene', now });
  } else if (g.phase === 'scene') {
    const left = g.durationSec * 1000 - (now - (g.clock.startedAt ?? now));
    setClock('qscene', String(Math.max(0, Math.ceil(left / 1000))));
    if (left <= 5000) root.querySelector('[data-clock="qscene"]')?.classList.add('warn');
    if (left <= 0) {
      vibrate([200, 100, 200]);
      quick({ type: 'sceneEnd' });
    }
  } else if (g.phase === 'voteInput') {
    const left = VOTE_WINDOW_MS - (now - (g.voteOpenedAt ?? now));
    setClock('qvote', String(Math.max(0, Math.ceil(left / 1000))), left);
    if (left <= 0) quick({ type: 'vote', score: null, now });
  }
}

setInterval(tick, 200);

// ---------- Android geri tuşu ----------

onBackButton(() => {
  if (Date.now() < swallowClicksUntil) return true;
  const help = root.querySelector('.help.open');
  if (help) {
    help.classList.remove('open');
    return true;
  }
  if (ui.twistOpen) {
    handlers.closeTwist({});
    return true;
  }
  if (ui.sheet) {
    handlers.closeSheet({});
    return true;
  }
  // Ekrandaki geri düğmesiyle aynı iş.
  const back = root.querySelector             ('.bar [aria-label="Geri"]');
  if (back) {
    back.click();
    return true;
  }
  if (ui.view === 'menu') return false;
  if (ui.online) {
    if (root.querySelector('.kind-secret')) return true;
    handlers.onlineBack({});
    return true;
  }
  const g = ui.game;
  if (ui.view !== 'game' || !g) {
    handlers.home({});
    return true;
  }
  if (g.phase === 'final') {
    handlers.quitToMenu({});
    return true;
  }
  // Gizli ekranda (oy, ilan) geri tuşu bir şey yapmaz; kimse başkasının ekranından çıkmasın.
  if (root.querySelector('.kind-secret')) return true;
  if (g.mode === 'team') handlers.pause({});
  else handlers.askQuit({});
  return true;
});


document.addEventListener('visibilitychange', () => {
  if (ui.online) {
    // Online oyunda bir telefonun kilitlenmesi oyunu durdurmaz; öne gelince bağlantı tazelenir.
    if (document.visibilityState === 'visible') {
      net?.wake();
      if (ui.view === 'game' || ui.view === 'lobby') void keepAwake(true);
    }
    return;
  }
  // Arka plana geçince sahne sayacı durur (s.38).
  if (document.visibilityState === 'hidden') {
    if (ui.game?.mode === 'team' && ui.game.phase === 'scene' && !ui.game.paused) {
      team({ type: 'pause', now: Date.now() });
      ui.sheet = 'pause';
      render();
    }
  } else if (ui.view === 'game') {
    void keepAwake(true);
  }
});

// Adres ?oda=KOD ile açıldıysa katılma ekranı.
try {
  const n = localStorage.getItem(KEY_NAME);
  if (n) ui.form.name = n;
} catch {
  /* yok */
}
{
  const params = new URLSearchParams(location.search);
  const code = (params.get('oda') ?? '').toUpperCase();
  if (code) {
    ui.form.code = code.replace(/[^A-Z]/g, '').slice(0, 4);
    ui.view = 'onlineHome';
    params.delete('oda');
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash);
  } else {
    // Sayfa yenilendi / uygulama arka planda kapandı: yakın zamanda oynanan odaya kendiliğinden dön.
    const s = savedSeat();
    if (s && serverUrl() && Date.now() - s.at < 2 * 3600_000) {
      ui.form.name = s.name;
      ui.view = 'onlineHome';
      connect(s.code, s.token);
    }
  }
}

render();

// Test ve hata ayıklama için (oyun durumunu okur, değiştirmez).
(globalThis                                      ).__taklidim = { ui, CLASSIC_BY_ID, net: () => net };
