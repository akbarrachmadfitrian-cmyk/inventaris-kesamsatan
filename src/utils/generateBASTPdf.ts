import jsPDF from 'jspdf';
import { FastDeviceEntry, DeviceRequest } from '../types';

export const generateBASTPdf = async (request: DeviceRequest, devices: FastDeviceEntry[], orderNumber: number): Promise<{ file: File, dataUrl: string }> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [215, 330] // F4 size
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  // Draw Full Kop Surat Logo Banner
  const drawKopSurat = async () => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.src = '/kop-surat-bapenda.png';
      img.onload = () => {
        // Full width kop surat, keeping original margins
        doc.addImage(img, 'PNG', 15, 10, width - 30, 35);
        resolve();
      };
      img.onerror = () => resolve(); // fallback
    });
  };

  await drawKopSurat();

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('BERITA ACARA SERAH TERIMA BARANG', width / 2, 62, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line((width / 2) - 43, 63, (width / 2) + 43, 63);

  // Number
  const RomanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const monthIdx = new Date().getMonth();
  const year = new Date().getFullYear();
  const baNumber = `NO. ${orderNumber} / ${RomanMonths[monthIdx]} - IPSIPD/INFRASTRUKTUR/${year}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(baNumber, width / 2, 68, { align: 'center' });

  // Details Section
  let y = 85;
  const leftX = 25;
  const colonX = 65;

  doc.text('Untuk Keperluan', leftX, y);
  doc.text(':', colonX, y);
  doc.text(`UPPD ${request.samsat}`, colonX + 5, y);
  
  y += 7;
  doc.text('Jenis Barang', leftX, y);
  doc.text(':', colonX, y);
  doc.text(request.requestType, colonX + 5, y);
  
  y += 7;
  doc.text('Nomor Permintaan', leftX, y);
  doc.text(':', colonX, y);
  doc.text(request.requestId, colonX + 5, y);

  // Table
  y += 15;
  const tableTop = y;
  
  // Table Headers
  doc.setFont('helvetica', 'bold');
  doc.text('No', 22, y + 6);
  doc.text('Nama/Merk/Ukuran /SN', 60, y + 6);
  doc.text('Jumlah', 135, y + 6);
  doc.text('Keterangan', 165, y + 6);

  // Draw Header rect
  doc.rect(20, y, 10, 10);      // No
  doc.rect(30, y, 100, 10);     // Nama
  doc.rect(130, y, 30, 10);     // Jumlah
  doc.rect(160, y, 35, 10);     // Keterangan

  y += 10;
  doc.setFont('helvetica', 'normal');
  
  // Rows
  const rowHeight = Math.max(20, Object.keys(devices).length * 10);
  
  devices.forEach((dev, idx) => {
    const rowY = y + (idx * 15);
    doc.text((idx + 1).toString(), 24, rowY + 6);
    
    // Auto scale text or split it
    doc.text(dev.name, 33, rowY + 6);
    doc.text(`SN: ${dev.serialNumber}`, 33, rowY + 12);
    
    doc.text('1 Buah', 138, rowY + 8);
    doc.text(dev.budgetYear || `T.A ${year}`, 168, rowY + 8);
  });

  // Draw main content rects based on full height calculated
  const totalRowHeight = devices.length * 15 + 5;
  doc.rect(20, y, 10, totalRowHeight);      // No
  doc.rect(30, y, 100, totalRowHeight);     // Nama
  doc.rect(130, y, 30, totalRowHeight);     // Jumlah
  doc.rect(160, y, 35, totalRowHeight);     // Keterangan

  y += totalRowHeight + 10;

  // Footer text
  const footerText = 'Barang tersebut diatas dalam keadaan BAIK dan SIAP dipergunakan/dipakai.\nPemegang/Pengguna (yang menerima) wajib bertanggung jawab pada barang tersebut dan\nmemelihara barang tersebut diatas.';
  doc.setFontSize(11);
  const splitFooter = doc.splitTextToSize(footerText, width - 40);
  doc.text(splitFooter, 20, y);

  y += 30;
  
  // Signatures
  const dateStr = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date());
  doc.text(`Banjarbaru,       ${dateStr}`, 140, y);
  
  y += 15;
  doc.text('Mengetahui,', 60, y, { align: 'center' });
  doc.text('Kabid Inovasi Dan Pengelolaan Sistem', 60, y + 5, { align: 'center' });
  doc.text('Informasi Pendapatan daerah', 60, y + 10, { align: 'center' });

  doc.text('Menyerahkan,', 140, y, { align: 'center' });
  doc.text('Kepala Subbidang Infrastruktur dan', 140, y + 5, { align: 'center' });
  doc.text('tata kelola Pendapatan Daerah', 140, y + 10, { align: 'center' });

  doc.text('Menerima,', 185, y, { align: 'center' });

  y += 35;
  doc.setFont('helvetica', 'bold');
  doc.text('ANDI IRAWAN, S.Kom., M.I.P', 60, y, { align: 'center' });
  doc.setLineWidth(0.3);
  doc.line(30, y + 1, 90, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.text('NIP. 19830228 200803 1 005', 60, y + 6, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('MAHYUNI, SE', 140, y, { align: 'center' });
  doc.setLineWidth(0.3);
  doc.line(115, y + 1, 165, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.text('NIP. 19910321 201402 1 004', 140, y + 6, { align: 'center' });

  // Convert to file
  const blob = doc.output('blob');
  const file = new File([blob], `BAST-${request.samsat}-${new Date().getTime()}.pdf`, { type: 'application/pdf' });
  const dataUrl = doc.output('datauristring');
  
  return { file, dataUrl };
};
