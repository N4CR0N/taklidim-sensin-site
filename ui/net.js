// Online bağlantı: WebSocket, yeniden bağlanma, canlılık yoklaması, oda jetonunun saklanması.
                                                             
import { PROTO } from '../online/room.js';

                                                                      

                            
                             
                                            
                               
                                            
 

const KEY = 'taklidim.v1.online';

                            
               
                
               
             
 

export function savedSeat()                   {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw)             ) : null;
    // 12 saatten eski oda sunucuda zaten silinmiştir.
    if (!s || Date.now() - s.at > 12 * 3600_000) return null;
    return s;
  } catch {
    return null;
  }
}

function storeSeat(s                  )       {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* gizli sekme */
  }
}

export function forgetSeat()       {
  storeSeat(null);
}

/** Sunucu adresi: derlemede gömülü; geliştirmede `?sunucu=ws://...` ile değiştirilebilir (kalıcı). */
export function serverUrl()         {
  try {
    const q = new URLSearchParams(location.search).get('sunucu');
    if (q !== null) {
      if (q) localStorage.setItem('taklidim.v1.server', q);
      else localStorage.removeItem('taklidim.v1.server');
    }
    const over = localStorage.getItem('taklidim.v1.server');
    if (over) return over;
  } catch {
    /* yok */
  }
  const built = (globalThis                           ).__SERVER__ ?? '';
  return built.startsWith('%') ? '' : built;
}

export class Net {
          ws                   = null;
          code               ;
          name        ;
          token               ;
          create         ;
          closedByUs = false;
          tries = 0;
          pingTimer                    ;
          retryTimer                    ;
          lastPong = 0;
  status            = 'connecting';
          base        ;
          ev           ;

  constructor(base        , opts                                                             , ev           ) {
    this.base = base;
    this.ev = ev;
    this.code = opts.code;
    this.name = opts.name;
    this.token = opts.token;
    this.create = !opts.code;
    // Çağıran nesneyi kendi değişkenine yazmadan olay gelmesin.
    queueMicrotask(() => {
      if (!this.closedByUs) this.open();
    });
  }

  get roomCode()                {
    return this.code;
  }

          setStatus(s           )       {
    this.status = s;
    this.ev.onStatus(s);
  }

          open()       {
    window.clearTimeout(this.retryTimer);
    const q = this.create ? 'new=1' : `room=${encodeURIComponent(this.code ?? '')}`;
    let ws           ;
    try {
      ws = new WebSocket(`${this.base.replace(/\/$/, '')}/ws?${q}`);
    } catch {
      this.ev.onError('Sunucu adresi geçersiz.');
      this.setStatus('closed');
      return;
    }
    this.ws = ws;
    this.setStatus(this.tries ? 'retrying' : 'connecting');
    ws.onopen = () => {
      this.tries = 0;
      this.lastPong = Date.now();
      ws.send(JSON.stringify({ t: 'hello', proto: PROTO, token: this.token ?? undefined, name: this.name }                    ));
      window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.ping(), 15_000);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') {
        this.lastPong = Date.now();
        return;
      }
      let m                                     ;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      this.lastPong = Date.now();
      if (m.t === 'welcome') {
        this.create = false;
        this.code = String(m.code);
        this.token = String(m.token);
        storeSeat({ code: this.code, token: this.token, name: this.name, at: Date.now() });
        this.setStatus('open');
        this.ev.onWelcome(this.code, String(m.id));
      } else if (m.t === 'state') {
        if (this.code) storeSeat({ code: this.code, token: this.token ?? '', name: this.name, at: Date.now() });
        this.ev.onState(m                       );
      } else if (m.t === 'error') {
        const code = m.code ? String(m.code) : undefined;
        if (code === 'noroom' || code === 'gone' || code === 'proto') {
          this.closedByUs = true;
          if (code !== 'proto') forgetSeat();
        }
        this.ev.onError(String(m.msg ?? 'Hata'), code);
      }
    };
    ws.onclose = () => {
      window.clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closedByUs) {
        this.setStatus('closed');
        return;
      }
      this.tries += 1;
      this.setStatus('retrying');
      const wait = Math.min(8000, 500 * 2 ** Math.min(this.tries, 4));
      this.retryTimer = window.setTimeout(() => this.open(), wait);
    };
    ws.onerror = () => {
      /* onclose ardından gelir */
    };
  }

          ping()       {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (Date.now() - this.lastPong > 40_000) {
      // Sessizce kopmuş bağlantı (telefon uyudu, ağ değişti): yeniden aç.
      ws.close();
      return;
    }
    ws.send('ping');
  }

  /** Uygulama öne gelince bağlantı ölü mü bak; ölüyse hemen yeniden bağlan. */
  wake()       {
    if (this.closedByUs) return;
    const ws = this.ws;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      this.tries = 0;
      this.open();
    } else if (ws.readyState === WebSocket.OPEN) this.ping();
  }

  send(msg           )          {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }

  close(leave         )       {
    if (leave) {
      this.send({ t: 'leave' });
      forgetSeat();
    }
    this.closedByUs = true;
    window.clearInterval(this.pingTimer);
    window.clearTimeout(this.retryTimer);
    try {
      this.ws?.close();
    } catch {
      /* yok */
    }
    this.ws = null;
  }
}
