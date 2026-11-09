export type Iss = [string, string, string, string, string, string, string, string]; // date, permit, item, store, dept, shift, status, recipient
export type Add = [string, string, string, string, string, string, string]; // date, order, item, store, supplier, buyer, party
export type Pr = [string, string, string, string, string, 0 | 1 | 2]; // date, no, type, dept, exec, state
export type Bal = [string, string, string, string, string, number, string, number | null, number | null]; // item, store, group, status, move, bal, unit, min, reorder
export interface Payload {
  version: number; generatedAt: string; asof: string;
  iss: Iss[]; add: Add[]; pr: Pr[]; bal: Bal[];
  oth: { ret: number; sa: number; sd: number; tr: number };
  error?: string;
}
export interface Filters { m1: number; m2: number; store: string }
export const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const STORES = ['الادوات والمهمات', 'قطع الغيار', 'المطبوعات', 'الوقود والزيوت', 'المطهرات', 'الاصول الثابتة'];
export const monthOf = (d: string) => parseInt(d.slice(5, 7), 10) - 1;
export const fmt = (n: number) => Number(n).toLocaleString('en-US');
export const short = (s: string, n = 34) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function lastMonth(p: Payload): number {
  let m = 0;
  for (const r of p.iss) m = Math.max(m, monthOf(r[0]));
  for (const r of p.add) m = Math.max(m, monthOf(r[0]));
  return m;
}

export function applyFilters(p: Payload, f: Filters) {
  const inM = (d: string) => monthOf(d) >= f.m1 && monthOf(d) <= f.m2;
  return {
    iss: p.iss.filter((r) => inM(r[0]) && (!f.store || r[3] === f.store)),
    add: p.add.filter((r) => inM(r[0]) && (!f.store || r[3] === f.store)),
    pr: p.pr.filter((r) => inM(r[0])),
    bal: p.bal.filter((r) => !f.store || r[1] === f.store),
  };
}

export function cnt<T>(rows: T[], key: (r: T) => string, blank?: string): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    let k = key(r);
    if (!k) { if (!blank) continue; k = blank; }
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
export const uniq = <T,>(rows: T[], key: (r: T) => string) => new Set(rows.map(key).filter(Boolean)).size;
