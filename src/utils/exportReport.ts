import type { Device, Stats } from '../types';

/* ──────────────────────────────────────────────────────────
   Shared helpers
   ────────────────────────────────────────────────────────── */

const normalizeCondition = (raw: string) => {
  const v = (raw || '').trim();
  if (!v) return 'Kurang Baik';
  const u = v.toUpperCase();
  if ((u.includes('NON') && u.includes('AKTIF')) || u.includes('INACTIVE')) return 'Rusak';
  if (u.includes('TIDAK BAIK')) return 'Rusak';
  if (u.includes('RUSAK') || u.includes('MATI') || u.includes('ERROR') || u.includes('LAYAR')) return 'Rusak';
  if (u.includes('KURANG') || u.includes('MINOR') || u.includes('LEMOT')) return 'Kurang Baik';
  if (u.includes('BAIK') || u.includes('AKTIF') || u.includes('ACTIVE') || u.includes('NORMAL') || u.includes('OK')) return 'Baik';
  return 'Kurang Baik';
};

const dateLabel = () => {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
};

const computeStats = (devs: Device[]): Stats => {
  const total = devs.length;
  const baik = devs.filter(d => normalizeCondition(d.condition) === 'Baik').length;
  const kurangBaik = devs.filter(d => normalizeCondition(d.condition) === 'Kurang Baik').length;
  const rusak = devs.filter(d => normalizeCondition(d.condition) === 'Rusak').length;
  const layanan = new Set(devs.map(d => d.serviceUnit)).size;
  const lengkapTotal = devs.filter(d => d.dataComplete).length;
  const tidakLengkapTotal = total - lengkapTotal;
  const lengkapBaik = devs.filter(d => d.dataComplete && normalizeCondition(d.condition) === 'Baik').length;
  const tidakLengkapBaik = devs.filter(d => !d.dataComplete && normalizeCondition(d.condition) === 'Baik').length;
  const lengkapTidakBaik = lengkapTotal - lengkapBaik;
  const tidakLengkapTidakBaik = tidakLengkapTotal - tidakLengkapBaik;
  return { total, baik, kurangBaik, rusak, layanan, lengkapTotal, tidakLengkapTotal, lengkapBaik, lengkapTidakBaik, tidakLengkapBaik, tidakLengkapTidakBaik };
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/* ──────────────────────────────────────────────────────────
   PDF — Per-Samsat
   ────────────────────────────────────────────────────────── */

export const exportPerSamsatPdf = async (
  devices: Device[],
  samsat: string,
  stats: Stats
) => {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableW = pageW - margin * 2;

  /* --- Header --- */
  let y = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LAPORAN INVENTARIS PERANGKAT', pageW / 2, y, { align: 'center' });
  y += 20;
  doc.setFontSize(12);
  doc.text(samsat, pageW / 2, y, { align: 'center' });
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Diekspor: ${dateLabel()}`, pageW / 2, y, { align: 'center' });
  y += 24;

  /* --- Summary --- */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RINGKASAN', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const summaryParts = [
    `Total: ${stats.total}`,
    `Baik: ${stats.baik}`,
    `Kurang Baik: ${stats.kurangBaik}`,
    `Rusak: ${stats.rusak}`,
    `Jenis Layanan: ${stats.layanan}`,
    `Data Lengkap: ${stats.lengkapTotal}`,
    `Data Tidak Lengkap: ${stats.tidakLengkapTotal}`,
  ];
  doc.text(summaryParts.join('   |   '), margin, y);
  y += 22;

  /* --- Table --- */
  const cols = [
    { header: 'No', width: 30 },
    { header: 'Nama Perangkat', width: usableW * 0.18 },
    { header: 'Serial Number', width: usableW * 0.14 },
    { header: 'Kondisi', width: usableW * 0.08 },
    { header: 'Layanan', width: usableW * 0.14 },
    { header: 'Pengguna', width: usableW * 0.1 },
    { header: 'No HP', width: usableW * 0.1 },
    { header: 'Thn Anggaran', width: usableW * 0.08 },
    { header: 'Sumber Anggaran', width: usableW * 0.1 },
  ];
  // Recalculate widths to fill remaining space after "No"
  const totalDeclared = cols.reduce((s, c) => s + c.width, 0);
  const scale = usableW / totalDeclared;
  cols.forEach(c => { c.width = Math.floor(c.width * scale); });

  const rowH = 18;
  const headerH = 22;

  const drawTableHeader = (startY: number) => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, startY, usableW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    cols.forEach(c => {
      doc.text(c.header, x + 4, startY + 14);
      x += c.width;
    });
    doc.setTextColor(0, 0, 0);
    return startY + headerH;
  };

  y = drawTableHeader(y);

  devices.forEach((d, idx) => {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = margin;
      y = drawTableHeader(y);
    }

    // Striped row
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(margin, y, usableW, rowH, 'F');
    }

    // Row border
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(margin, y, usableW, rowH, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    let x = margin;
    const vals = [
      String(idx + 1),
      d.name || '-',
      d.serialNumber || '-',
      normalizeCondition(d.condition),
      d.serviceUnit || '-',
      d.subLocation || '-',
      d.phoneNumber || '-',
      d.budgetYear || '-',
      d.budgetSource || '-',
    ];
    vals.forEach((v, ci) => {
      const maxChars = Math.floor(cols[ci].width / 4.5);
      const truncated = v.length > maxChars ? v.slice(0, maxChars - 2) + '..' : v;
      doc.text(truncated, x + 4, y + 12);
      x += cols[ci].width;
    });
    y += rowH;
  });

  const blob = doc.output('blob');
  triggerDownload(blob, `Laporan-${samsat.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`);
};

/* ──────────────────────────────────────────────────────────
   PDF — All Samsat Combined
   ────────────────────────────────────────────────────────── */

export const exportAllSamsatPdf = async (
  allDevices: Device[],
  samsatList: string[]
) => {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableW = pageW - margin * 2;

  /* --- Cover page --- */
  let y = 120;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('LAPORAN INVENTARIS PERANGKAT', pageW / 2, y, { align: 'center' });
  y += 28;
  doc.setFontSize(14);
  doc.text('SELURUH KANTOR SAMSAT', pageW / 2, y, { align: 'center' });
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('BAPENDA PROVINSI KALIMANTAN SELATAN', pageW / 2, y, { align: 'center' });
  y += 30;
  doc.setFontSize(9);
  doc.text(`Diekspor: ${dateLabel()}`, pageW / 2, y, { align: 'center' });

  /* --- Global summary --- */
  y += 50;
  const globalStats = computeStats(allDevices);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RINGKASAN KESELURUHAN', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total Perangkat: ${globalStats.total}    |    Baik: ${globalStats.baik}    |    Kurang Baik: ${globalStats.kurangBaik}    |    Rusak: ${globalStats.rusak}`, margin, y);
  y += 14;
  doc.text(`Data Lengkap: ${globalStats.lengkapTotal}    |    Data Tidak Lengkap: ${globalStats.tidakLengkapTotal}    |    Jenis Layanan: ${globalStats.layanan}`, margin, y);

  /* --- Per-samsat summary table --- */
  y += 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RINGKASAN PER SAMSAT', margin, y);
  y += 16;

  // Header
  const sumCols = [
    { header: 'No', w: 30 },
    { header: 'Samsat', w: usableW * 0.35 },
    { header: 'Total', w: usableW * 0.1 },
    { header: 'Baik', w: usableW * 0.1 },
    { header: 'Kurang Baik', w: usableW * 0.12 },
    { header: 'Rusak', w: usableW * 0.1 },
    { header: 'Data Lengkap', w: usableW * 0.13 },
  ];
  const sumTotalW = sumCols.reduce((s, c) => s + c.w, 0);
  const sumScale = usableW / sumTotalW;
  sumCols.forEach(c => { c.w = Math.floor(c.w * sumScale); });

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, usableW, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  let sx = margin;
  sumCols.forEach(c => { doc.text(c.header, sx + 4, y + 14); sx += c.w; });
  doc.setTextColor(0, 0, 0);
  y += 20;

  const sortedSamsat = [...samsatList].sort((a, b) => a.localeCompare(b));
  sortedSamsat.forEach((samsat, idx) => {
    if (y + 18 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    const devs = allDevices.filter(d => String(d.samsat || '').trim() === samsat);
    const st = computeStats(devs);
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, usableW, 18, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, usableW, 18, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    sx = margin;
    [String(idx + 1), samsat, String(st.total), String(st.baik), String(st.kurangBaik), String(st.rusak), String(st.lengkapTotal)].forEach((v, ci) => {
      doc.text(v, sx + 4, y + 12);
      sx += sumCols[ci].w;
    });
    y += 18;
  });

  /* --- Detail pages per samsat --- */
  const rowH = 18;
  const headerH = 22;
  const detailCols = [
    { header: 'No', width: 30 },
    { header: 'Nama Perangkat', width: usableW * 0.18 },
    { header: 'Serial Number', width: usableW * 0.14 },
    { header: 'Kondisi', width: usableW * 0.08 },
    { header: 'Layanan', width: usableW * 0.14 },
    { header: 'Pengguna', width: usableW * 0.1 },
    { header: 'No HP', width: usableW * 0.1 },
    { header: 'Thn Anggaran', width: usableW * 0.08 },
    { header: 'Sumber Anggaran', width: usableW * 0.1 },
  ];
  const detailTotalW = detailCols.reduce((s, c) => s + c.width, 0);
  const detailScale = usableW / detailTotalW;
  detailCols.forEach(c => { c.width = Math.floor(c.width * detailScale); });

  const drawDetailHeader = (startY: number) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, startY, usableW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    detailCols.forEach(c => { doc.text(c.header, x + 4, startY + 14); x += c.width; });
    doc.setTextColor(0, 0, 0);
    return startY + headerH;
  };

  sortedSamsat.forEach(samsat => {
    const devs = allDevices.filter(d => String(d.samsat || '').trim() === samsat);
    if (devs.length === 0) return;

    doc.addPage();
    y = margin;

    // Samsat title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(samsat, pageW / 2, y, { align: 'center' });
    y += 16;
    const st = computeStats(devs);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total: ${st.total}  |  Baik: ${st.baik}  |  Kurang Baik: ${st.kurangBaik}  |  Rusak: ${st.rusak}`, pageW / 2, y, { align: 'center' });
    y += 20;

    y = drawDetailHeader(y);

    devs.forEach((d, idx) => {
      if (y + rowH > pageH - margin) {
        doc.addPage();
        y = margin;
        y = drawDetailHeader(y);
      }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, usableW, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, usableW, rowH, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      let x = margin;
      const vals = [
        String(idx + 1),
        d.name || '-',
        d.serialNumber || '-',
        normalizeCondition(d.condition),
        d.serviceUnit || '-',
        d.subLocation || '-',
        d.phoneNumber || '-',
        d.budgetYear || '-',
        d.budgetSource || '-',
      ];
      vals.forEach((v, ci) => {
        const maxChars = Math.floor(detailCols[ci].width / 4.5);
        const truncated = v.length > maxChars ? v.slice(0, maxChars - 2) + '..' : v;
        doc.text(truncated, x + 4, y + 12);
        x += detailCols[ci].width;
      });
      y += rowH;
    });
  });

  const blob = doc.output('blob');
  triggerDownload(blob, `Laporan-Semua-Samsat-${new Date().toISOString().slice(0, 10)}.pdf`);
};

/* ──────────────────────────────────────────────────────────
   Excel — Per-Samsat
   ────────────────────────────────────────────────────────── */

export const exportPerSamsatExcel = async (
  devices: Device[],
  samsat: string,
  stats: Stats
) => {
  const XLSX = await import('xlsx');

  /* Sheet 1 - Summary */
  const summaryData = [
    ['LAPORAN INVENTARIS PERANGKAT'],
    [samsat],
    [`Diekspor: ${dateLabel()}`],
    [],
    ['Kategori', 'Jumlah'],
    ['Total Perangkat', stats.total],
    ['Kondisi Baik', stats.baik],
    ['Kondisi Kurang Baik', stats.kurangBaik],
    ['Rusak / Tidak Baik', stats.rusak],
    ['Jenis Layanan', stats.layanan],
    ['Data Lengkap', stats.lengkapTotal],
    ['Data Tidak Lengkap', stats.tidakLengkapTotal],
  ];
  const wsSum = XLSX.utils.aoa_to_sheet(summaryData);
  // Merge title cells
  wsSum['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
  ];
  wsSum['!cols'] = [{ wch: 25 }, { wch: 15 }];

  /* Sheet 2 - Detail */
  const headers = ['No', 'Nama Perangkat', 'Serial Number', 'Kondisi', 'Layanan', 'Pengguna', 'No HP', 'Tahun Anggaran', 'Sumber Anggaran', 'Riwayat Servis'];
  const rows = devices.map((d, i) => [
    i + 1,
    d.name || '-',
    d.serialNumber || '-',
    normalizeCondition(d.condition),
    d.serviceUnit || '-',
    d.subLocation || '-',
    d.phoneNumber || '-',
    d.budgetYear || '-',
    d.budgetSource || '-',
    d.serviceHistory || '-',
  ]);
  const detailData = [
    [`DETAIL PERANGKAT — ${samsat}`],
    [`Diekspor: ${dateLabel()}`],
    [],
    headers,
    ...rows,
  ];
  const wsDet = XLSX.utils.aoa_to_sheet(detailData);
  wsDet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
  ];
  // Auto-filter on header row (row index 3)
  wsDet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + rows.length, c: headers.length - 1 } }) };
  wsDet['!cols'] = [
    { wch: 5 },  // No
    { wch: 30 }, // Nama
    { wch: 22 }, // SN
    { wch: 14 }, // Kondisi
    { wch: 25 }, // Layanan
    { wch: 18 }, // Pengguna
    { wch: 16 }, // No HP
    { wch: 14 }, // Thn Anggaran
    { wch: 16 }, // Sumber Anggaran
    { wch: 20 }, // Riwayat Servis
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSum, 'Ringkasan');
  XLSX.utils.book_append_sheet(wb, wsDet, 'Detail Perangkat');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, `Laporan-${samsat.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/* ──────────────────────────────────────────────────────────
   Excel — All Samsat Combined
   ────────────────────────────────────────────────────────── */

export const exportAllSamsatExcel = async (
  allDevices: Device[],
  samsatList: string[]
) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const sortedSamsat = [...samsatList].sort((a, b) => a.localeCompare(b));
  const globalStats = computeStats(allDevices);

  /* Sheet 1 - Global summary */
  const globalSummary = [
    ['LAPORAN INVENTARIS PERANGKAT — SELURUH SAMSAT'],
    ['BAPENDA PROVINSI KALIMANTAN SELATAN'],
    [`Diekspor: ${dateLabel()}`],
    [],
    ['RINGKASAN KESELURUHAN'],
    ['Kategori', 'Jumlah'],
    ['Total Perangkat', globalStats.total],
    ['Kondisi Baik', globalStats.baik],
    ['Kondisi Kurang Baik', globalStats.kurangBaik],
    ['Rusak / Tidak Baik', globalStats.rusak],
    ['Jenis Layanan', globalStats.layanan],
    ['Data Lengkap', globalStats.lengkapTotal],
    ['Data Tidak Lengkap', globalStats.tidakLengkapTotal],
    [],
    ['RINGKASAN PER SAMSAT'],
    ['No', 'Samsat', 'Total', 'Baik', 'Kurang Baik', 'Rusak', 'Data Lengkap', 'Data Tidak Lengkap'],
    ...sortedSamsat.map((s, i) => {
      const devs = allDevices.filter(d => String(d.samsat || '').trim() === s);
      const st = computeStats(devs);
      return [i + 1, s, st.total, st.baik, st.kurangBaik, st.rusak, st.lengkapTotal, st.tidakLengkapTotal];
    }),
  ];
  const wsGlobal = XLSX.utils.aoa_to_sheet(globalSummary);
  wsGlobal['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
  ];
  wsGlobal['!cols'] = [
    { wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsGlobal, 'Ringkasan');

  /* Sheet per samsat */
  const headers = ['No', 'Nama Perangkat', 'Serial Number', 'Kondisi', 'Layanan', 'Pengguna', 'No HP', 'Tahun Anggaran', 'Sumber Anggaran', 'Riwayat Servis'];
  sortedSamsat.forEach(samsat => {
    const devs = allDevices.filter(d => String(d.samsat || '').trim() === samsat);
    if (devs.length === 0) return;
    const st = computeStats(devs);
    const rows = devs.map((d, i) => [
      i + 1,
      d.name || '-',
      d.serialNumber || '-',
      normalizeCondition(d.condition),
      d.serviceUnit || '-',
      d.subLocation || '-',
      d.phoneNumber || '-',
      d.budgetYear || '-',
      d.budgetSource || '-',
      d.serviceHistory || '-',
    ]);
    const sheetData = [
      [samsat],
      [`Total: ${st.total}  |  Baik: ${st.baik}  |  Kurang Baik: ${st.kurangBaik}  |  Rusak: ${st.rusak}`],
      [],
      headers,
      ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ];
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + rows.length, c: headers.length - 1 } }) };
    ws['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
    ];
    // Sheet name must be <= 31 chars
    const sheetName = samsat.length > 31 ? samsat.slice(0, 31) : samsat;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, `Laporan-Semua-Samsat-${new Date().toISOString().slice(0, 10)}.xlsx`);
};
