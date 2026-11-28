// Cihaz özellikleri: titreşim, ekranı uyanık tutma, Android geri tuşu.
// Android uygulamasında Capacitor eklentileri, tarayıcıda web API'leri kullanılır.
// '@capacitor/core' tarayıcıda index.html'deki import map ile vendor/capacitor-core.js'e çözülür.
import { Capacitor, registerPlugin } from '@capacitor/core';

                         
                                                  
 
                           
                             
                              
 
                     
                                                                     
                               
 

export const isNative          = Capacitor.isNativePlatform();

const Haptics = registerPlugin               ('Haptics');
const KeepAwake = registerPlugin                 ('KeepAwake');
const App = registerPlugin           ('App');

/** Tek süre ya da [titreşim, ara, titreşim, ...] deseni (navigator.vibrate ile aynı biçim). */
export function vibrate(p                   )       {
  try {
    if (!isNative) {
      navigator.vibrate?.(p);
      return;
    }
    const steps = Array.isArray(p) ? p : [p];
    let at = 0;
    steps.forEach((ms, i) => {
      if (i % 2 === 0 && ms > 0) setTimeout(() => void Haptics.vibrate({ duration: ms }).catch(() => {}), at);
      at += ms;
    });
  } catch {
    /* yok */
  }
}

let webLock                                          = null;
export async function keepAwake(on         )                {
  try {
    if (isNative) {
      await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
      return;
    }
    const nav = navigator                                                                                                   ;
    if (on && !webLock && nav.wakeLock) webLock = await nav.wakeLock.request('screen');
    if (!on && webLock) {
      await webLock.release();
      webLock = null;
    }
  } catch {
    webLock = null;
  }
}

/** Android geri tuşu. Fonksiyon false dönerse uygulama arka plana alınır (ana menüdeyken). */
export function onBackButton(handle               )       {
  if (!isNative) return;
  void App.addListener('backButton', () => {
    if (!handle()) void App.minimizeApp().catch(() => {});
  }).catch(() => {});
}
