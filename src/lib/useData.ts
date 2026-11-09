import { useCallback, useEffect, useRef, useState } from 'react';
import type { Payload } from './data';

// غيّر الرقم ده لما يتغير شكل الداتا عشان الكاش القديم يتمسح
export const DATA_SCHEMA_VERSION = 1;
const KEY = 'dk-warehouse-report-cache';
const URL_ = (import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined)?.trim() || '';
const EVERY = Math.max(15, Number(import.meta.env.VITE_SYNC_SECONDS) || 60) * 1000;

export type SyncState = 'loading' | 'ok' | 'error';
export const usingSample = !URL_;

function readCache(): Payload | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { schema: number; data: Payload };
    return c.schema === DATA_SCHEMA_VERSION ? c.data : null;
  } catch { return null; }
}
function writeCache(data: Payload) {
  try { localStorage.setItem(KEY, JSON.stringify({ schema: DATA_SCHEMA_VERSION, data })); } catch { /* الكاش اختياري */ }
}

export function useData() {
  const [data, setData] = useState<Payload | null>(() => readCache());
  const [state, setState] = useState<SyncState>('loading');
  const [error, setError] = useState('');
  const [at, setAt] = useState<Date | null>(null);
  const busy = useRef(false);

  const load = useCallback(async (force = false) => {
    if (busy.current) return;
    busy.current = true;
    setState('loading');
    try {
      const url = URL_ ? `${URL_}${URL_.includes('?') ? '&' : '?'}t=${Date.now()}${force ? '&nocache=1' : ''}` : `${import.meta.env.BASE_URL}sample.json`;
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as Payload;
      if (j.error) throw new Error(j.error);
      if (j.version !== DATA_SCHEMA_VERSION) throw new Error('نسخة السكربت مختلفة عن نسخة التطبيق، حدّث Code.gs');
      setData(j); writeCache(j); setAt(new Date()); setError(''); setState('ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setState('error');
    } finally { busy.current = false; }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, EVERY); // مزامنة تلقائية في الخلفية
    const v = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [load]);

  return { data, state, error, at, reload: () => { void load(true); } };
}
