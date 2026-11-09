import { resizeCharts } from '../components/Charts';

/**
 * كل الصفحات بنفس العرض والارتفاع بالظبط (A4 رأسي، بدقة 150dpi = 1240x1754).
 * المحتوى بيتمدد (ارتفاع الشارتات) عشان يملا الصفحة من غير أي فراغ.
 * لو أطول صفحة محتواها أكبر من A4، كل الصفحات بتاخد نفس الارتفاع الأكبر.
 */
const W = 1240;
const RATIO = 297 / 210;
let active = false;
let pageH = Math.round(W * RATIO);

const sheets = () => Array.from(document.querySelectorAll<HTMLElement>('.sheet'));

function resetSheet(s: HTMLElement) {
  s.style.height = '';
  s.style.zoom = '';
  s.querySelectorAll<HTMLElement>('.cv').forEach((cv) => { cv.style.height = ''; });
  const g = s.querySelector<HTMLElement>('.grid');
  if (g) g.style.alignItems = '';
}

type Row = { rowH: number; cards: { h: number; cv: HTMLElement[] }[] };

/** يوزّع المساحة الزيادة على صفوف الشارتات لحد ما ارتفاع الصفحة يساوي H */
function grow(s: HTMLElement, H: number) {
  const grid = s.querySelector<HTMLElement>('.grid');
  if (grid) {
    grid.style.alignItems = 'start'; // عشان نقيس الارتفاع الطبيعي لكل كارت
    const measure = (): Row[] => {
      const map = new Map<number, Row>();
      grid.querySelectorAll<HTMLElement>(':scope > .card').forEach((card) => {
        const top = Math.round(card.offsetTop);
        const r = map.get(top) ?? { rowH: 0, cards: [] };
        const h = card.getBoundingClientRect().height;
        r.rowH = Math.max(r.rowH, h);
        r.cards.push({ h, cv: Array.from(card.querySelectorAll<HTMLElement>('.cv')) });
        map.set(top, r);
      });
      return [...map.values()].filter((r) => r.cards.some((c) => c.cv.length));
    };
    const apply = (r: Row, target: number) =>
      r.cards.forEach((c) => c.cv.forEach((cv) => {
        cv.style.height = Math.max(120, cv.getBoundingClientRect().height + (target - c.h)) + 'px';
      }));

    let rows = measure();
    if (rows.length) {
      const share = (H - s.getBoundingClientRect().height) / rows.length;
      rows.forEach((r) => apply(r, r.rowH + share));
      rows = measure();
      const resid = H - s.getBoundingClientRect().height;
      if (rows.length && Math.abs(resid) > 0.5) apply(rows[rows.length - 1], rows[rows.length - 1].rowH + resid);
    }
    grid.style.alignItems = '';
  }
  s.style.height = H + 'px';
}

function layoutPages() {
  const els = sheets();
  els.forEach(resetSheet);
  const nat = els.map((s) => s.getBoundingClientRect().height);
  pageH = Math.ceil(Math.max(W * RATIO, ...nat));
  els.forEach((s) => grow(s, pageH));
}

/** يثبّت التخطيط على عرض/ارتفاع ثابتين ويعيد رسم الشارتات بدقة أعلى */
export function enterExport() {
  if (active) return;
  active = true;
  document.documentElement.classList.add('exporting');
  layoutPages();
  resizeCharts(Math.max(2, window.devicePixelRatio || 1));
}

/** للطباعة: كل صفحة تتصغّر (zoom) لتملا ورقة A4 رأسي بالكامل (@page margin 0) */
export function fitForPrint() {
  const z = Math.min((210 * 3.7795) / W, (297 * 3.7795) / pageH) * 0.995;
  sheets().forEach((s) => { s.style.zoom = String(z); });
}

export function leaveExport() {
  if (!active) return;
  active = false;
  sheets().forEach(resetSheet);
  document.documentElement.classList.remove('exporting');
  resizeCharts();
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export async function printReport() {
  enterExport();
  await frame();
  fitForPrint();
  window.print();
  if (!('onafterprint' in window)) leaveExport(); // متصفحات بدون afterprint
}

export async function downloadPdf() {
  const y = window.scrollY;
  window.scrollTo(0, 0);
  enterExport();
  try {
    await document.fonts.ready;
    await frame();
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
    const sheetBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
    const mmW = 210, mmH = Math.round(((210 * pageH) / W) * 100) / 100; // نفس المقاس لكل الصفحات (297 لو المحتوى بيساع A4)
    let pdf: InstanceType<typeof jsPDF> | null = null;

    for (const el of sheets()) {
      const cv = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: sheetBg, windowWidth: W + 100, scrollX: 0, scrollY: 0 });
      if (!pdf) pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [mmW, mmH], compress: true, putOnlyUsedFonts: true });
      else pdf.addPage([mmW, mmH], 'portrait');
      pdf.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, mmW, mmH, undefined, 'FAST'); // ملء الصفحة بالكامل
    }
    pdf?.save(`dakahlia-warehouse-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    leaveExport();
    window.scrollTo(0, y);
  }
}
