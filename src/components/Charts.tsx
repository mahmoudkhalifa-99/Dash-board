import { useEffect, useState } from 'react';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import {
  ArcElement, BarElement, CategoryScale, Chart as C, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import DL from 'chartjs-plugin-datalabels';
import { fmt, short } from '../lib/data';

C.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip, DL);
C.defaults.font.family = "'Cairo',system-ui,sans-serif";
C.defaults.font.size = 12;
C.defaults.animation = false;
C.defaults.set('plugins.datalabels', { display: false });

/** يقرأ ألوان الثيم من CSS ويعيد الرسم لما الثيم يتغير */
export function useTheme() {
  const [, bump] = useState(0);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const f = () => bump((n) => n + 1);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const v = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  C.defaults.color = v('--fg');
  return {
    v, fg: v('--fg'), grid: v('--grid'), blue: v('--blue'), blue2: v('--blue2'), steel: v('--steel'), card: v('--card'),
    cat: [v('--blue'), v('--blue2'), v('--steel'), v('--olive'), '#1b5e7a', '#4f7d5c', '#9db79d', '#0e8a82', '#14148c', '#8b4513'],
  };
}
export type Theme = ReturnType<typeof useTheme>;

/** يعيد قياس كل الشارتات (بعد تغيير عرض الصفحة وقت الطباعة/PDF) */
export function resizeCharts(dpr?: number) {
  Object.values(C.instances).forEach((c) => {
    c.options.devicePixelRatio = dpr ?? (window.devicePixelRatio || 1);
    c.resize();
  });
}

export const axes = (t: Theme, o: { xGrid?: boolean } = {}) => ({
  x: { grid: { color: t.grid, display: o.xGrid ?? false }, border: { display: false }, ticks: { color: t.fg } },
  y: { grid: { color: t.grid }, border: { display: false }, beginAtZero: true, ticks: { color: t.fg } },
});

export function HBar({ entries, color, len = 30, h = '' }: { entries: [string, number][]; color: string; len?: number; h?: string }) {
  const t = useTheme();
  const opts: ChartOptions<'bar'> = {
    indexAxis: 'y', maintainAspectRatio: false, responsive: true, layout: { padding: { right: 46 } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { title: (i) => entries[i[0].dataIndex][0] } },
      datalabels: { display: true, anchor: 'end', align: 'right', offset: 12, clamp: true, color: t.fg, font: { size: 11 }, formatter: (v: number) => fmt(v) },
    },
    scales: {
      x: { grid: { color: t.grid }, border: { display: false }, beginAtZero: true, ticks: { color: t.fg } },
      y: { grid: { display: false }, border: { display: false }, ticks: { color: t.fg, font: { size: 11 } } },
    },
  };
  return (
    <div className={`cv ${h}`}>
      <Bar options={opts} data={{ labels: entries.map((e) => short(e[0], len)), datasets: [{ data: entries.map((e) => e[1]), backgroundColor: color, borderRadius: 2, barPercentage: 0.78 }] }} />
    </div>
  );
}

export function Donut({ entries, pie = false, max = 8, h = 'short' }: { entries: [string, number][]; pie?: boolean; max?: number; h?: string }) {
  const t = useTheme();
  let e = entries;
  if (e.length > max) {
    const rest = e.slice(max - 1).reduce((s, x) => s + x[1], 0);
    e = e.slice(0, max - 1).concat([['أخرى', rest]]);
  }
  const tot = e.reduce((s, x) => s + x[1], 0) || 1;
  const data = { labels: e.map((x) => x[0]), datasets: [{ data: e.map((x) => x[1]), backgroundColor: e.map((_, i) => t.cat[i % t.cat.length]), borderWidth: 1, borderColor: t.card }] };
  const opts: ChartOptions<'doughnut'> = {
    maintainAspectRatio: false, responsive: true, cutout: pie ? 0 : '58%',
    plugins: {
      legend: { display: false },
      datalabels: { display: (c) => (c.dataset.data[c.dataIndex] as number) / tot > 0.045, color: (c) => ([1, 6].includes(c.dataIndex) ? '#10324f' : '#fff'), font: { size: 11 }, formatter: (v: number) => ((v / tot) * 100).toFixed(1) + '%' },
    },
  };
  return (
    <div className="split">
      <div className={`cv ${h}`}>{pie ? <Pie data={data} options={opts as never} /> : <Doughnut data={data} options={opts} />}</div>
      <div className="leg">
        {e.map((x, i) => (
          <div key={x[0]}><i style={{ background: t.cat[i % t.cat.length] }} /><span title={x[0]}>{short(x[0], 26)}</span><b>{fmt(x[1])}</b></div>
        ))}
      </div>
    </div>
  );
}

export { Bar, Line };
