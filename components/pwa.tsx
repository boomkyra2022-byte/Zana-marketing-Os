'use client';

// PWA helpers mounted once in the root layout:
// - registers /sw.js (production builds only — in `next dev` a service worker
//   would serve stale dev chunks; set NEXT_PUBLIC_PWA_DEV=1 to test it there)
// - "ติดตั้งแอป" banner: Android / desktop Chrome use the browser's install
//   prompt; iPhone Safari has none, so it shows the Share → Add to Home Screen
//   steps instead. Hidden once installed (standalone) or dismissed.

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'zana-pwa-install-dismissed';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export default function Pwa() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_PWA_DEV === '1')) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // storage blocked — just show it
    }
    if (dismissed) return;

    const ua = navigator.userAgent;
    const iPhone = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    const safari = /safari/i.test(ua) && !/crios|fxios|edgios|line\//i.test(ua);
    if (iPhone && safari) {
      setIos(true);
      setShow(true);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === 'accepted') setShow(false);
  }

  if (!show || (!prompt && !ios)) return null;

  return (
    <div className="pwa-banner" role="dialog" aria-label="ติดตั้ง ZANA OS บนมือถือ">
      <img src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="pwa-text">
        <b>ติดตั้ง ZANA OS ไว้บนหน้าจอ</b>
        {ios ? (
          <span>
            กดปุ่ม <span aria-label="แชร์">แชร์</span> <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> ใน Safari แล้วเลือก &quot;เพิ่มไปยังหน้าจอโฮม&quot;
          </span>
        ) : (
          <span>เปิดได้จากหน้าจอโฮม เต็มจอเหมือนแอป</span>
        )}
      </div>
      {!ios && (
        <button type="button" className="pwa-install" onClick={install}>
          ติดตั้ง
        </button>
      )}
      <button type="button" className="pwa-close" aria-label="ปิด" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
