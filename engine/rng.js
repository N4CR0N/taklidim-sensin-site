// Tohumlu rastgele sayı (mulberry32). Durum oyunun içinde saklanır, böylece
// kural motoru saf kalır ve testler tekrarlanabilir.

export function rand(seed        )                   {
  const t = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

/** 1..n arası tam sayı */
export function roll(seed        , n        )                   {
  const [x, s] = rand(seed);
  return [1 + Math.floor(x * n), s];
}

export function shuffle   (items              , seed        )                {
  const a = items.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    const [x, ns] = rand(s);
    s = ns;
    const j = Math.floor(x * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return [a, s];
}

export function newSeed()         {
  return (Math.random() * 0x7fffffff) | 0;
}
