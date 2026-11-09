import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChartOptions } from 'chart.js';
import { Bar, Donut, HBar, Line, axes, useTheme } from './components/Charts';
import { MN, STORES, applyFilters, cnt, fmt, lastMonth, monthOf, short, uniq } from './lib/data';
import type { Filters, Payload } from './lib/data';
import { useData, usingSample } from './lib/useData';
import { downloadPdf, enterExport, fitForPrint, leaveExport, printReport } from './lib/exporter';

const Logo = () => (
  <div className="logo"><img alt="الدقهلية للدواجن – Dakahlia Poultry" src={`${import.meta.env.BASE_URL}logo.png`} /></div>
);

const Card = ({ cls, title, plain, children }: { cls: string; title: string; plain?: boolean; children: ReactNode }) => (
  <div className={`card ${cls} ${plain ? 'plain' : ''}`}><h3>{title}</h3>{children}</div>
);

const ICONS: Record<string, string> = {
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM17 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 14.5c2.8 0 5 2 5 5',
  cart: 'M9 20a1.5 1.5 0 100-.01zM18 20a1.5 1.5 0 100-.01zM3 4h3l2.5 11h10l2-8H7',
  truck: 'M2 6h12v10H2zM14 10h4l3 3v3h-7M7 17.5a1.8 1.8 0 100-.01zM17 17.5a1.8 1.8 0 100-.01z',
};
const Wt = ({ ic, col, l, v, vc }: { ic: string; col: string; l: string; v: string; vc: string }) => (
  <div className="wt">
    <svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[ic]} /></svg>
    <div><div className="l">{l}</div><div className="v" style={{ color: vc }}>{v}</div></div>
  </div>
);
const Nt = ({ l, v, c }: { l: string; v: string; c: string }) => (
  <div className="wt" style={{ flex: '0 1 185px', minWidth: 150, justifyContent: 'center', textAlign: 'center' }}>
    <div><div className="l">{l}</div><div className={`v ${c}`}>{v}</div></div>
  </div>
);

export default function App() {
  const { data, state, error, at, reload } = useData();
  if (!data) {
    return (
      <div className="banner" dir="rtl">
        {state === 'error' ? <>تعذر تحميل البيانات: {error}. راجع رابط Apps Script في ملف .env وإن النشر "Anyone".</> : <span className="loading"><i className="spin" />جاري تحميل البيانات... (أول مرة على الجهاز بس بتاخد وقت، بعدها بيفتح فوراً)</span>}
      </div>
    );
  }
  return <Report data={data} state={state} error={error} at={at} reload={reload} />;
}

function Report({ data, state, error, at, reload }: { data: Payload; state: string; error: string; at: Date | null; reload: () => void }) {
  const t = useTheme();
  const LAST = useMemo(() => lastMonth(data), [data]);
  const [f, setF] = useState<Filters>({ m1: 0, m2: 11, store: '' });
  const [open, setOpen] = useState(false);
  const m2 = Math.min(f.m2, LAST);
  const F: Filters = { ...f, m2 };
  const { iss, add, pr, bal } = useMemo(() => applyFilters(data, F), [data, f.m1, m2, f.store]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = useMemo(() => Array.from({ length: m2 - f.m1 + 1 }, (_, i) => f.m1 + i), [f.m1, m2]);
  const full = f.m1 === 0 && m2 === LAST;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  const [busy, setBusy] = useState(false);
  useEffect(() => { // يشتغل كمان لو المستخدم ضغط Ctrl+P
    const before = () => { enterExport(); fitForPrint(); };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', leaveExport);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', leaveExport); };
  }, []);
  const onPdf = async () => { setBusy(true); try { await downloadPdf(); } catch (e) { console.error(e); alert('تعذر إنشاء ملف PDF'); } finally { setBusy(false); } };

  const setRange = (a: number, b: number) => setF((p) => ({ ...p, m1: Math.min(a, b), m2: Math.max(a, b) }));

  /* ---- page 1 ---- */
  const byStore = cnt(iss, (r) => r[3]);
  const depts = cnt(iss, (r) => r[4], 'غير محدد').slice(0, 10);
  const statuses = cnt(iss, (r) => r[6], 'غير محدد');
  const monthly = (rows: { 0: string }[]) => months.map((m) => rows.filter((r) => monthOf(r[0]) === m).length);
  const iM = monthly(iss), aM = monthly(add), pM = monthly(pr);
  const permM = months.map((m) => uniq(iss.filter((r) => monthOf(r[0]) === m), (r) => r[1]));
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const tbl: [string, number[]][] = [['بنود الصرف', iM], ['أذون الصرف', permM], ['بنود الإضافة', aM], ['طلبات الشراء (بنود)', pM]];

  const monthOpts: ChartOptions<'bar'> = {
    maintainAspectRatio: false, responsive: true, layout: { padding: { top: 20 } },
    plugins: { legend: { position: 'top', align: 'start', labels: { boxWidth: 12 } }, datalabels: { display: true, anchor: 'end', align: 'top', color: (c) => (c.datasetIndex === 0 ? t.blue : t.steel), font: { weight: 600, size: 11 }, formatter: (v: number) => fmt(v) } },
    scales: axes(t),
  };

  /* ---- page 2 ---- */
  const weekIdx = (d: string) => Math.floor((Date.parse(d + 'T00:00:00Z') - Date.UTC(2026, 0, 1)) / 604800000);
  const nW = Math.max(0, ...iss.map((r) => weekIdx(r[0])), ...add.map((r) => weekIdx(r[0]))) + 1;
  const wI = Array<number>(nW).fill(0), wA = Array<number>(nW).fill(0);
  iss.forEach((r) => wI[weekIdx(r[0])]++); add.forEach((r) => wA[weekIdx(r[0])]++);
  const wl = Array.from({ length: nW }, (_, w) => new Date(Date.UTC(2026, 0, 1 + w * 7)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
  const dm = new Map<string, number>(); iss.forEach((r) => dm.set(r[0], (dm.get(r[0]) || 0) + 1));
  const dk = [...dm.keys()].sort();
  const recv = cnt(iss, (r) => r[7]).slice(0, 10);
  const lineOpts = (extra: Partial<ChartOptions<'line'>> = {}): ChartOptions<'line'> => ({
    maintainAspectRatio: false, responsive: true, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true } }, datalabels: { display: false } },
    scales: { ...axes(t), x: { ...axes(t).x, ticks: { maxTicksLimit: 8, color: t.fg } } }, ...extra,
  });

  /* ---- page 3 ---- */
  const posN = bal.filter((r) => r[5] > 0).length;
  const low = bal.filter((r) => r[3] === 'اقل من الحد الادنى');
  const need = bal.filter((r) => r[3] === 'مطلوب');
  const sm = new Map<string, [number, number]>();
  bal.forEach((r) => { if (!r[1]) return; const a = sm.get(r[1]) || [0, 0]; a[0]++; if (r[5] > 0) a[1]++; sm.set(r[1], a); });
  const se = [...sm.entries()].sort((a, b) => b[1][0] - a[1][0]);
  const lw = [...low].sort((a, b) => a[5] - b[5]).slice(0, 12);
  const types = [...new Set(pr.map((r) => r[2]).filter(Boolean))];
  const stl: Record<number, string> = { 1: 'تم الاستلام', 2: 'استلام جزئي', 0: 'لم يرد' };
  const stc: Record<number, string> = { 1: t.blue, 2: t.v('--olive'), 0: t.blue2 };
  const o = data.oth;

  // نفس الشهر -> اسم الشهر بس، غير كده -> الفترة
  const periodLabel = f.m1 === m2 ? `${MN[f.m1]} 2026` : `${MN[f.m1]} 2026 – ${MN[m2]} 2026`;
  const dlabel = full ? 'Select date' : periodLabel;
  const dot = state === 'error' ? 'err' : state === 'loading' ? 'load' : '';

  return (
    <main dir="rtl">
      {busy && <div className="busy" role="alert">جاري تجهيز ملف PDF...</div>}
      {/* ============ PAGE 1 ============ */}
      <section className="sheet">
        <div className="top">
          <div className="top-l">
            <button className="pill up noexp" type="button" onClick={() => { void printReport(); }}>🖨 طباعة</button>
            <button className="pill up noexp" type="button" disabled={busy} onClick={() => { void onPdf(); }}>{busy ? 'جاري إنشاء PDF...' : '⬇ تحميل PDF'}</button>
            <button className="pill up noexp" type="button" onClick={reload}>تحديث الآن</button>
            <span className="sync noexp" role="status">
              <span className={`dot ${dot}`} />
              {state === 'error' ? `آخر محاولة فشلت: ${error}` : at ? `تحديث تلقائي · آخر مزامنة ${at.toLocaleTimeString('ar-EG')}` : 'جاري المزامنة...'}
              {usingSample && ' · بيانات تجريبية (حط رابط Apps Script في .env)'}
            </span>
            <button className="datebtn noexp" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}><span>{dlabel}</span><span>▾</span></button>
            <span className="perlabel">{periodLabel}</span>
            {open && (
              <div className="pop">
                <label>من شهر<select className="sel" value={f.m1} onChange={(e) => setRange(+e.target.value, m2)}>{MN.slice(0, LAST + 1).map((m, i) => <option key={m} value={i}>{m} 2026</option>)}</select></label>
                <label>إلى شهر<select className="sel" value={m2} onChange={(e) => setRange(f.m1, +e.target.value)}>{MN.slice(0, LAST + 1).map((m, i) => <option key={m} value={i}>{m} 2026</option>)}</select></label>
                <label>المخزن<select className="sel" value={f.store} onChange={(e) => setF((p) => ({ ...p, store: e.target.value }))}><option value="">الكل</option>{STORES.map((s) => <option key={s}>{s}</option>)}</select></label>
                <button className="pill" type="button" onClick={() => setF({ m1: 0, m2: 11, store: '' })}>إعادة ضبط</button>
              </div>
            )}
          </div>
          <div className="ttl">تقرير حركة المخازن العامة 2026</div>
          <Logo />
        </div>

        <div className="tiles">
          <div className="tile t-cyan"><div className="l">إجمالي بنود الصرف</div><div className="v">{fmt(iss.length)}</div></div>
          <div className="tile t-org"><div className="l">عدد أذون الصرف</div><div className="v">{fmt(uniq(iss, (r) => r[1]))}</div></div>
          <div className="tile t-sal"><div className="l">عدد الأصناف المصروفة</div><div className="v">{fmt(uniq(iss, (r) => r[2]))}</div></div>
        </div>
        <div className="tiles">
          {byStore.slice(0, 4).map(([n, c]) => <div key={n} className="tile t-teal"><div className="l">بنود صرف {n}</div><div className="v">{fmt(c)}</div></div>)}
        </div>

        <div className="grid">
          <Card cls="s4" title="بنود الصرف حسب المخزن"><Donut entries={byStore} /></Card>
          <Card cls="s4" plain title="أكثر 10 إدارات صرفاً (عدد البنود)">
            <table className="rank"><tbody>{depts.map((e, i) => <tr key={e[0]}><td>{i + 1}.</td><td>{e[0]}</td><td>{fmt(e[1])}</td></tr>)}</tbody></table>
          </Card>
          <Card cls="s4" plain title="بنود الصرف حسب حالة الصرف">
            <div className="cv short">
              <Bar data={{ labels: statuses.map((e) => e[0]), datasets: [{ data: statuses.map((e) => e[1]), backgroundColor: t.blue, borderRadius: 2, barPercentage: 0.5 }] }}
                options={{ maintainAspectRatio: false, responsive: true, layout: { padding: { top: 22 } }, plugins: { legend: { display: false }, datalabels: { display: true, anchor: 'end', align: 'top', color: t.fg, formatter: (v: number) => fmt(v) } }, scales: axes(t) }} />
            </div>
          </Card>
          <Card cls="s12" plain title="إجمالي الحركة الشهرية: الصرف والإضافة (عدد البنود)">
            <div className="cv">
              <Bar options={monthOpts} data={{ labels: months.map((m) => `${MN[m]} 2026`), datasets: [
                { label: 'الصرف', data: iM, backgroundColor: t.blue, barPercentage: 0.8, categoryPercentage: 0.7 },
                { label: 'الإضافة', data: aM, backgroundColor: t.blue2, barPercentage: 0.8, categoryPercentage: 0.7 }] }} />
            </div>
          </Card>
          <Card cls="s12" plain title="الملخص الشهري">
            <div className="mt"><table>
              <thead><tr><th>البيان</th>{months.map((m) => <th key={m}>{MN[m]}</th>)}<th>الإجمالي</th></tr></thead>
              <tbody>{tbl.map(([n, v], i) => <tr key={n} className={i % 2 === 0 ? 'hi' : ''}><td>{n}</td>{v.map((x, j) => <td key={j}>{x ? fmt(x) : '-'}</td>)}<td><b>{fmt(sum(v))}</b></td></tr>)}</tbody>
            </table></div>
          </Card>
        </div>
      </section>

      {/* ============ PAGE 2 ============ */}
      <section className="sheet">
        <div className="top">
          <div className="top-l"><span className="sel" style={{ minWidth: 0 }}>الفترة: {periodLabel}{f.store ? ' · ' + f.store : ''}</span></div>
          <div className="ttl">الصرف والتوريد التفصيلي</div>
          <Logo />
        </div>
        <div className="tiles">
          <Wt ic="cart" col="#2e7d32" l="بنود الإضافة" v={fmt(add.length)} vc="#d93025" />
          <Wt ic="truck" col="#1565c0" l="أذون الإضافة (أوردر)" v={fmt(uniq(add, (r) => r[1]))} vc="#f2b705" />
          <Wt ic="users" col="#1565c0" l="عدد الموردين" v={fmt(uniq(add, (r) => r[4]))} vc="#12528a" />
          <Wt ic="box" col="#6a4fc2" l="الأصناف المضافة" v={fmt(uniq(add, (r) => r[2]))} vc="#1e9e5a" />
          <Wt ic="doc" col="#f08c00" l="بنود طلبات الشراء" v={fmt(pr.length)} vc="#f08c00" />
          <Wt ic="users" col="#1565c0" l="عدد المستلمين" v={fmt(uniq(iss, (r) => r[7]))} vc="#f2b705" />
        </div>
        <div className="grid">
          <Card cls="s4" title="الصرف مقابل الإضافة (أسبوعياً)">
            <div className="cv"><Line options={lineOpts({ scales: { ...axes(t), x: { ...axes(t).x, ticks: { maxTicksLimit: 8, color: t.fg } } } })} data={{ labels: wl, datasets: [
              { label: 'الصرف', data: wI, borderColor: t.blue, backgroundColor: t.blue + '22', fill: true, tension: 0.35, pointRadius: 2 },
              { label: 'الإضافة', data: wA, borderColor: t.steel, backgroundColor: t.blue2 + '55', fill: true, tension: 0.35, pointRadius: 2 }] }} /></div>
          </Card>
          <Card cls="s4" title="الصرف حسب الوردية"><Donut entries={cnt(iss, (r) => r[5], 'غير محدد')} h="" /></Card>
          <Card cls="s4" title="أكثر 10 أصناف صرفاً"><HBar entries={cnt(iss, (r) => r[2]).slice(0, 10)} color={t.blue} len={26} /></Card>
          <Card cls="s4" title="أعلى 10 مستلمين">
            <Donut entries={recv} pie max={10} h="tall" />
          </Card>
          <Card cls="s4" title="أعلى 10 موردين (بنود الإضافة)"><HBar h="tall" entries={cnt(add, (r) => r[4]).slice(0, 10)} color={t.blue} len={26} /></Card>
          <Card cls="s4" title="الإضافة حسب جهة الشراء"><Donut entries={cnt(add, (r) => r[5], 'غير محدد')} h="" /></Card>
          <Card cls="s6" title="أكثر 10 أصناف إضافة"><HBar entries={cnt(add, (r) => r[2]).slice(0, 10)} color={t.steel} len={40} /></Card>
          <Card cls="s6" title="الصرف اليومي (عدد البنود)">
            <div className="cv"><Line options={lineOpts({ plugins: { legend: { display: false }, datalabels: { display: false } } })} data={{ labels: dk.map((d) => d.slice(5)), datasets: [
              { label: 'بنود الصرف', data: dk.map((k) => dm.get(k) || 0), borderColor: t.blue, backgroundColor: t.blue2 + '66', fill: true, tension: 0.2, pointRadius: 1.5, borderWidth: 1.5 }] }} /></div>
          </Card>
        </div>
      </section>

      {/* ============ PAGE 3 ============ */}
      <section className="sheet">
        <div className="top">
          <div className="top-l"><span className="sel" style={{ minWidth: 0 }}>المخزن: {f.store || 'الكل'}</span></div>
          <div className="ttl">الأرصدة وطلبات الشراء</div>
          <Logo />
        </div>
        <div className="tiles">
          <Nt l="إجمالي الأصناف" v={fmt(bal.length)} c="bl" />
          <Nt l="أصناف برصيد" v={fmt(posN)} c="g" />
          <Nt l="أقل من الحد الأدنى" v={fmt(low.length)} c="o" />
          <Nt l="مطلوب إعادة طلب" v={fmt(need.length)} c="r" />
          <Nt l="بنود التحويلات" v={fmt(o.tr)} c="bl" />
          <Nt l="بنود المرتجع" v={fmt(o.ret)} c="o" />
          <Nt l="بنود التسويات" v={fmt(o.sa + o.sd)} c="g" />
        </div>
        <div className="grid">
          <Card cls="s4" title="توزيع الأصناف حسب المخزن">
            <div className="cv"><Bar data={{ labels: se.map((e) => e[0]), datasets: [
              { label: 'إجمالي الأصناف', data: se.map((e) => e[1][0]), backgroundColor: t.blue2, borderRadius: 2 },
              { label: 'أصناف برصيد', data: se.map((e) => e[1][1]), backgroundColor: t.blue, borderRadius: 2 }] }}
              options={{ maintainAspectRatio: false, responsive: true, layout: { padding: { top: 18 } }, plugins: { legend: { position: 'top', labels: { boxWidth: 12 } }, datalabels: { display: true, anchor: 'end', align: 'top', color: t.fg, font: { size: 10 }, formatter: (v: number) => fmt(v) } }, scales: axes(t) }} /></div>
          </Card>
          <Card cls="s4" title="حالة المخزون مقابل الحدود"><Donut entries={cnt(bal, (r) => r[3])} h="" /></Card>
          <Card cls="s4" plain title="أصناف أقل من الحد الأدنى (الرصيد / الحد الأدنى / حد الطلب)">
            <div className="mt narrow" style={{ maxHeight: 300, overflowY: 'auto' }}><table>
              <thead><tr><th>الصنف</th><th>الرصيد</th><th>الحد الأدنى</th><th>حد الطلب</th></tr></thead>
              <tbody>{lw.map((r, i) => <tr key={i}><td title={r[0]}>{short(r[0], 30)}</td><td className="r">{fmt(r[5])}</td><td>{r[7] == null ? '-' : fmt(r[7])}</td><td>{r[8] == null ? '-' : fmt(r[8])}</td></tr>)}</tbody>
            </table></div>
          </Card>
          <Card cls="s4" title="أعلى 10 مجموعات سلعية (أصناف برصيد)"><HBar h="tall" entries={cnt(bal.filter((r) => r[5] > 0), (r) => r[2]).slice(0, 10)} color={t.blue} len={24} /></Card>
          <Card cls="s4" title="حركة الأصناف"><Donut entries={cnt(bal, (r) => r[4])} pie h="" /></Card>
          <Card cls="s4" title="طلبات الشراء حسب النوع وحالة الاستلام">
            <div className="cv tall"><Bar data={{ labels: types, datasets: ([1, 2, 0] as const).map((s) => ({ label: stl[s], data: types.map((ty) => pr.filter((r) => r[2] === ty && r[5] === s).length), backgroundColor: stc[s], borderRadius: 2 })) }}
              options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { position: 'top', labels: { boxWidth: 12 } }, datalabels: { display: (c) => (c.dataset.data[c.dataIndex] as number) > 0, color: (c) => (c.datasetIndex === 2 ? '#10324f' : '#fff'), font: { size: 10 }, formatter: (v: number) => fmt(v) } },
                scales: { x: { stacked: true, grid: { display: false }, ticks: { color: t.fg } }, y: { stacked: true, grid: { color: t.grid }, border: { display: false }, ticks: { color: t.fg } } } }} /></div>
          </Card>
          <Card cls="s6" title="طلبات الشراء شهرياً">
            <div className="cv short"><Line options={lineOpts({ layout: { padding: { top: 18 } }, plugins: { legend: { display: false }, datalabels: { display: true, align: 'top', color: t.blue, formatter: (v: number) => fmt(v) } } })} data={{ labels: months.map((m) => `${MN[m]} 2026`), datasets: [
              { label: 'بنود طلبات الشراء', data: pM, borderColor: t.blue, backgroundColor: t.blue2 + '66', fill: true, tension: 0.35, pointRadius: 3 }] }} /></div>
          </Card>
          <Card cls="s6" title="طلبات الشراء حسب الإدارة الطالبة"><HBar h="short" entries={cnt(pr, (r) => r[3]).slice(0, 8)} color={t.steel} len={28} /></Card>
        </div>
        <div className="foot">العدد يقصد به عدد بنود الحركة، لأن وحدات القياس مختلفة (عدد، لتر، كيلو، متر). آخر تاريخ في البيانات: {data.asof}. عدد أذون الإضافة = عدد أرقام الأوردر المختلفة.</div>
      </section>
    </main>
  );
}
