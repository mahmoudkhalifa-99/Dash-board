import { resizeCharts } from '../components/Charts';

/** عرض الصفحة الثابت وقت الطباعة/التصدير (نفس شكل الديسكتوب بغض النظر عن حجم الشاشة) */
const W = 1400;
let active = false;

const sheets = () => Array.from(document.querySelectorAll<HTMLElement>('.sheet'));
const hexToRgb = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** يثبّت التخطيط على عرض ثابت ويعيد رسم الشارتات بدقة أعلى */
export function enterExport() {
  if (active) return;
  active = true;
  document.documentElement.classList.add('exporting');
  resizeCharts(Math.max(2, window.devicePixelRatio || 1));
}

/** للطباعة: يصغّر كل صفحة (zoom) لتناسب ورقة A4 أفقي بالكامل */
export function fitForPrint() {
  const availW = 285 * 3.7795; // A4 landscape - هوامش 6mm
  const availH = 198 * 3.7795 - 4;
  sheets().forEach((s) => {
    s.style.zoom = '1';
    const h = s.getBoundingClientRect().height;
    s.style.zoom = String(Math.min(1, availW / W, availH / h));
  });
}

export function leaveExport() {
  if (!active) return;
  active = false;
  sheets().forEach((s) => { s.style.zoom = ''; });
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
    const css = getComputedStyle(document.documentElement);
    const pageBg = hexToRgb(css.getPropertyValue('--page'));
    const sheetBg = css.getPropertyValue('--bg').trim() || '#ffffff';
    const M = 4; // mm
    let pdf: InstanceType<typeof jsPDF> | null = null;

    for (const el of sheets()) {
      const cv = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: sheetBg, windowWidth: W + 100, scrollX: 0, scrollY: 0 });
      const ratio = cv.height / cv.width;
      // يختار الاتجاه (أفقي/رأسي) اللي يخلي الصفحة أكبر على الورقة
      const fit = (pw: number, ph: number) => Math.min((pw - 2 * M) / 1, (ph - 2 * M) / ratio);
      const land = fit(297, 210) >= fit(210, 297);
      const orient = land ? 'landscape' : 'portrait';
      if (!pdf) pdf = new jsPDF({ orientation: orient, unit: 'mm', format: 'a4', compress: true });
      else pdf.addPage('a4', orient);
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(...pageBg);
      pdf.rect(0, 0, pw, ph, 'F');
      const w = fit(pw, ph), h = w * ratio;
      pdf.addImage(cv.toDataURL('image/png'), 'PNG', (pw - w) / 2, (ph - h) / 2, w, h, undefined, 'FAST');
    }
    pdf?.save(`dakahlia-warehouse-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    leaveExport();
    window.scrollTo(0, y);
  }
}
