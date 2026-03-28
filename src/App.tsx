import { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { 
  Camera, Upload, CheckCircle2, QrCode, Search, RefreshCw,
  Monitor, Printer, LayoutDashboard, ChevronRight,
  Building2, Layers, XCircle, AlertTriangle,
  Trash2, Plus, FileUp, Clock3,
  ChevronDown, List, KeyRound, Inbox, Send
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Device {
  id: string;
  name: string;
  category: string;
  location: string;
  subLocation?: string;
  serialNumber: string;
  phoneNumber: string;
  condition: 'Baik' | 'Kurang Baik' | 'Rusak' | 'Layar Rusak' | string;
  photo?: string;
  isComplete: boolean;
  dataComplete: boolean;
  samsat: string;
  serviceUnit: string;
  sheetName: string;
}

interface Stats {
  total: number;
  baik: number;
  kurangBaik: number;
  rusak: number;
  layanan: number;
  lengkapTotal: number;
  tidakLengkapTotal: number;
  lengkapBaik: number;
  lengkapTidakBaik: number;
  tidakLengkapBaik: number;
  tidakLengkapTidakBaik: number;
}

type StockStatus = 'ready' | 'empty' | 'standby';
type ApprovalStatus = 'approved' | 'rejected' | 'pending';
type RequestType = 'PC KESAMSATAN' | 'PRINTER KESAMSATAN';

interface DeviceRequestLetter {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
}

interface DeviceRequest {
  samsat: string;
  requestType: RequestType;
  requestedCount: number;
  letter: DeviceRequestLetter | null;
  stockStatus: StockStatus;
  kabid: { status: ApprovalStatus; approvedCount: number | null };
  sekban: { status: ApprovalStatus; approvedCount: number | null };
  addedDeviceIds: string[];
  finalizedAt: string | null;
}

const LS_DELETED_DEVICE_IDS = 'samsat_deleted_device_ids';
const LS_ADDED_DEVICES = 'samsat_added_devices';
const LS_DEVICE_REQUESTS = 'samsat_device_requests';
const LS_INBOX_MESSAGES = 'samsat_inbox_messages';
const LS_MESSAGE_DIRECTORY = 'samsat_message_directory';

type InboxKind = 'damage_report' | 'device_request';
type InboxStatus = 'unread' | 'read';

interface InboxAttachment {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
}

interface DamageReportPayload {
  kerusakanPerangkat: string;
  layananRusak: string;
  jenisMerkSnPerangkatRusak: string;
  namaDanKontakPengguna: string;
  perbaikanMandiri: 'Sudah' | 'Belum';
  alasanBelumMelaksanakanPerbaikanMandiri: string | null;
  kwitansiBuktiPerbaikan: InboxAttachment | null;
  fotoPerangkatRusak: InboxAttachment | null;
}

interface DeviceRequestSubmissionPayload {
  suratPermintaan: InboxAttachment | null;
  untukLayanan: string;
  kebutuhanPerangkat: 'PC KESAMSATAN' | 'PRINTER KESAMSATAN' | 'PC & PRINTER KESAMSATAN';
  jumlahPermintaan: number | null;
  jumlahPermintaanPC: number | null;
  jumlahPermintaanPrinter: number | null;
  alasanPermintaan: string;
}

interface InboxMessage {
  id: string;
  kind: InboxKind;
  status: InboxStatus;
  samsat: string;
  createdAt: string;
  payload: DamageReportPayload | DeviceRequestSubmissionPayload;
}

type MessageDirectoryKind = 'message' | 'kwitansi' | 'foto' | 'surat';

interface MessageDirectoryItem {
  id: string;
  inboxMessageId: string;
  inboxKind: InboxKind;
  samsat: string;
  kind: MessageDirectoryKind;
  fileName: string;
  mimeType: 'application/pdf';
  dataUrl: string;
  createdAt: string;
  expiresAt: string;
}

type AuthRole = 'admin' | 'user';

interface AuthCredentials {
  adminPassword: string;
  userPassword: string;
}

interface AuthSession {
  role: AuthRole;
  username: string;
  loggedInAt: string;
}

const LS_AUTH_CREDENTIALS = 'samsat_auth_credentials';
const LS_AUTH_SESSION = 'samsat_auth_session';

const safeParseJSON = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const loadInboxMessages = () => safeParseJSON<InboxMessage[]>(localStorage.getItem(LS_INBOX_MESSAGES), []);
const saveInboxMessages = (messages: InboxMessage[]) => localStorage.setItem(LS_INBOX_MESSAGES, JSON.stringify(messages));

const loadMessageDirectory = () => safeParseJSON<MessageDirectoryItem[]>(localStorage.getItem(LS_MESSAGE_DIRECTORY), []);
const saveMessageDirectory = (items: MessageDirectoryItem[]) => localStorage.setItem(LS_MESSAGE_DIRECTORY, JSON.stringify(items));
const cleanupMessageDirectory = (items: MessageDirectoryItem[]) => {
  const now = Date.now();
  return items.filter(i => {
    const t = new Date(i.expiresAt).getTime();
    return Number.isFinite(t) && t > now;
  });
};

const readFileAsAttachment = (file: File): Promise<InboxAttachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read failed'));
    reader.onloadend = () => {
      resolve({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl: String(reader.result || ''),
        uploadedAt: new Date().toISOString()
      });
    };
    reader.readAsDataURL(file);
  });
};

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const validatePickedFile = (file: File, opts: { allowedMimeTypes: string[]; maxBytes: number; label: string }) => {
  const allowed = new Set(opts.allowedMimeTypes);
  if (!allowed.has(file.type)) {
    window.alert(`${opts.label} hanya menerima ${opts.allowedMimeTypes.join(', ')}.`);
    return false;
  }
  if (file.size > opts.maxBytes) {
    window.alert(`${opts.label} maksimal ${(opts.maxBytes / (1024 * 1024)).toFixed(0)} MB.`);
    return false;
  }
  return true;
};

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Blob read failed'));
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

const triggerDownloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const getImageSizeFromDataUrl = (dataUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
};

const buildMessagePdf = async (msg: InboxMessage): Promise<Blob> => {
  const mod = await import('jspdf');
  const doc = new mod.jsPDF({ unit: 'pt', format: 'a4' });
  const left = 40;
  const top = 50;
  const lineGap = 14;
  let y = top;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Pesan Masuk', left, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Nomor Tiket: ${msg.id}`, left, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Samsat: ${msg.samsat}`, left, y);
  y += lineGap;
  doc.text(`Jenis: ${msg.kind === 'damage_report' ? 'Laporan Kerusakan' : 'Permintaan Perangkat'}`, left, y);
  y += lineGap;
  doc.text(`Waktu: ${new Date(msg.createdAt).toLocaleString()}`, left, y);
  y += 20;

  const addField = (label: string, value: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - left * 2;
    doc.setFont('helvetica', 'bold');
    doc.text(label, left, y);
    y += lineGap;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value || '-', maxWidth);
    lines.forEach((ln: string) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (y > pageHeight - 60) {
        doc.addPage();
        y = top;
      }
      doc.text(ln, left, y);
      y += lineGap;
    });
    y += 10;
  };

  if (msg.kind === 'damage_report') {
    const p = msg.payload as DamageReportPayload;
    addField('Kerusakan Perangkat', p.kerusakanPerangkat);
    addField('Layanan yang Rusak', p.layananRusak);
    addField('Jenis/Merk/SN Perangkat Rusak', p.jenisMerkSnPerangkatRusak);
    addField('Nama dan Kontak Pengguna', p.namaDanKontakPengguna);
    addField('Perbaikan Mandiri', p.perbaikanMandiri);
    if (p.perbaikanMandiri === 'Belum') {
      addField('Alasan Belum Melaksanakan Perbaikan Secara Mandiri', p.alasanBelumMelaksanakanPerbaikanMandiri || '-');
    }
    addField('Lampiran', [
      `Kwitansi: ${p.kwitansiBuktiPerbaikan ? p.kwitansiBuktiPerbaikan.fileName : 'Tidak ada'}`,
      `Foto Perangkat Rusak: ${p.fotoPerangkatRusak ? p.fotoPerangkatRusak.fileName : 'Tidak ada'}`
    ].join('\n'));
  } else {
    const p = msg.payload as DeviceRequestSubmissionPayload;
    const jumlahText =
      p.kebutuhanPerangkat === 'PC & PRINTER KESAMSATAN'
        ? `PC ${Number(p.jumlahPermintaanPC || 0)} • PRINTER ${Number(p.jumlahPermintaanPrinter || 0)}`
        : `${Number(p.jumlahPermintaan || 0)}`;
    addField('Untuk Layanan', p.untukLayanan);
    addField('Kebutuhan Perangkat', p.kebutuhanPerangkat);
    addField('Jumlah Permintaan', jumlahText);
    addField('Alasan Permintaan Perangkat', p.alasanPermintaan);
    addField('Surat Permintaan', p.suratPermintaan ? p.suratPermintaan.fileName : 'Tidak ada');
  }

  return doc.output('blob');
};

const buildPdfFromImageAttachment = async (title: string, att: InboxAttachment): Promise<Blob> => {
  const mod = await import('jspdf');
  const doc = new mod.jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 40, 40);

  const { width, height } = await getImageSizeFromDataUrl(att.dataUrl);
  const maxW = pageWidth - 80;
  const maxH = pageHeight - 120;
  const scale = Math.min(maxW / width, maxH / height);
  const drawW = Math.max(1, Math.floor(width * scale));
  const drawH = Math.max(1, Math.floor(height * scale));
  const x = Math.floor((pageWidth - drawW) / 2);
  const y = 70;

  const fmt = att.mimeType === 'image/png' ? 'PNG' : 'JPEG';
  doc.addImage(att.dataUrl, fmt, x, y, drawW, drawH);

  return doc.output('blob');
};

const createLocalId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getAuthCredentials = (): AuthCredentials => {
  if (typeof window === 'undefined') return { adminPassword: 'admin', userPassword: 'user' };
  const fallback: AuthCredentials = { adminPassword: 'admin', userPassword: 'user' };
  const raw = localStorage.getItem(LS_AUTH_CREDENTIALS);
  const parsed = safeParseJSON<Partial<AuthCredentials>>(raw, {});
  const normalized: AuthCredentials = {
    adminPassword: typeof parsed.adminPassword === 'string' && parsed.adminPassword.trim() ? parsed.adminPassword : fallback.adminPassword,
    userPassword: typeof parsed.userPassword === 'string' && parsed.userPassword.trim() ? parsed.userPassword : fallback.userPassword
  };
  if (!raw || parsed.adminPassword !== normalized.adminPassword || parsed.userPassword !== normalized.userPassword) {
    localStorage.setItem(LS_AUTH_CREDENTIALS, JSON.stringify(normalized));
  }
  return normalized;
};

const saveAuthCredentials = (creds: AuthCredentials) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_AUTH_CREDENTIALS, JSON.stringify(creds));
};

const loadAuthSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;
  const parsed = safeParseJSON<AuthSession | null>(localStorage.getItem(LS_AUTH_SESSION), null);
  if (!parsed) return null;
  if (parsed.role !== 'admin' && parsed.role !== 'user') return null;
  if (typeof parsed.username !== 'string' || !parsed.username.trim()) return null;
  if (typeof parsed.loggedInAt !== 'string' || !parsed.loggedInAt.trim()) return null;
  return parsed;
};

const saveAuthSession = (session: AuthSession) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_AUTH_SESSION, JSON.stringify(session));
};

const clearAuthSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_AUTH_SESSION);
};

const loadDeletedDeviceIds = () => safeParseJSON<string[]>(localStorage.getItem(LS_DELETED_DEVICE_IDS), []);
const saveDeletedDeviceIds = (ids: string[]) => localStorage.setItem(LS_DELETED_DEVICE_IDS, JSON.stringify(ids));

const loadAddedDevices = () => safeParseJSON<Device[]>(localStorage.getItem(LS_ADDED_DEVICES), []);
const saveAddedDevices = (devices: Device[]) => localStorage.setItem(LS_ADDED_DEVICES, JSON.stringify(devices));

const loadDeviceRequests = () => safeParseJSON<Record<string, DeviceRequest>>(localStorage.getItem(LS_DEVICE_REQUESTS), {});
const saveDeviceRequests = (requests: Record<string, DeviceRequest>) => localStorage.setItem(LS_DEVICE_REQUESTS, JSON.stringify(requests));

const createDefaultRequest = (samsat: string): DeviceRequest => ({
  samsat,
  requestType: 'PC KESAMSATAN',
  requestedCount: 0,
  letter: null,
  stockStatus: 'standby',
  kabid: { status: 'pending', approvedCount: null },
  sekban: { status: 'pending', approvedCount: null },
  addedDeviceIds: [],
  finalizedAt: null
});

const getStatusBadge = (status: 'ok' | 'no' | 'pending') => {
  if (status === 'ok') return { icon: <CheckCircle2 className="w-4 h-4" />, className: 'bg-emerald-50 text-emerald-700 border-emerald-100', text: 'OK' };
  if (status === 'no') return { icon: <XCircle className="w-4 h-4" />, className: 'bg-rose-50 text-rose-700 border-rose-100', text: 'TIDAK' };
  return { icon: <Clock3 className="w-4 h-4" />, className: 'bg-amber-50 text-amber-800 border-amber-100', text: 'DALAM PROSES' };
};

const normalizeFilled = (value: string) => {
  const v = value.trim();
  if (!v) return false;
  if (/^\?+$/.test(v)) return false;
  if (v === '-') return false;
  if (v.toLowerCase() === 'n/a') return false;
  return true;
};

const normalizeCondition = (raw: string) => {
  const v = (raw || '').trim();
  if (!v) return 'Kurang Baik';
  const u = v.toUpperCase();
  if (u.includes('RUSAK') || u.includes('MATI') || u.includes('ERROR') || u.includes('TIDAK BAIK')) return 'Rusak';
  if (u.includes('KURANG')) return 'Kurang Baik';
  if (u.includes('BAIK')) return 'Baik';
  return 'Kurang Baik';
};

const getConditionPillClass = (condition: string) => {
  const c = normalizeCondition(condition);
  if (c === 'Baik') return 'bg-emerald-50 text-emerald-600';
  if (c === 'Kurang Baik') return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-600';
};

const parseCsvLine = (line: string, separator: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === separator) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
};

const parseSheetCSV = (csvData: string, defaultSamsat: string): Device[] => {
  const lines = csvData.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const separator = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

  let currentSamsat = defaultSamsat;
  const sheetDevices: Device[] = [];

  lines.forEach((line, index) => {
    const cells = parseCsvLine(line, separator);

    if (cells.length < 2) {
      if (cells[0].toUpperCase().includes('SAMSAT')) {
        let name = cells[0].trim();
        name = name.replace(/UPPD\s+/gi, '').trim();
        name = name.replace(/^SAMSAT\s+/gi, '').trim();
        currentSamsat = "SAMSAT " + name;
      }
      return;
    }

    const nonInternalEmpty = cells.filter(c => c !== "").length;
    const potentialSamsat = cells.find(c => c.toUpperCase().includes('SAMSAT'));
    if (potentialSamsat && nonInternalEmpty <= 3 && !/^\d+$/.test(cells[0])) {
      let name = potentialSamsat.trim();
      name = name.replace(/UPPD\s+/gi, '').trim();
      name = name.replace(/^SAMSAT\s+/gi, '').trim();
      currentSamsat = "SAMSAT " + name;
      return;
    }

    const isDataRow = /^\d+$/.test(cells[0]) && cells.length >= 5;

    if (isDataRow) {
      let finalSamsat = currentSamsat;
      let finalServiceUnit = cells[4] || "Umum";
      const serialNumberRaw = (cells[3] || '').trim();
      const phoneNumberRaw = (cells[8] || '').trim();
      const dataComplete = normalizeFilled(serialNumberRaw) && normalizeFilled(phoneNumberRaw);
      const conditionNormalized = normalizeCondition(cells[5] || '');

      if (currentSamsat.toUpperCase().includes("HANDIL BAKTI")) {
        finalSamsat = "SAMSAT MARABAHAN";
        finalServiceUnit = "SAMSAT BANTU HANDIL BAKTI";
      }

      const rowNo = (cells[0] || '').trim();
      const fallbackId = rowNo ? `${defaultSamsat}-${rowNo}` : `dev-${defaultSamsat}-${index}`;
      const deviceId = normalizeFilled(serialNumberRaw) ? serialNumberRaw : fallbackId;

      sheetDevices.push({
        id: deviceId,
        name: cells[1] || "Perangkat Tanpa Nama",
        category: (cells[1] || '').split(' ')[0] || "Aset",
        location: currentSamsat,
        subLocation: cells[6] || "Staff",
        serialNumber: serialNumberRaw || "N/A",
        phoneNumber: phoneNumberRaw,
        condition: conditionNormalized,
        isComplete: false,
        dataComplete,
        samsat: finalSamsat,
        serviceUnit: finalServiceUnit,
        sheetName: defaultSamsat
      });
    }
  });

  return sheetDevices;
};

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession());
  const [authTab, setAuthTab] = useState<AuthRole>('admin');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isManageLoginOpen, setIsManageLoginOpen] = useState(false);
  const [manageLoginForm, setManageLoginForm] = useState({
    currentAdminPassword: '',
    newAdminPassword: '',
    confirmAdminPassword: '',
    newUserPassword: '',
    confirmUserPassword: ''
  });
  const [manageLoginError, setManageLoginError] = useState<string | null>(null);
  const [manageLoginSuccess, setManageLoginSuccess] = useState<string | null>(null);

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Device>>({});
  
  // Dashboard Navigation State
  const [viewMode, setViewMode] = useState<'selection' | 'dashboard' | 'devices' | 'scan-qr'>('selection');
  const [activeSamsat, setActiveSamsat] = useState<string | null>(null);
  const [showSamsatDropdown, setShowSamsatDropdown] = useState(false);
  const [isLayananModalOpen, setIsLayananModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState<DeviceRequest | null>(null);
  const [newDeviceDraft, setNewDeviceDraft] = useState<Partial<Device>>({
    condition: 'Baik'
  });

  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<InboxKind | 'downloads'>('damage_report');
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxItems, setInboxItems] = useState<InboxMessage[]>([]);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [activeInboxMessage, setActiveInboxMessage] = useState<InboxMessage | null>(null);
  const [messageDirectory, setMessageDirectory] = useState<MessageDirectoryItem[]>(() => cleanupMessageDirectory(loadMessageDirectory()));

  const [isDamageReportOpen, setIsDamageReportOpen] = useState(false);
  const [damageSending, setDamageSending] = useState(false);
  const [damageSuccess, setDamageSuccess] = useState<string | null>(null);
  const [damageDraft, setDamageDraft] = useState<{
    kerusakanPerangkat: string;
    layananRusak: string;
    jenisMerkSnPerangkatRusak: string;
    namaDanKontakPengguna: string;
    perbaikanMandiri: 'Sudah' | 'Belum';
    alasanBelumMelaksanakanPerbaikanMandiri: string;
    kwitansiFile: File | null;
    fotoRusakFile: File | null;
  }>({
    kerusakanPerangkat: '',
    layananRusak: '',
    jenisMerkSnPerangkatRusak: '',
    namaDanKontakPengguna: '',
    perbaikanMandiri: 'Belum',
    alasanBelumMelaksanakanPerbaikanMandiri: '',
    kwitansiFile: null,
    fotoRusakFile: null
  });

  const [isDeviceRequestOpen, setIsDeviceRequestOpen] = useState(false);
  const [deviceRequestSending, setDeviceRequestSending] = useState(false);
  const [deviceRequestSuccess, setDeviceRequestSuccess] = useState<string | null>(null);
  const [deviceRequestDraft, setDeviceRequestDraft] = useState<{
    suratFile: File | null;
    untukLayanan: string;
    kebutuhanPerangkat: 'PC KESAMSATAN' | 'PRINTER KESAMSATAN' | 'PC & PRINTER KESAMSATAN';
    jumlahPermintaan: number | null;
    jumlahPermintaanPC: number | null;
    jumlahPermintaanPrinter: number | null;
    alasanPermintaan: string;
  }>({
    suratFile: null,
    untukLayanan: '',
    kebutuhanPerangkat: 'PC KESAMSATAN',
    jumlahPermintaan: null,
    jumlahPermintaanPC: null,
    jumlahPermintaanPrinter: null,
    alasanPermintaan: ''
  });

  const isAdmin = session?.role === 'admin';
  const strictSheetSync = false;

  const handleLogin = (role: AuthRole) => {
    const creds = getAuthCredentials();
    const expectedPassword = role === 'admin' ? creds.adminPassword : creds.userPassword;
    const expectedUsername = role === 'admin' ? 'admin' : 'user';
    const enteredUsername = authUsername.trim();

    if (enteredUsername !== expectedUsername || authPassword !== expectedPassword) {
      setAuthError('User atau password salah');
      return;
    }

    const nextSession: AuthSession = { role, username: expectedUsername, loggedInAt: new Date().toISOString() };
    setSession(nextSession);
    saveAuthSession(nextSession);
    setAuthUsername('');
    setAuthPassword('');
    setAuthError(null);
    setSelectedDevice(null);
    setIsEditing(false);
    setViewMode('selection');
    setActiveSamsat(null);
    setShowSamsatDropdown(false);
    setIsRequestModalOpen(false);
    setRequestDraft(null);
  };

  const logout = () => {
    setSession(null);
    clearAuthSession();
    setAuthTab('admin');
    setAuthUsername('');
    setAuthPassword('');
    setAuthError(null);
    setSelectedDevice(null);
    setIsEditing(false);
    setSearchTerm('');
    setViewMode('selection');
    setActiveSamsat(null);
    setShowSamsatDropdown(false);
    setIsRequestModalOpen(false);
    setRequestDraft(null);
    setIsManageLoginOpen(false);
  };

  const fetchInboxItems = async (kind: InboxKind, status: 'all' | InboxStatus = 'all') => {
    setInboxLoading(true);
    try {
      try {
        const response = await axios.get('/api/inbox', {
          params: { kind, status, limit: 200 },
          timeout: 8000
        });
        const items = (response.data?.items || []) as InboxMessage[];
        setInboxItems(items);
        return items;
      } catch {
        const items = loadInboxMessages()
          .filter(m => (status === 'all' ? true : m.status === status) && m.kind === kind)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        setInboxItems(items);
        return items;
      }
    } finally {
      setInboxLoading(false);
    }
  };

  const refreshUnreadInboxCount = useCallback(async () => {
    if (!session || session.role !== 'admin') return;
    try {
      try {
        const response = await axios.get('/api/inbox', {
          params: { status: 'unread', limit: 200 },
          timeout: 8000
        });
        const items = (response.data?.items || []) as InboxMessage[];
        setUnreadInboxCount(items.length);
      } catch {
        setUnreadInboxCount(loadInboxMessages().filter(m => m.status === 'unread').length);
      }
    } catch {
      setUnreadInboxCount(loadInboxMessages().filter(m => m.status === 'unread').length);
    }
  }, [session]);

  const markInboxRead = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await axios.post('/api/inbox', { action: 'markRead', ids }, { timeout: 8000 });
    } catch {
      const next = loadInboxMessages().map(m => (ids.includes(m.id) ? { ...m, status: 'read' as InboxStatus } : m));
      saveInboxMessages(next);
    }
    refreshUnreadInboxCount();
  };

  const openInbox = async () => {
    setDamageSuccess(null);
    setDeviceRequestSuccess(null);
    setActiveInboxMessage(null);
    setInboxTab('damage_report');
    setIsInboxOpen(true);
    setMessageDirectory(prev => {
      const cleaned = cleanupMessageDirectory(prev);
      if (cleaned.length !== prev.length) saveMessageDirectory(cleaned);
      return cleaned;
    });
    await fetchInboxItems('damage_report', 'all');
    refreshUnreadInboxCount();
  };

  const openInboxMessage = async (msg: InboxMessage) => {
    setActiveInboxMessage(msg);
    if (msg.status === 'unread') {
      await markInboxRead([msg.id]);
      setInboxItems(prev => prev.map(m => (m.id === msg.id ? { ...m, status: 'read' } : m)));
    }
  };

  const sendInboxMessage = async (kind: InboxKind, payload: DamageReportPayload | DeviceRequestSubmissionPayload) => {
    if (!activeSamsat) throw new Error('Samsat belum dipilih');

    try {
      const response = await axios.post(
        '/api/inbox',
        { action: 'create', kind, samsat: activeSamsat, payload },
        { timeout: 8000 }
      );
      return String(response.data?.id || '');
    } catch {
      const id = createLocalId();
      const message: InboxMessage = {
        id,
        kind,
        status: 'unread',
        samsat: activeSamsat,
        createdAt: new Date().toISOString(),
        payload
      };
      const next = [message, ...loadInboxMessages()];
      saveInboxMessages(next);
      return id;
    }
  };

  useEffect(() => {
    saveMessageDirectory(messageDirectory);
  }, [messageDirectory]);

  useEffect(() => {
    if (!isAdmin) return;
    const t = window.setInterval(() => {
      setMessageDirectory(prev => {
        const cleaned = cleanupMessageDirectory(prev);
        if (cleaned.length !== prev.length) saveMessageDirectory(cleaned);
        return cleaned;
      });
    }, 10 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [isAdmin]);

  const storeMessageDirectoryPdf = async (opts: {
    msg: InboxMessage;
    kind: MessageDirectoryKind;
    fileName: string;
    blob: Blob;
  }) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const dataUrl = await blobToDataUrl(opts.blob);
    const item: MessageDirectoryItem = {
      id: createLocalId(),
      inboxMessageId: opts.msg.id,
      inboxKind: opts.msg.kind,
      samsat: opts.msg.samsat,
      kind: opts.kind,
      fileName: opts.fileName,
      mimeType: 'application/pdf',
      dataUrl,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    setMessageDirectory(prev => cleanupMessageDirectory([item, ...prev]));
  };

  const downloadInboxMessagePdf = async (msg: InboxMessage) => {
    const blob = await buildMessagePdf(msg);
    const fileName = `pesan-${msg.kind}-${msg.samsat}-${msg.id}.pdf`.replaceAll(' ', '_');
    triggerDownloadBlob(blob, fileName);
    await storeMessageDirectoryPdf({ msg, kind: 'message', fileName, blob });
  };

  const downloadDamageAttachmentPdf = async (msg: InboxMessage, kind: 'kwitansi' | 'foto', att: InboxAttachment) => {
    if (!att?.dataUrl) return;
    if (att.mimeType !== 'image/jpeg' && att.mimeType !== 'image/png' && att.mimeType !== 'image/jpg') {
      window.alert('Lampiran harus berupa JPG/JPEG/PNG agar dapat diunduh sebagai PDF.');
      return;
    }
    const blob = await buildPdfFromImageAttachment(kind === 'kwitansi' ? 'Kwitansi Bukti Perbaikan' : 'Foto Perangkat Rusak', att);
    const fileName = `${kind}-${msg.samsat}-${msg.id}.pdf`.replaceAll(' ', '_');
    triggerDownloadBlob(blob, fileName);
    await storeMessageDirectoryPdf({ msg, kind, fileName, blob });
  };

  const downloadSuratPdf = async (msg: InboxMessage, att: InboxAttachment) => {
    if (!att?.dataUrl) return;
    if (att.mimeType !== 'application/pdf') {
      window.alert('Surat harus berupa PDF.');
      return;
    }
    const blob = await dataUrlToBlob(att.dataUrl);
    const fileName = `surat-${msg.samsat}-${msg.id}.pdf`.replaceAll(' ', '_');
    triggerDownloadBlob(blob, fileName);
    await storeMessageDirectoryPdf({ msg, kind: 'surat', fileName, blob });
  };

  const deleteMessageDirectoryItem = (id: string) => {
    setMessageDirectory(prev => {
      const next = prev.filter(i => i.id !== id);
      saveMessageDirectory(next);
      return next;
    });
  };

  const downloadMessageDirectoryItem = async (item: MessageDirectoryItem) => {
    const blob = await dataUrlToBlob(item.dataUrl);
    triggerDownloadBlob(blob, item.fileName);
  };

  const submitDamageReport = async () => {
    if (!activeSamsat) {
      window.alert('Pilih kantor Samsat terlebih dahulu.');
      return;
    }
    if (!damageDraft.kerusakanPerangkat.trim()) {
      window.alert('Kolom "Kerusakan Perangkat" wajib diisi.');
      return;
    }
    if (!damageDraft.layananRusak.trim()) {
      window.alert('Kolom "Layanan yang Rusak" wajib diisi.');
      return;
    }
    if (!damageDraft.jenisMerkSnPerangkatRusak.trim()) {
      window.alert('Kolom "Jenis/Merk/SN Perangkat Rusak" wajib diisi.');
      return;
    }
    if (!damageDraft.namaDanKontakPengguna.trim()) {
      window.alert('Kolom "Nama dan Kontak Pengguna" wajib diisi.');
      return;
    }
    if (damageDraft.perbaikanMandiri === 'Belum' && !damageDraft.alasanBelumMelaksanakanPerbaikanMandiri.trim()) {
      window.alert('Kolom "Alasan belum melaksanakan perbaikan secara mandiri" wajib diisi.');
      return;
    }
    if (damageDraft.perbaikanMandiri === 'Sudah' && !damageDraft.kwitansiFile) {
      window.alert('Upload foto kwitansi bukti perbaikan wajib diisi jika memilih "Sudah".');
      return;
    }
    if (!damageDraft.fotoRusakFile) {
      window.alert('Upload foto perangkat rusak wajib diisi.');
      return;
    }

    setDamageSending(true);
    try {
      if (!validatePickedFile(damageDraft.fotoRusakFile, { allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'], maxBytes: MAX_UPLOAD_BYTES, label: 'Upload foto perangkat rusak' })) {
        return;
      }
      if (damageDraft.perbaikanMandiri === 'Sudah' && damageDraft.kwitansiFile) {
        if (!validatePickedFile(damageDraft.kwitansiFile, { allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'], maxBytes: MAX_UPLOAD_BYTES, label: 'Upload foto kwitansi bukti perbaikan' })) {
          return;
        }
      }
      const foto = await readFileAsAttachment(damageDraft.fotoRusakFile);
      const kwitansi =
        damageDraft.perbaikanMandiri === 'Sudah' && damageDraft.kwitansiFile ? await readFileAsAttachment(damageDraft.kwitansiFile) : null;

      const payload: DamageReportPayload = {
        kerusakanPerangkat: damageDraft.kerusakanPerangkat.trim(),
        layananRusak: damageDraft.layananRusak.trim(),
        jenisMerkSnPerangkatRusak: damageDraft.jenisMerkSnPerangkatRusak.trim(),
        namaDanKontakPengguna: damageDraft.namaDanKontakPengguna.trim(),
        perbaikanMandiri: damageDraft.perbaikanMandiri,
        alasanBelumMelaksanakanPerbaikanMandiri: damageDraft.perbaikanMandiri === 'Belum' ? damageDraft.alasanBelumMelaksanakanPerbaikanMandiri.trim() : null,
        kwitansiBuktiPerbaikan: kwitansi,
        fotoPerangkatRusak: foto
      };

      await sendInboxMessage('damage_report', payload);
      setDamageSuccess('Laporan Anda sudah dikirim');
      setDamageDraft({
        kerusakanPerangkat: '',
        layananRusak: '',
        jenisMerkSnPerangkatRusak: '',
        namaDanKontakPengguna: '',
        perbaikanMandiri: 'Belum',
        alasanBelumMelaksanakanPerbaikanMandiri: '',
        kwitansiFile: null,
        fotoRusakFile: null
      });
      refreshUnreadInboxCount();
    } finally {
      setDamageSending(false);
    }
  };

  const submitDeviceRequest = async () => {
    if (!activeSamsat) {
      window.alert('Pilih kantor Samsat terlebih dahulu.');
      return;
    }
    if (!deviceRequestDraft.suratFile) {
      window.alert('Upload surat permintaan perangkat wajib diisi.');
      return;
    }
    if (!validatePickedFile(deviceRequestDraft.suratFile, { allowedMimeTypes: ['application/pdf'], maxBytes: MAX_UPLOAD_BYTES, label: 'Upload surat permintaan perangkat' })) {
      return;
    }
    if (!deviceRequestDraft.untukLayanan.trim()) {
      window.alert('Kolom "UNTUK LAYANAN" wajib diisi.');
      return;
    }
    if (!deviceRequestDraft.alasanPermintaan.trim()) {
      window.alert('Kolom "ALASAN PERMINTAAN PERANGKAT" wajib diisi.');
      return;
    }

    const kebutuhan = deviceRequestDraft.kebutuhanPerangkat;
    const pc = Math.max(0, Number(deviceRequestDraft.jumlahPermintaanPC || 0));
    const printer = Math.max(0, Number(deviceRequestDraft.jumlahPermintaanPrinter || 0));
    const total = Math.max(0, Number(deviceRequestDraft.jumlahPermintaan || 0));

    if (kebutuhan === 'PC & PRINTER KESAMSATAN') {
      if (pc <= 0 && printer <= 0) {
        window.alert('Isi jumlah permintaan PC dan/atau PRINTER.');
        return;
      }
    } else {
      if (total <= 0) {
        window.alert('Isi jumlah permintaan perangkat.');
        return;
      }
    }

    setDeviceRequestSending(true);
    try {
      const surat = await readFileAsAttachment(deviceRequestDraft.suratFile);

      const payload: DeviceRequestSubmissionPayload = {
        suratPermintaan: surat,
        untukLayanan: deviceRequestDraft.untukLayanan.trim(),
        kebutuhanPerangkat: deviceRequestDraft.kebutuhanPerangkat,
        jumlahPermintaan: kebutuhan === 'PC & PRINTER KESAMSATAN' ? null : total,
        jumlahPermintaanPC: kebutuhan === 'PC & PRINTER KESAMSATAN' ? pc : null,
        jumlahPermintaanPrinter: kebutuhan === 'PC & PRINTER KESAMSATAN' ? printer : null,
        alasanPermintaan: deviceRequestDraft.alasanPermintaan.trim()
      };

      await sendInboxMessage('device_request', payload);
      setDeviceRequestSuccess('Permintaan Anda sudah dikirim');
      setDeviceRequestDraft({
        suratFile: null,
        untukLayanan: '',
        kebutuhanPerangkat: 'PC KESAMSATAN',
        jumlahPermintaan: null,
        jumlahPermintaanPC: null,
        jumlahPermintaanPrinter: null,
        alasanPermintaan: ''
      });
      refreshUnreadInboxCount();
    } finally {
      setDeviceRequestSending(false);
    }
  };

  const saveManageLogin = () => {
    if (!isAdmin) return;

    const creds = getAuthCredentials();
    if (manageLoginForm.currentAdminPassword !== creds.adminPassword) {
      setManageLoginError('Password super admin saat ini salah');
      setManageLoginSuccess(null);
      return;
    }

    let nextCreds = { ...creds };

    const adminUpdateAttempt = !!manageLoginForm.newAdminPassword || !!manageLoginForm.confirmAdminPassword;
    if (adminUpdateAttempt) {
      if (!manageLoginForm.newAdminPassword || !manageLoginForm.confirmAdminPassword) {
        setManageLoginError('Lengkapi password super admin baru dan konfirmasi');
        setManageLoginSuccess(null);
        return;
      }
      if (manageLoginForm.newAdminPassword !== manageLoginForm.confirmAdminPassword) {
        setManageLoginError('Konfirmasi password super admin tidak sama');
        setManageLoginSuccess(null);
        return;
      }
      nextCreds = { ...nextCreds, adminPassword: manageLoginForm.newAdminPassword };
    }

    const userUpdateAttempt = !!manageLoginForm.newUserPassword || !!manageLoginForm.confirmUserPassword;
    if (userUpdateAttempt) {
      if (!manageLoginForm.newUserPassword || !manageLoginForm.confirmUserPassword) {
        setManageLoginError('Lengkapi password user baru dan konfirmasi');
        setManageLoginSuccess(null);
        return;
      }
      if (manageLoginForm.newUserPassword !== manageLoginForm.confirmUserPassword) {
        setManageLoginError('Konfirmasi password user tidak sama');
        setManageLoginSuccess(null);
        return;
      }
      nextCreds = { ...nextCreds, userPassword: manageLoginForm.newUserPassword };
    }

    if (!adminUpdateAttempt && !userUpdateAttempt) {
      setManageLoginError('Isi minimal satu perubahan password');
      setManageLoginSuccess(null);
      return;
    }

    saveAuthCredentials(nextCreds);
    setManageLoginError(null);
    setManageLoginSuccess('Password berhasil diperbarui');
    setManageLoginForm({
      currentAdminPassword: '',
      newAdminPassword: '',
      confirmAdminPassword: '',
      newUserPassword: '',
      confirmUserPassword: ''
    });
  };

  const openRequestModal = () => {
    if (strictSheetSync) return;
    if (!isAdmin) return;
    if (!activeSamsat) return;
    const requests = loadDeviceRequests();
    const reqRaw = requests[activeSamsat] || createDefaultRequest(activeSamsat);
    const req: DeviceRequest = {
      ...createDefaultRequest(activeSamsat),
      ...reqRaw,
      requestType: (reqRaw as DeviceRequest).requestType || 'PC KESAMSATAN'
    };
    setRequestDraft(req);
    setNewDeviceDraft({ condition: 'Baik', samsat: activeSamsat });
    setIsRequestModalOpen(true);
  };

  const persistRequestDraft = (next: DeviceRequest) => {
    if (strictSheetSync) return;
    if (!isAdmin) return;
    const requests = loadDeviceRequests();
    requests[next.samsat] = next;
    saveDeviceRequests(requests);
    setRequestDraft(next);
  };

  const deleteDevice = (device: Device) => {
    if (strictSheetSync) return;
    if (!isAdmin) {
      window.alert('Akses terbatas. Hanya Super Admin yang dapat menghapus perangkat.');
      return;
    }
    const ok = window.confirm(`Hapus perangkat "${device.name}"?`);
    if (!ok) return;

    setSelectedDevice(prev => (prev?.id === device.id ? null : prev));
    setDevices(prev => prev.filter(d => d.id !== device.id));

    const deleted = new Set(loadDeletedDeviceIds());
    deleted.add(device.id);
    saveDeletedDeviceIds(Array.from(deleted));

    const photos = safeParseJSON<Record<string, string>>(localStorage.getItem('samsat_device_photos'), {});
    if (photos[device.id]) {
      delete photos[device.id];
      localStorage.setItem('samsat_device_photos', JSON.stringify(photos));
    }

    const updated = safeParseJSON<Record<string, Partial<Device>>>(localStorage.getItem('samsat_updated_devices'), {});
    if (updated[device.id]) {
      delete updated[device.id];
      localStorage.setItem('samsat_updated_devices', JSON.stringify(updated));
    }

    const added = loadAddedDevices().filter(d => d.id !== device.id);
    saveAddedDevices(added);

    const requests = loadDeviceRequests();
    Object.keys(requests).forEach(key => {
      const r = requests[key];
      if (r.addedDeviceIds.includes(device.id)) {
        requests[key] = { ...r, addedDeviceIds: r.addedDeviceIds.filter(id => id !== device.id) };
      }
    });
    saveDeviceRequests(requests);
  };

  const getApprovedCount = (req: DeviceRequest) => {
    if (req.stockStatus !== 'ready') return 0;
    if (req.kabid.status !== 'approved') return 0;
    if (req.sekban.status !== 'approved') return 0;
    const kabidCount = Math.max(0, Number(req.kabid.approvedCount || 0));
    const sekbanCount = Math.max(0, Number(req.sekban.approvedCount || 0));
    const requested = Math.max(0, Number(req.requestedCount || 0));
    return Math.min(kabidCount, sekbanCount, requested);
  };

  const addRequestedDevice = () => {
    if (strictSheetSync) return;
    if (!isAdmin) return;
    if (!requestDraft || !activeSamsat) return;
    const approvedCount = getApprovedCount(requestDraft);
    const remaining = approvedCount - requestDraft.addedDeviceIds.length;
    if (remaining <= 0) return;

    const name = String(newDeviceDraft.name || '').trim();
    const serviceUnit = String(newDeviceDraft.serviceUnit || '').trim();
    const subLocation = String(newDeviceDraft.subLocation || '').trim();
    const serialNumber = String(newDeviceDraft.serialNumber || '').trim();
    const phoneNumber = String(newDeviceDraft.phoneNumber || '').trim();
    const condition = normalizeCondition(String(newDeviceDraft.condition || 'Baik'));

    if (!name || !serviceUnit) return;

    const rowId = (() => {
      if (normalizeFilled(serialNumber)) return serialNumber;
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `ADD-${(crypto as Crypto).randomUUID()}`;
      return `ADD-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    })();

    const device: Device = {
      id: rowId,
      name,
      category: name.split(' ')[0] || 'Aset',
      location: activeSamsat,
      subLocation: subLocation || 'Staff',
      serialNumber: serialNumber || 'N/A',
      phoneNumber,
      condition,
      isComplete: false,
      dataComplete: normalizeFilled(serialNumber) && normalizeFilled(phoneNumber),
      samsat: activeSamsat,
      serviceUnit,
      sheetName: 'Manual'
    };

    const added = loadAddedDevices();
    const deleted = new Set(loadDeletedDeviceIds());
    deleted.delete(device.id);
    saveDeletedDeviceIds(Array.from(deleted));
    saveAddedDevices([device, ...added]);
    setDevices(prev => [device, ...prev]);

    const nextReq: DeviceRequest = { ...requestDraft, addedDeviceIds: [...requestDraft.addedDeviceIds, device.id] };
    const nextRemaining = approvedCount - nextReq.addedDeviceIds.length;
    const finalized = nextRemaining <= 0 ? new Date().toISOString() : null;
    persistRequestDraft({ ...nextReq, finalizedAt: finalized || nextReq.finalizedAt });

    setNewDeviceDraft(prev => ({
      ...prev,
      name: '',
      serialNumber: '',
      phoneNumber: '',
      subLocation: '',
      condition: 'Baik'
    }));
  };

  const handleLetterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (strictSheetSync) return;
    if (!isAdmin) return;
    if (!requestDraft) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const next: DeviceRequest = {
        ...requestDraft,
        letter: {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataUrl,
          uploadedAt: new Date().toISOString()
        }
      };
      persistRequestDraft(next);
    };
    reader.readAsDataURL(file);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRqd9Fuc8MRfwWgzB5TJ-8trqSCerRy5-mbzhy-wJo_faoLLe9JItOxyKXBJ2A9l8MpFoswgpTxfxN1/pub?output=csv&gid=';
      
      const fallbackSheets = [
        { name: "SAMSAT BANJARMASIN I", gid: "0" },
        { name: "SAMSAT BANJARMASIN II", gid: "1710409913" },
        { name: "SAMSAT BANJARBARU", gid: "11591526" },
        { name: "SAMSAT MARTAPURA", gid: "1933191535" },
        { name: "SAMSAT RANTAU", gid: "1105810683" },
        { name: "SAMSAT KANDANGAN", gid: "235119847" },
        { name: "SAMSAT BARABAI", gid: "1243457458" },
        { name: "SAMSAT AMUNTAI", gid: "1843850468" },
        { name: "SAMSAT TANJUNG", gid: "605123251" },
        { name: "SAMSAT PARINGIN", gid: "1278642870" },
        { name: "SAMSAT MARABAHAN", gid: "1709839473" },
        { name: "SAMSAT PELAIHARI", gid: "1979165441" },
        { name: "SAMSAT BATULICIN", gid: "2078825373" },
        { name: "SAMSAT KOTABARU", gid: "1643121233" }
      ];

      const discoverSheets = async () => {
        try {
          const response = await axios.get('/api/sheets?format=html', { timeout: 8000 });
          const html = String(response.data || '');
          if (!html) return fallbackSheets;

          const doc = new DOMParser().parseFromString(html, 'text/html');
          const anchors = Array.from(doc.querySelectorAll('a'));
          const byGid = new Map<string, { gid: string; name: string }>();

          anchors.forEach(a => {
            const href = a.getAttribute('href') || '';
            const m = href.match(/[?&]gid=(\d+)/);
            if (!m) return;
            const gid = m[1];
            const text = (a.textContent || '').trim();
            const name = text || `GID ${gid}`;
            const existing = byGid.get(gid);
            if (!existing || name.length > existing.name.length) {
              byGid.set(gid, { gid, name });
            }
          });

          const discovered = Array.from(byGid.values());
          return discovered.length > 0 ? discovered : fallbackSheets;
        } catch {
          return fallbackSheets;
        }
      };

      const sheets = await discoverSheets();
      const allFetchedDevices: Device[] = [];

      // Fetch all sheets in parallel
      const fetchPromises = sheets.map(async (sheet) => {
        const sheetUrl = baseUrl + sheet.gid;
        try {
          let csvData = "";
          try {
            const response = await axios.get(`/api/sheets?gid=${encodeURIComponent(sheet.gid)}`, { timeout: 8000 });
            csvData = response.data;
          } catch (e) {
            try {
              const response = await axios.get(sheetUrl, { timeout: 8000 });
              csvData = response.data;
            } catch (e2) {
              const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(sheetUrl)}`;
              const response = await axios.get(proxyUrl);
              csvData = response.data.contents;
            }
          }

          if (csvData && typeof csvData === 'string' && csvData.includes(',')) {
            const sheetDevices = parseSheetCSV(csvData, sheet.name);
            allFetchedDevices.push(...sheetDevices);
          }
        } catch (err) {
          console.error(`Failed to fetch sheet ${sheet.name}:`, err);
        }
      });

      await Promise.all(fetchPromises);

      if (allFetchedDevices.length > 0) {
        const savedPhotos = safeParseJSON<Record<string, string>>(localStorage.getItem('samsat_device_photos'), {});

        const finalDevices = allFetchedDevices.map(d => {
          const photo = savedPhotos[d.id] || d.photo;
          return {
            ...d,
            photo,
            isComplete: !!photo
          };
        });

        setDevices(finalDevices);
      }
      
    } catch (err) {
      console.error("All fetch attempts failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePhotoUpload = (deviceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      window.alert('Akses terbatas. Hanya Super Admin yang dapat upload foto.');
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setDevices(prev => prev.map(d => 
          d.id === deviceId ? { ...d, photo: base64String, isComplete: true } : d
        ));
        const savedPhotos = JSON.parse(localStorage.getItem('samsat_device_photos') || '{}');
        savedPhotos[deviceId] = base64String;
        localStorage.setItem('samsat_device_photos', JSON.stringify(savedPhotos));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateDevice = () => {
    if (strictSheetSync) return;
    if (!isAdmin) return;
    if (!selectedDevice || !editForm.id) return;
    
    const updatedDeviceId = editForm.id;
    const updatedData = { ...selectedDevice, ...editForm };
    const normalizeFilled = (value: string) => {
      const v = value.trim();
      if (!v) return false;
      if (/^\?+$/.test(v)) return false;
      if (v === '-') return false;
      if (v.toLowerCase() === 'n/a') return false;
      return true;
    };
    const nextSerial = String(updatedData.serialNumber || '').trim();
    const nextPhone = String(updatedData.phoneNumber || '').trim();
    const nextDataComplete = normalizeFilled(nextSerial) && normalizeFilled(nextPhone);
    const finalUpdatedData = { ...updatedData, dataComplete: nextDataComplete };
    
    // Update local state
    setDevices(prev => prev.map(d => d.id === updatedDeviceId ? (finalUpdatedData as Device) : d));
    setSelectedDevice(finalUpdatedData as Device);
    setIsEditing(false);
    
    // Save to LocalStorage to persist changes (since Google Sheets is read-only)
    const updatedDevices = JSON.parse(localStorage.getItem('samsat_updated_devices') || '{}');
    updatedDevices[updatedDeviceId] = {
      name: updatedData.name,
      category: updatedData.category,
      serialNumber: updatedData.serialNumber,
      phoneNumber: updatedData.phoneNumber,
      condition: updatedData.condition,
      serviceUnit: updatedData.serviceUnit,
      subLocation: updatedData.subLocation,
      dataComplete: nextDataComplete
    };
    localStorage.setItem('samsat_updated_devices', JSON.stringify(updatedDevices));
  };

  const samsatGroups = useMemo(() => {
    const groups: Record<string, Device[]> = {};
    if (!devices || devices.length === 0) return groups;
    devices.forEach(d => {
      if (d && d.samsat && d.samsat.trim()) {
        const normalizedSamsat = d.samsat.trim();
        if (!groups[normalizedSamsat]) groups[normalizedSamsat] = [];
        groups[normalizedSamsat].push(d);
      }
    });
    return groups;
  }, [devices]);

  const samsatList = useMemo(() => {
    return Object.keys(samsatGroups).sort((a, b) => a.localeCompare(b));
  }, [samsatGroups]);

  const currentSamsatDevices = useMemo(() => 
    activeSamsat ? devices.filter(d => d.samsat === activeSamsat) : [], 
  [devices, activeSamsat]);

  const stats: Stats = useMemo(() => {
    const total = currentSamsatDevices.length;
    const baik = currentSamsatDevices.filter(d => normalizeCondition(d.condition) === 'Baik').length;
    const kurangBaik = currentSamsatDevices.filter(d => normalizeCondition(d.condition) === 'Kurang Baik').length;
    const rusak = currentSamsatDevices.filter(d => normalizeCondition(d.condition) === 'Rusak').length;
    const layanan = new Set(currentSamsatDevices.map(d => d.serviceUnit)).size;

    const lengkapTotal = currentSamsatDevices.filter(d => d.dataComplete).length;
    const tidakLengkapTotal = total - lengkapTotal;

    const lengkapBaik = currentSamsatDevices.filter(d => d.dataComplete && normalizeCondition(d.condition) === 'Baik').length;
    const tidakLengkapBaik = currentSamsatDevices.filter(d => !d.dataComplete && normalizeCondition(d.condition) === 'Baik').length;

    const lengkapTidakBaik = lengkapTotal - lengkapBaik;
    const tidakLengkapTidakBaik = tidakLengkapTotal - tidakLengkapBaik;

    return {
      total,
      baik,
      kurangBaik,
      rusak,
      layanan,
      lengkapTotal,
      tidakLengkapTotal,
      lengkapBaik,
      lengkapTidakBaik,
      tidakLengkapBaik,
      tidakLengkapTidakBaik
    };
  }, [currentSamsatDevices]);

  const groupedLayanan = useMemo(() => {
    const groups: Record<string, Device[]> = {};
    currentSamsatDevices.forEach(d => {
      const layanan = d.serviceUnit || 'Lainnya';
      if (!groups[layanan]) groups[layanan] = [];
      groups[layanan].push(d);
    });
    return groups;
  }, [currentSamsatDevices]);

  const attentionDevices = useMemo(() => 
    currentSamsatDevices.filter(d => normalizeCondition(d.condition) !== 'Baik').slice(0, 5),
  [currentSamsatDevices]);

  const filteredDevices = useMemo(() => {
    let result = currentSamsatDevices;
    if (searchTerm) {
      result = result.filter(d => 
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.serviceUnit.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return result;
  }, [currentSamsatDevices, searchTerm]);

  useEffect(() => {
    getAuthCredentials();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setIsEditing(false);
      setIsRequestModalOpen(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!session || session.role !== 'admin') {
      setUnreadInboxCount(0);
      return;
    }

    refreshUnreadInboxCount();
    const t = window.setInterval(() => {
      refreshUnreadInboxCount();
    }, 20000);

    return () => window.clearInterval(t);
  }, [session, refreshUnreadInboxCount]);

  const renderScanQR = () => {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[400px]">
        <div className="flex items-center gap-3 mb-8">
          <QrCode className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-black text-slate-900">Scan QR Code Perangkat</h3>
        </div>
        <p className="text-sm text-slate-500 font-bold mb-6">Arahkan kamera ke QR Code pada perangkat untuk melihat detailnya secara otomatis.</p>
        <div id="qr-reader" className="w-full max-w-lg mx-auto rounded-3xl overflow-hidden border-2 border-slate-100 bg-slate-50"></div>
      </div>
    );
  };

  useEffect(() => {
    let html5QrcodeScanner: { render: (onSuccess: (decodedText: string) => void, onError: (errorMessage: string) => void) => void; clear: () => Promise<void> } | null = null;
    if (viewMode === 'scan-qr' && isAdmin) {
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        html5QrcodeScanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        html5QrcodeScanner.render((decodedText: string) => {
          try {
            const data = JSON.parse(decodedText);
            if (data.id) {
              const device = devices.find(d => d.id === data.id);
              if (device) {
                void html5QrcodeScanner?.clear();
                if (device.samsat !== activeSamsat) {
                  setActiveSamsat(device.samsat);
                }
                setSelectedDevice(device);
                setIsEditing(false);
                setViewMode('devices');
              } else {
                window.alert('Perangkat tidak ditemukan di database.');
              }
            }
          } catch (e) {
            window.alert('QR Code tidak valid.');
          }
        }, () => {});
      });
    }

    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(console.error);
      }
    };
  }, [viewMode, isAdmin, devices, activeSamsat]);

  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-[#F8FAFC] text-[#1E293B] font-sans flex items-start sm:items-center justify-center px-4 py-6 sm:p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6 sm:mb-7">
            <img
              src="https://bapenda.kalselprov.go.id/wp-content/uploads/2025/08/Logo-Sayembara-Bapenda.png"
              alt="Bapenda Kalimantan Selatan"
              referrerPolicy="no-referrer"
              className="h-16 sm:h-20 w-auto object-contain"
            />
            <h1 className="mt-4 text-xl font-black text-slate-900 text-center">Inventaris Kesamsatan</h1>
            <p className="text-[11px] text-slate-500 font-bold text-center">BAPENDA PROV KALSEL</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-5 sm:p-8 shadow-sm">
            <div className="grid grid-cols-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 mb-6">
              <button
                onClick={() => { setAuthTab('admin'); setAuthUsername(''); setAuthPassword(''); setAuthError(null); }}
                className={`py-2 rounded-xl text-xs font-black transition-all ${authTab === 'admin' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Super Admin
              </button>
              <button
                onClick={() => { setAuthTab('user'); setAuthUsername(''); setAuthPassword(''); setAuthError(null); }}
                className={`py-2 rounded-xl text-xs font-black transition-all ${authTab === 'user' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                User
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">User</label>
                <input
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(authTab); }}
                  className="w-full p-4 sm:p-3 bg-white border border-slate-200 rounded-xl font-bold text-base sm:text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  placeholder="Masukkan user"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(authTab); }}
                  className="w-full p-4 sm:p-3 bg-white border border-slate-200 rounded-xl font-bold text-base sm:text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  placeholder="Masukkan password"
                />
              </div>

              {authError && (
                <div className="px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold">
                  {authError}
                </div>
              )}

              <button
                onClick={() => handleLogin(authTab)}
                className="w-full px-6 py-4 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-base sm:text-sm transition-all shadow-lg shadow-blue-200"
              >
                Masuk
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] text-[#1E293B] font-sans flex flex-col md:flex-row overflow-x-hidden md:overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col z-40 shrink-0">
        <div className="p-4 sm:p-6 flex flex-col items-center gap-3 border-b border-slate-50">
          <img
            src="https://bapenda.kalselprov.go.id/wp-content/uploads/2025/08/Logo-Sayembara-Bapenda.png?v=20250823"
            alt="Bapenda Kalimantan Selatan"
            referrerPolicy="no-referrer"
            className="h-10 sm:h-12 w-auto object-contain"
          />
          <div className="text-center">
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Inventaris Kesamsatan</h1>
            <p className="text-[10px] text-slate-500 font-medium">BAPENDA PROV KALSEL</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black border ${isAdmin ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              {isAdmin ? 'SUPER ADMIN' : 'USER'}
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black transition-colors"
            >
              Keluar
            </button>
          </div>
        </div>

        {activeSamsat && (
          <div className="px-4 py-6">
            <div className="relative">
              <button 
                onClick={() => setShowSamsatDropdown(!showSamsatDropdown)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between group hover:border-blue-300 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-slate-600">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-blue-900">{activeSamsat}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Ganti kantor</p>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showSamsatDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {showSamsatDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50"
                  >
                    {samsatList.map(s => (
                      <button 
                        key={s}
                        onClick={() => { setActiveSamsat(s); setShowSamsatDropdown(false); setViewMode('dashboard'); }}
                        className="w-full p-3 text-left text-xs font-bold hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        <nav className="flex-grow px-4 space-y-2 py-4">
          <button 
            onClick={() => setViewMode('selection')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${
              viewMode === 'selection' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span>Pilih Kantor</span>
          </button>
          {isAdmin && (
            <button
              onClick={openInbox}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl font-bold text-sm transition-all text-slate-500 hover:bg-slate-50"
            >
              <span className="flex items-center gap-3">
                <Inbox className="w-5 h-5" />
                <span>Pesan Masuk</span>
              </span>
              {unreadInboxCount > 0 && (
                <span className="min-w-7 h-7 px-2 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center">
                  {unreadInboxCount > 99 ? '99+' : unreadInboxCount}
                </span>
              )}
            </button>
          )}
          {activeSamsat && (
            <>
              <button 
                onClick={() => setViewMode('dashboard')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${
                  viewMode === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
              </button>
              <button 
                onClick={() => setViewMode('devices')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${
                  viewMode === 'devices' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Monitor className="w-5 h-5" />
                <span>Daftar Perangkat</span>
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setViewMode('scan-qr')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${
                    viewMode === 'scan-qr' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                  <span>Scan QR</span>
                </button>
              )}
              {isAdmin && !strictSheetSync && (
                <button
                  onClick={openRequestModal}
                  className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all text-slate-500 hover:bg-slate-50"
                >
                  <Plus className="w-5 h-5" />
                  <span>Tambah Perangkat</span>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setIsManageLoginOpen(true); setManageLoginError(null); setManageLoginSuccess(null); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all text-slate-500 hover:bg-slate-50"
                >
                  <KeyRound className="w-5 h-5" />
                  <span>Manajemen Login</span>
                </button>
              )}
              {!isAdmin && (
                <>
                  <button
                    onClick={() => { setDamageSuccess(null); setIsDamageReportOpen(true); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all text-slate-500 hover:bg-slate-50"
                  >
                    <Send className="w-5 h-5" />
                    <span>KIRIM LAPORAN</span>
                  </button>
                  <button
                    onClick={() => { setDeviceRequestSuccess(null); setIsDeviceRequestOpen(true); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all text-slate-500 hover:bg-slate-50"
                  >
                    <Send className="w-5 h-5" />
                    <span>PERMINTAAN PERANGKAT</span>
                  </button>
                </>
              )}
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-grow md:overflow-y-auto">
        <header className="p-4 sm:p-8 pb-3 sm:pb-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">
            {viewMode === 'selection' ? 'Daftar Kantor Samsat' : viewMode === 'scan-qr' ? 'Scan QR' : 'Dashboard'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {viewMode === 'selection' ? 'Pilih kantor untuk melihat data inventaris' : viewMode === 'scan-qr' ? 'Pindai QR code untuk melihat detail perangkat' : `Ringkasan inventaris — ${activeSamsat}`}
          </p>
        </header>

        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
          {viewMode === 'selection' ? (
            <div className="space-y-6">
              {samsatList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {samsatList.map((samsat, i) => (
                    <motion.div
                      key={samsat}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => { setActiveSamsat(samsat); setViewMode('dashboard'); }}
                      className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group text-center"
                    >
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Building2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mb-2">{samsat}</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">BAPENDA KALSEL</p>
                      <div className="pt-6 border-t border-slate-50 flex items-center justify-center gap-2 text-blue-600 font-black text-sm">
                        <span>Lihat Inventaris</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-12 rounded-[2rem] border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-6">
                    <Search className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Data Kantor Tidak Ditemukan</h3>
                  <p className="text-sm text-slate-500 max-w-xs mb-8">
                    Gagal memproses data dari Google Sheets. Pastikan spreadsheet memiliki kolom lokasi yang benar.
                  </p>
                  <button 
                    onClick={fetchData}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Coba Muat Ulang
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'scan-qr' && isAdmin ? (
            renderScanQR()
          ) : viewMode === 'dashboard' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { label: 'Total Perangkat', value: stats.total, icon: <Monitor className="w-6 h-6" />, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Kondisi Baik', value: stats.baik, icon: <CheckCircle2 className="w-6 h-6" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Kurang Baik', value: stats.kurangBaik, icon: <AlertTriangle className="w-6 h-6" />, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Rusak / Tidak Baik', value: stats.rusak, icon: <XCircle className="w-6 h-6" />, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Jenis Layanan', value: stats.layanan, icon: <Layers className="w-6 h-6" />, color: 'text-purple-600', bg: 'bg-purple-50', onClick: () => setIsLayananModalOpen(true) },
                ].map((stat, i) => (
                  <motion.div 
                    key={i} 
                    onClick={stat.onClick}
                    className={`bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-start gap-4 ${stat.onClick ? 'cursor-pointer hover:border-purple-300 hover:shadow-md transition-all' : ''}`}
                  >
                    <div className={`p-3 ${stat.bg} ${stat.color} rounded-2xl`}>{stat.icon}</div>
                    <div>
                      <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{stat.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="text-lg font-black text-slate-900">Perangkat Perlu Perhatian</h3>
                  </div>
                  <div className="space-y-4">
                    {attentionDevices.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors">
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{d.name}</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{d.serviceUnit} • {d.subLocation}</p>
                        </div>
                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${
                          normalizeCondition(d.condition) === 'Rusak' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {normalizeCondition(d.condition)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <List className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-black text-slate-900">Distribusi Kondisi Perangkat</h3>
                  </div>
                  <div className="space-y-8">
                    {[
                      { label: 'Baik', value: stats.baik, color: 'bg-emerald-500' },
                      { label: 'Kurang Baik', value: stats.kurangBaik, color: 'bg-amber-500' },
                      { label: 'Rusak / Tidak Baik', value: stats.rusak, color: 'bg-rose-500' },
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-end mb-3">
                          <span className="text-sm font-bold text-slate-500">{item.label}</span>
                          <span className="text-sm font-black text-slate-900">{item.value} perangkat</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: stats.total > 0 ? `${(item.value / stats.total) * 100}%` : '0%' }}
                            className={`${item.color} h-full rounded-full`}
                          />
                        </div>
                      </div>
                    ))}

                    <div className="pt-8 border-t border-slate-100 space-y-6">
                      {[
                        {
                          label: 'Data Lengkap',
                          labelClass: 'text-slate-900',
                          barClass: 'bg-emerald-500',
                          total: stats.lengkapTotal,
                          baik: stats.lengkapBaik,
                          tidakBaik: stats.lengkapTidakBaik,
                        },
                        {
                          label: 'Data Tidak Lengkap',
                          labelClass: 'text-slate-900',
                          barClass: 'bg-rose-500',
                          total: stats.tidakLengkapTotal,
                          baik: stats.tidakLengkapBaik,
                          tidakBaik: stats.tidakLengkapTidakBaik,
                        },
                      ].map((item, i) => (
                        <div key={i}>
                          <div className="flex justify-between items-end mb-2">
                            <span className={`text-sm font-black ${item.labelClass}`}>{item.label}</span>
                            <span className="text-sm font-black text-slate-900">{item.total} perangkat</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                            <span>Baik {item.baik}</span>
                            <span>Tidak Baik {item.tidakBaik}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: item.total > 0 ? `${(item.baik / item.total) * 100}%` : '0%' }}
                              className={`${item.barClass} h-full`}
                            />
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: item.total > 0 ? `${(item.tidakBaik / item.total) * 100}%` : '0%' }}
                              className={`${item.barClass} h-full`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-grow max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cari perangkat..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium text-sm transition-all"
                  />
                </div>
                {activeSamsat && (
                  isAdmin && !strictSheetSync ? (
                    <button
                      onClick={openRequestModal}
                      className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Tambah Perangkat
                    </button>
                  ) : null
                )}
                <button onClick={fetchData} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors">
                  <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDevices.map((d) => (
                  <motion.div 
                    key={d.id}
                    onClick={() => setSelectedDevice(d)}
                    className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-all">
                        {d.category.toLowerCase().includes('printer') ? <Printer className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                      </div>
                      {isAdmin && !strictSheetSync && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteDevice(d); }}
                          className="p-2 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors"
                          aria-label="Hapus perangkat"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <h4 className="font-black text-slate-900 mb-1">{d.name}</h4>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-4">{d.serviceUnit} • {d.subLocation}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-md ${getConditionPillClass(d.condition)}`}>
                        {normalizeCondition(d.condition)}
                      </span>
                      {d.isComplete && <QrCode className="w-4 h-4 text-blue-500" />}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[3rem] w-full max-w-4xl overflow-hidden shadow-2xl relative">
              <button onClick={() => setSelectedDevice(null)} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl z-20">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
              <div className="flex flex-col lg:flex-row">
                <div className="w-full lg:w-1/2 bg-slate-50 relative min-h-[400px]">
                  {selectedDevice.photo ? (
                    <img src={selectedDevice.photo} alt={selectedDevice.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 p-12">
                      <Camera className="w-20 h-20 mb-6 opacity-20" />
                      <p className="text-sm font-bold">Belum Ada Foto</p>
                    </div>
                  )}
                  {isAdmin && (
                    <label className="absolute bottom-8 left-8 right-8 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl cursor-pointer flex items-center justify-center gap-3 font-bold transition-all">
                      <Upload className="w-5 h-5" />
                      <span>Upload Foto</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(selectedDevice.id, e)} />
                    </label>
                  )}
                </div>
                <div className="w-full lg:w-1/2 p-12 overflow-y-auto max-h-[80vh]">
                  <div className="mb-8">
                    <h3 className="text-3xl font-black text-slate-900 text-center">
                      {isEditing ? 'Edit Perangkat' : selectedDevice.name}
                    </h3>
                    {!isEditing && isAdmin && !strictSheetSync && (
                      <div className="mt-5 flex justify-center">
                        <button
                          onClick={() => {
                            setIsEditing(true);
                            setEditForm({ ...selectedDevice });
                          }}
                          className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black tracking-wider transition-all shadow-lg shadow-blue-200"
                        >
                          EDIT
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nama Perangkat</label>
                        <input 
                          type="text" 
                          value={editForm.name || ''} 
                          onChange={e => setEditForm({...editForm, name: e.target.value})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Serial Number</label>
                          <input 
                            type="text" 
                            value={editForm.serialNumber || ''} 
                            onChange={e => setEditForm({...editForm, serialNumber: e.target.value})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Kondisi</label>
                          <select 
                            value={editForm.condition || ''} 
                            onChange={e => setEditForm({...editForm, condition: e.target.value})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                          >
                            <option value="Baik">Baik</option>
                            <option value="Kurang Baik">Kurang Baik</option>
                            <option value="Rusak">Rusak</option>
                            <option value="Layar Rusak">Layar Rusak</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">No HP User</label>
                        <input 
                          type="text" 
                          value={editForm.phoneNumber || ''} 
                          onChange={e => setEditForm({...editForm, phoneNumber: e.target.value})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Unit Layanan</label>
                          <input 
                            type="text" 
                            value={editForm.serviceUnit || ''} 
                            onChange={e => setEditForm({...editForm, serviceUnit: e.target.value})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Pemegang (Staff)</label>
                          <input 
                            type="text" 
                            value={editForm.subLocation || ''} 
                            onChange={e => setEditForm({...editForm, subLocation: e.target.value})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button 
                          onClick={handleUpdateDevice}
                          className="flex-grow bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200"
                        >
                          Simpan Perubahan
                        </button>
                        <button 
                          onClick={() => setIsEditing(false)}
                          className="px-8 bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-bold transition-all"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-8 mb-12 text-sm font-bold">
                        <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">SN</p><p className="text-slate-900 font-mono">{selectedDevice.serialNumber}</p></div>
                        <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Jenis Layanan</p><p className="text-slate-900">{selectedDevice.serviceUnit}</p></div>
                        <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">No HP User</p><p className="text-slate-900">{selectedDevice.phoneNumber || '-'}</p></div>
                        <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Pemegang</p><p className="text-slate-900">{selectedDevice.subLocation || '-'}</p></div>
                        <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Samsat</p><p className="text-slate-900">{selectedDevice.samsat}</p></div>
                        <div>
                          <p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Kondisi</p>
                          <p className={normalizeCondition(selectedDevice.condition) === 'Baik' ? 'text-emerald-600' : normalizeCondition(selectedDevice.condition) === 'Kurang Baik' ? 'text-amber-700' : 'text-rose-600'}>
                            {normalizeCondition(selectedDevice.condition)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-8 rounded-[2.5rem] flex flex-col items-center border border-slate-100">
                        <div className="bg-white p-4 rounded-3xl shadow-sm mb-6">
                          <QRCodeSVG value={JSON.stringify({ id: selectedDevice.id, sn: selectedDevice.serialNumber })} size={140} level="H" />
                        </div>
                        <button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3">
                          <Printer className="w-5 h-5" /> Cetak Label QR
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLayananModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[3rem] w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl relative flex flex-col">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Daftar Perangkat per Jenis Layanan</h3>
                  <p className="text-sm font-bold text-slate-500 mt-1">{activeSamsat}</p>
                </div>
                <button onClick={() => setIsLayananModalOpen(false)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto flex-grow space-y-8">
                {Object.entries(groupedLayanan).map(([layanan, devs]) => (
                  <div key={layanan} className="border border-slate-200 rounded-3xl overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-lg font-black text-slate-900">{layanan}</h4>
                      <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
                        {devs.length} Perangkat
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {devs.map((d, i) => (
                        <div key={i} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                          <div>
                            <p className="font-black text-slate-900">{d.name}</p>
                            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">{d.serialNumber}</p>
                          </div>
                          <div className="flex flex-col md:items-end gap-1 text-sm font-bold">
                            <p className="text-slate-600">User: <span className="text-slate-900">{d.subLocation || '-'}</span></p>
                            <p className="text-slate-600">No HP: <span className="text-slate-900">{d.phoneNumber || '-'}</span></p>
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest inline-block w-max ${
                              normalizeCondition(d.condition) === 'Baik' ? 'bg-emerald-100 text-emerald-700' : 
                              normalizeCondition(d.condition) === 'Kurang Baik' ? 'bg-amber-100 text-amber-700' : 
                              'bg-rose-100 text-rose-600'
                            }`}>
                              {normalizeCondition(d.condition)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRequestModalOpen && requestDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[3rem] w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl relative">
              <button onClick={() => setIsRequestModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl z-20">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
              <div className="p-6 md:p-10 overflow-y-auto max-h-[calc(100vh-2rem)]">
                <div className="mb-6">
                  <h3 className="text-xl font-black text-slate-900">Tambah Perangkat — {requestDraft.samsat}</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">Kelola alur permintaan, koreksi stok, disposisi, dan input perangkat.</p>
                </div>

                {(() => {
                  const suratOk = !!requestDraft.letter && requestDraft.requestedCount > 0;
                  const stockOk = requestDraft.stockStatus === 'ready';
                  const stockNo = requestDraft.stockStatus === 'empty';
                  const stockBadge = getStatusBadge(stockOk ? 'ok' : stockNo ? 'no' : 'pending');

                  const kabidBadge = getStatusBadge(requestDraft.kabid.status === 'approved' ? 'ok' : requestDraft.kabid.status === 'rejected' ? 'no' : 'pending');
                  const sekbanBadge = getStatusBadge(requestDraft.sekban.status === 'approved' ? 'ok' : requestDraft.sekban.status === 'rejected' ? 'no' : 'pending');

                  const approvedCount = getApprovedCount(requestDraft);
                  const remaining = approvedCount - requestDraft.addedDeviceIds.length;
                  const canInput = suratOk && approvedCount > 0;

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="border border-slate-100 rounded-3xl p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Surat Permintaan</p>
                              <p className="text-xs font-black text-slate-900 mt-1">Upload surat dan jumlah perangkat</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-2 ${getStatusBadge(suratOk ? 'ok' : 'pending').className}`}>
                              {getStatusBadge(suratOk ? 'ok' : 'pending').icon}
                              {getStatusBadge(suratOk ? 'ok' : 'pending').text}
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Upload Surat</p>
                              <label className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 flex items-center justify-center gap-2 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">
                                <FileUp className="w-5 h-5 text-slate-500" />
                                <span>{requestDraft.letter ? 'Ganti Surat' : 'Pilih Surat'}</span>
                                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleLetterUpload} />
                              </label>
                              {requestDraft.letter && (
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <p className="text-xs font-bold text-slate-600 truncate">{requestDraft.letter.fileName}</p>
                                  <button
                                    onClick={() => window.open(requestDraft.letter?.dataUrl || '', '_blank')}
                                    className="text-xs font-black text-blue-600 hover:text-blue-700"
                                  >
                                    Lihat
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Jenis Permintaan Perangkat</p>
                              <select
                                value={requestDraft.requestType}
                                onChange={(e) => persistRequestDraft({ ...requestDraft, requestType: e.target.value as RequestType })}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-black text-slate-900"
                              >
                                <option value="PC KESAMSATAN">PC KESAMSATAN</option>
                                <option value="PRINTER KESAMSATAN">PRINTER KESAMSATAN</option>
                              </select>
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Jumlah Diminta</p>
                              <input
                                type="number"
                                min={0}
                                value={requestDraft.requestedCount}
                                onChange={(e) => persistRequestDraft({ ...requestDraft, requestedCount: Math.max(0, Number(e.target.value || 0)) })}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                              {suratOk && (
                                <div className="mt-3 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2">
                                  SURAT SUDAH MASUK DALAM PROSES DISPOSISI
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="border border-slate-100 rounded-3xl p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Koreksi Stok</p>
                              <p className="text-xs font-black text-slate-900 mt-1">Cek ketersediaan stok</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-2 ${stockBadge.className}`}>
                              {stockBadge.icon}
                              {stockBadge.text}
                            </div>
                          </div>
                          <div className="mt-4">
                            <select
                              value={requestDraft.stockStatus}
                              onChange={(e) => persistRequestDraft({ ...requestDraft, stockStatus: e.target.value as StockStatus })}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-black text-slate-900"
                            >
                              <option value="standby">Stand By (DALAM PROSES)</option>
                              <option value="ready">Stok Ready</option>
                              <option value="empty">Kosong</option>
                            </select>
                          </div>
                        </div>

                        <div className="border border-slate-100 rounded-3xl p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disposisi Kabid IPSIPD</p>
                              <p className="text-xs font-black text-slate-900 mt-1">Status persetujuan dan jumlah</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-2 ${kabidBadge.className}`}>
                              {kabidBadge.icon}
                              {kabidBadge.text}
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select
                              value={requestDraft.kabid.status}
                              onChange={(e) => {
                                const nextStatus = e.target.value as ApprovalStatus;
                                persistRequestDraft({
                                  ...requestDraft,
                                  kabid: { status: nextStatus, approvedCount: nextStatus === 'approved' ? (requestDraft.kabid.approvedCount ?? requestDraft.requestedCount) : null }
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-black text-slate-900"
                            >
                              <option value="pending">Stand By (DALAM PROSES)</option>
                              <option value="approved">Setuju</option>
                              <option value="rejected">Tidak Setuju</option>
                            </select>
                            <input
                              type="number"
                              min={0}
                              disabled={requestDraft.kabid.status !== 'approved'}
                              value={requestDraft.kabid.status === 'approved' ? Number(requestDraft.kabid.approvedCount || 0) : 0}
                              onChange={(e) => persistRequestDraft({ ...requestDraft, kabid: { ...requestDraft.kabid, approvedCount: Math.max(0, Number(e.target.value || 0)) } })}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-black text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                              placeholder="Jumlah disetujui"
                            />
                          </div>
                        </div>

                        <div className="border border-slate-100 rounded-3xl p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disposisi Sekretaris Badan</p>
                              <p className="text-xs font-black text-slate-900 mt-1">Status persetujuan dan jumlah</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-2 ${sekbanBadge.className}`}>
                              {sekbanBadge.icon}
                              {sekbanBadge.text}
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select
                              value={requestDraft.sekban.status}
                              onChange={(e) => {
                                const nextStatus = e.target.value as ApprovalStatus;
                                persistRequestDraft({
                                  ...requestDraft,
                                  sekban: { status: nextStatus, approvedCount: nextStatus === 'approved' ? (requestDraft.sekban.approvedCount ?? requestDraft.requestedCount) : null }
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-black text-slate-900"
                            >
                              <option value="pending">Stand By (DALAM PROSES)</option>
                              <option value="approved">Setuju</option>
                              <option value="rejected">Tidak Setuju</option>
                            </select>
                            <input
                              type="number"
                              min={0}
                              disabled={requestDraft.sekban.status !== 'approved'}
                              value={requestDraft.sekban.status === 'approved' ? Number(requestDraft.sekban.approvedCount || 0) : 0}
                              onChange={(e) => persistRequestDraft({ ...requestDraft, sekban: { ...requestDraft.sekban, approvedCount: Math.max(0, Number(e.target.value || 0)) } })}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-black text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                              placeholder="Jumlah disetujui"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="border border-slate-100 rounded-3xl p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Input Perangkat</p>
                              <p className="text-xs font-black text-slate-900 mt-1">Masukkan perangkat sesuai jumlah disetujui</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-2 ${getStatusBadge(canInput && remaining > 0 ? 'pending' : canInput && remaining <= 0 && approvedCount > 0 ? 'ok' : 'pending').className}`}>
                              {getStatusBadge(canInput && remaining > 0 ? 'pending' : canInput && remaining <= 0 && approvedCount > 0 ? 'ok' : 'pending').icon}
                              {getStatusBadge(canInput && remaining > 0 ? 'pending' : canInput && remaining <= 0 && approvedCount > 0 ? 'ok' : 'pending').text}
                            </div>
                          </div>

                          {!suratOk && (
                            <div className="mt-5 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">
                              Upload surat dan isi jumlah perangkat yang diminta.
                            </div>
                          )}

                          {suratOk && requestDraft.stockStatus !== 'ready' && (
                            <div className="mt-5 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">
                              Koreksi stok harus <span className="text-emerald-700">Stok Ready</span> untuk lanjut input perangkat.
                            </div>
                          )}

                          {suratOk && requestDraft.stockStatus === 'ready' && (requestDraft.kabid.status !== 'approved' || requestDraft.sekban.status !== 'approved') && (
                            <div className="mt-5 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">
                              Disposisi Kabid IPSIPD dan Sekretaris Badan harus <span className="text-emerald-700">Setuju</span>.
                            </div>
                          )}

                          {canInput && (
                            <>
                              {approvedCount > 0 && remaining <= 0 ? (
                                <div className="mt-5 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 text-sm font-black text-emerald-700">
                                  PERMINTAAN DISETUJUI, jumlah perangkat yang disetujui: {approvedCount}
                                </div>
                              ) : (
                                <div className="mt-5 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-sm font-black text-amber-800">
                                  Sisa input perangkat: {Math.max(0, remaining)} / {approvedCount}
                                </div>
                              )}

                              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nama Perangkat</label>
                                  <input
                                    type="text"
                                    value={String(newDeviceDraft.name || '')}
                                    onChange={(e) => setNewDeviceDraft(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Jenis Layanan</label>
                                  <input
                                    type="text"
                                    value={String(newDeviceDraft.serviceUnit || '')}
                                    onChange={(e) => setNewDeviceDraft(prev => ({ ...prev, serviceUnit: e.target.value }))}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Serial Number</label>
                                  <input
                                    type="text"
                                    value={String(newDeviceDraft.serialNumber || '')}
                                    onChange={(e) => setNewDeviceDraft(prev => ({ ...prev, serialNumber: e.target.value }))}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">No HP User</label>
                                  <input
                                    type="text"
                                    value={String(newDeviceDraft.phoneNumber || '')}
                                    onChange={(e) => setNewDeviceDraft(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Pemegang (Staff)</label>
                                  <input
                                    type="text"
                                    value={String(newDeviceDraft.subLocation || '')}
                                    onChange={(e) => setNewDeviceDraft(prev => ({ ...prev, subLocation: e.target.value }))}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Kondisi</label>
                                  <select
                                    value={String(newDeviceDraft.condition || 'Baik')}
                                    onChange={(e) => setNewDeviceDraft(prev => ({ ...prev, condition: e.target.value }))}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
                                  >
                                    <option value="Baik">Baik</option>
                                    <option value="Kurang Baik">Kurang Baik</option>
                                    <option value="Rusak">Rusak</option>
                                  </select>
                                </div>
                              </div>

                              <button
                                onClick={addRequestedDevice}
                                disabled={remaining <= 0}
                                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500"
                              >
                                <Plus className="w-5 h-5" />
                                Tambah Perangkat (1)
                              </button>
                            </>
                          )}
                        </div>

                        <div className="border border-slate-100 rounded-3xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Perangkat Ditambahkan</p>
                              <p className="text-sm font-black text-slate-900 mt-1">{requestDraft.addedDeviceIds.length} perangkat</p>
                            </div>
                            {approvedCount > 0 && (
                              <div className="text-[11px] font-black text-slate-600">
                                Disetujui: {approvedCount}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                            {devices.filter(d => requestDraft.addedDeviceIds.includes(d.id)).map(d => (
                              <div key={d.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900 truncate">{d.name}</p>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{d.serviceUnit} • {d.subLocation}</p>
                                </div>
                                <button onClick={() => deleteDevice(d)} className="p-2 rounded-xl hover:bg-rose-50 text-rose-600">
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            ))}
                            {devices.filter(d => requestDraft.addedDeviceIds.includes(d.id)).length === 0 && (
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">
                                Belum ada perangkat yang ditambahkan.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isManageLoginOpen && isAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl relative"
            >
              <button onClick={() => setIsManageLoginOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl z-20">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>

              <div className="p-8 md:p-10">
                <div className="mb-7">
                  <h3 className="text-xl font-black text-slate-900">Manajemen Login</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">Hanya dapat diakses oleh Super Admin.</p>
                </div>

                <div className="space-y-5">
                  <div className="border border-slate-100 rounded-3xl p-5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verifikasi</p>
                    <p className="text-xs font-black text-slate-900 mt-1">Password Super Admin saat ini</p>
                    <div className="mt-4">
                      <input
                        type="password"
                        value={manageLoginForm.currentAdminPassword}
                        onChange={(e) => setManageLoginForm(prev => ({ ...prev, currentAdminPassword: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Masukkan password saat ini"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-3xl p-5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubah Password</p>
                    <p className="text-xs font-black text-slate-900 mt-1">Super Admin (admin)</p>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="password"
                        value={manageLoginForm.newAdminPassword}
                        onChange={(e) => setManageLoginForm(prev => ({ ...prev, newAdminPassword: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Password baru"
                      />
                      <input
                        type="password"
                        value={manageLoginForm.confirmAdminPassword}
                        onChange={(e) => setManageLoginForm(prev => ({ ...prev, confirmAdminPassword: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Konfirmasi password"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-3xl p-5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubah Password</p>
                    <p className="text-xs font-black text-slate-900 mt-1">User (user)</p>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="password"
                        value={manageLoginForm.newUserPassword}
                        onChange={(e) => setManageLoginForm(prev => ({ ...prev, newUserPassword: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Password baru"
                      />
                      <input
                        type="password"
                        value={manageLoginForm.confirmUserPassword}
                        onChange={(e) => setManageLoginForm(prev => ({ ...prev, confirmUserPassword: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Konfirmasi password"
                      />
                    </div>
                  </div>

                  {manageLoginError && (
                    <div className="px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold">
                      {manageLoginError}
                    </div>
                  )}

                  {manageLoginSuccess && (
                    <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold">
                      {manageLoginSuccess}
                    </div>
                  )}

                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={saveManageLogin}
                      className="flex-grow bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-blue-200"
                    >
                      Simpan Perubahan
                    </button>
                    <button
                      onClick={() => setIsManageLoginOpen(false)}
                      className="px-8 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-black transition-all"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDamageReportOpen && !isAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[3rem] w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl relative"
            >
              <button onClick={() => setIsDamageReportOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl z-20">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>

              <div className="p-6 md:p-10 overflow-y-auto max-h-[calc(100vh-2rem)]">
                <div className="mb-6">
                  <h3 className="text-xl font-black text-slate-900">Laporan Kerusakan Perangkat</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">{activeSamsat || 'Pilih kantor Samsat terlebih dahulu'}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Kerusakan Perangkat</label>
                    <textarea
                      value={damageDraft.kerusakanPerangkat}
                      onChange={(e) => setDamageDraft(prev => ({ ...prev, kerusakanPerangkat: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[90px]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Layanan yang Rusak</label>
                    <input
                      value={damageDraft.layananRusak}
                      onChange={(e) => setDamageDraft(prev => ({ ...prev, layananRusak: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Jenis/Merk/SN Perangkat Rusak</label>
                    <input
                      value={damageDraft.jenisMerkSnPerangkatRusak}
                      onChange={(e) => setDamageDraft(prev => ({ ...prev, jenisMerkSnPerangkatRusak: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nama dan Kontak Pengguna</label>
                    <input
                      value={damageDraft.namaDanKontakPengguna}
                      onChange={(e) => setDamageDraft(prev => ({ ...prev, namaDanKontakPengguna: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Nama - No HP"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Apakah sudah melaksanakan perbaikan secara mandiri?</label>
                      <select
                        value={damageDraft.perbaikanMandiri}
                        onChange={(e) => {
                          const v = e.target.value as 'Sudah' | 'Belum';
                          setDamageDraft(prev => ({
                            ...prev,
                            perbaikanMandiri: v,
                            kwitansiFile: null,
                            alasanBelumMelaksanakanPerbaikanMandiri: v === 'Belum' ? prev.alasanBelumMelaksanakanPerbaikanMandiri : ''
                          }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-slate-900"
                      >
                        <option value="Belum">Belum</option>
                        <option value="Sudah">Sudah</option>
                      </select>
                    </div>

                    {damageDraft.perbaikanMandiri === 'Sudah' ? (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Upload Foto Kwitansi Bukti Perbaikan</label>
                        <label className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-black text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                          <FileUp className="w-5 h-5 text-slate-500" />
                          <span>{damageDraft.kwitansiFile ? damageDraft.kwitansiFile.name : 'Pilih File'}</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              if (!file) return setDamageDraft(prev => ({ ...prev, kwitansiFile: null }));
                              if (!validatePickedFile(file, { allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'], maxBytes: MAX_UPLOAD_BYTES, label: 'Upload foto kwitansi bukti perbaikan' })) return;
                              setDamageDraft(prev => ({ ...prev, kwitansiFile: file }));
                            }}
                          />
                        </label>
                        <p className="mt-2 text-[10px] font-bold text-slate-400">Format: JPG/JPEG/PNG • Maks 2MB</p>
                      </div>
                    ) : null}
                  </div>

                  {damageDraft.perbaikanMandiri === 'Belum' ? (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Alasan belum melaksanakan perbaikan secara mandiri <span className="text-rose-600 font-black">*</span></label>
                      <textarea
                        value={damageDraft.alasanBelumMelaksanakanPerbaikanMandiri}
                        onChange={(e) => setDamageDraft(prev => ({ ...prev, alasanBelumMelaksanakanPerbaikanMandiri: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[90px]"
                      />
                    </div>
                  ) : null}

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">UPLOAD FOTO PERANGKAT RUSAK <span className="text-rose-600 font-black">*</span></label>
                    <label className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-black text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                      <Upload className="w-5 h-5 text-slate-500" />
                      <span>{damageDraft.fotoRusakFile ? damageDraft.fotoRusakFile.name : 'Pilih Foto'}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (!file) return setDamageDraft(prev => ({ ...prev, fotoRusakFile: null }));
                          if (!validatePickedFile(file, { allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'], maxBytes: MAX_UPLOAD_BYTES, label: 'Upload foto perangkat rusak' })) return;
                          setDamageDraft(prev => ({ ...prev, fotoRusakFile: file }));
                        }}
                      />
                    </label>
                    <p className="mt-2 text-[10px] font-bold text-slate-400">Format: JPG/JPEG/PNG • Maks 2MB</p>
                  </div>

                  {damageSuccess && (
                    <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-black">
                      {damageSuccess}
                    </div>
                  )}

                  <button
                    onClick={submitDamageReport}
                    disabled={damageSending}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <Send className="w-5 h-5" />
                    KIRIM
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeviceRequestOpen && !isAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[3rem] w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl relative"
            >
              <button onClick={() => setIsDeviceRequestOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl z-20">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>

              <div className="p-6 md:p-10 overflow-y-auto max-h-[calc(100vh-2rem)]">
                <div className="mb-6">
                  <h3 className="text-xl font-black text-slate-900">Pengajuan Permintaan Perangkat</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">{activeSamsat || 'Pilih kantor Samsat terlebih dahulu'}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">UPLOAD SURAT PERMINTAAN PERANGKAT ANDA</label>
                    <label className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-black text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                      <FileUp className="w-5 h-5 text-slate-500" />
                      <span>{deviceRequestDraft.suratFile ? deviceRequestDraft.suratFile.name : 'Pilih File'}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (!file) return setDeviceRequestDraft(prev => ({ ...prev, suratFile: null }));
                          if (!validatePickedFile(file, { allowedMimeTypes: ['application/pdf'], maxBytes: MAX_UPLOAD_BYTES, label: 'Upload surat permintaan perangkat' })) return;
                          setDeviceRequestDraft(prev => ({ ...prev, suratFile: file }));
                        }}
                      />
                    </label>
                    <p className="mt-2 text-[10px] font-bold text-slate-400">Format: PDF • Maks 2MB</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">UNTUK LAYANAN <span className="text-rose-600 font-black">*</span></label>
                    <input
                      value={deviceRequestDraft.untukLayanan}
                      onChange={(e) => setDeviceRequestDraft(prev => ({ ...prev, untukLayanan: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Contoh: KASIR / PELAYANAN INDUK"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">KEBUTUHAN PERANGKAT</label>
                      <select
                        value={deviceRequestDraft.kebutuhanPerangkat}
                        onChange={(e) => setDeviceRequestDraft(prev => ({
                          ...prev,
                          kebutuhanPerangkat: e.target.value as DeviceRequestSubmissionPayload['kebutuhanPerangkat'],
                          jumlahPermintaan: null,
                          jumlahPermintaanPC: null,
                          jumlahPermintaanPrinter: null
                        }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-slate-900"
                      >
                        <option value="PC KESAMSATAN">PC KESAMSATAN</option>
                        <option value="PRINTER KESAMSATAN">PRINTER KESAMSATAN</option>
                        <option value="PC & PRINTER KESAMSATAN">PC & PRINTER KESAMSATAN</option>
                      </select>
                    </div>

                    {deviceRequestDraft.kebutuhanPerangkat === 'PC & PRINTER KESAMSATAN' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Permintaan PC</label>
                          <input
                            type="number"
                            min={0}
                            value={deviceRequestDraft.jumlahPermintaanPC ?? ''}
                            onChange={(e) => setDeviceRequestDraft(prev => ({ ...prev, jumlahPermintaanPC: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) }))}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Permintaan Printer</label>
                          <input
                            type="number"
                            min={0}
                            value={deviceRequestDraft.jumlahPermintaanPrinter ?? ''}
                            onChange={(e) => setDeviceRequestDraft(prev => ({ ...prev, jumlahPermintaanPrinter: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) }))}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-slate-900"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">JUMLAH PERMINTAAN</label>
                        <input
                          type="number"
                          min={0}
                          value={deviceRequestDraft.jumlahPermintaan ?? ''}
                          onChange={(e) => setDeviceRequestDraft(prev => ({ ...prev, jumlahPermintaan: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) }))}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-slate-900"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">ALASAN PERMINTAAN PERANGKAT</label>
                    <textarea
                      value={deviceRequestDraft.alasanPermintaan}
                      onChange={(e) => setDeviceRequestDraft(prev => ({ ...prev, alasanPermintaan: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[90px]"
                    />
                  </div>

                  {deviceRequestSuccess && (
                    <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-black">
                      {deviceRequestSuccess}
                    </div>
                  )}

                  <button
                    onClick={submitDeviceRequest}
                    disabled={deviceRequestSending}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <Send className="w-5 h-5" />
                    KIRIM
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isInboxOpen && isAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[3rem] w-full max-w-6xl max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl relative"
            >
              <button onClick={() => setIsInboxOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl z-20">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>

              <div className="p-6 md:p-10 overflow-y-auto max-h-[calc(100vh-2rem)]">
                <div className="mb-6">
                  <h3 className="text-xl font-black text-slate-900">Pesan Masuk</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">Kelola laporan dan permintaan dari user.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-slate-100 rounded-3xl p-5">
                    <div className="grid grid-cols-3 bg-slate-50 border border-slate-200 rounded-2xl p-1 mb-5">
                      <button
                        onClick={async () => { setInboxTab('damage_report'); setActiveInboxMessage(null); await fetchInboxItems('damage_report', 'all'); }}
                        className={`py-2 rounded-xl text-xs font-black transition-all ${inboxTab === 'damage_report' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Laporan Kerusakan
                      </button>
                      <button
                        onClick={async () => { setInboxTab('device_request'); setActiveInboxMessage(null); await fetchInboxItems('device_request', 'all'); }}
                        className={`py-2 rounded-xl text-xs font-black transition-all ${inboxTab === 'device_request' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Permintaan Perangkat
                      </button>
                      <button
                        onClick={() => { setInboxTab('downloads'); setActiveInboxMessage(null); setMessageDirectory(prev => cleanupMessageDirectory(prev)); }}
                        className={`py-2 rounded-xl text-xs font-black transition-all ${inboxTab === 'downloads' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Direktori Pesan
                      </button>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-black text-slate-900">Daftar Pesan</p>
                      <button
                        onClick={async () => { if (inboxTab !== 'downloads') { await fetchInboxItems(inboxTab, 'all'); refreshUnreadInboxCount(); } else { setMessageDirectory(prev => cleanupMessageDirectory(prev)); } }}
                        className="px-3 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-black"
                      >
                        Refresh
                      </button>
                    </div>

                    {inboxTab === 'downloads' ? (
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {messageDirectory.length === 0 ? (
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">
                            Direktori kosong.
                          </div>
                        ) : (
                          messageDirectory.map(item => (
                            <div key={item.id} className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900 truncate">{item.fileName}</p>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    {item.kind.toUpperCase()} • {item.samsat} • {new Date(item.createdAt).toLocaleString()}
                                  </p>
                                  <p className="text-[10px] font-bold text-slate-400 mt-1">Hapus otomatis: {new Date(item.expiresAt).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => downloadMessageDirectoryItem(item)}
                                    className="px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black"
                                  >
                                    Download
                                  </button>
                                  <button
                                    onClick={() => deleteMessageDirectoryItem(item.id)}
                                    className="p-2 rounded-2xl bg-slate-50 hover:bg-rose-50 text-rose-600"
                                    aria-label="Hapus file"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : inboxLoading ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">
                        Memuat pesan...
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {inboxItems.length === 0 ? (
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">
                            Belum ada pesan.
                          </div>
                        ) : (
                          inboxItems.map(m => (
                            <button
                              key={m.id}
                              onClick={() => openInboxMessage(m)}
                              className="w-full text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900 truncate">{m.samsat}</p>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    {m.kind === 'damage_report' ? 'Laporan Kerusakan' : 'Permintaan Perangkat'} • {new Date(m.createdAt).toLocaleString()}
                                  </p>
                                </div>
                                {m.status === 'unread' && (
                                  <span className="w-3 h-3 rounded-full bg-rose-600 mt-1 shrink-0" />
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-100 rounded-3xl p-5">
                    <p className="text-sm font-black text-slate-900 mb-4">Detail Pesan</p>
                    {!activeInboxMessage ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">
                        Pilih pesan untuk melihat detail.
                      </div>
                    ) : activeInboxMessage.kind === 'damage_report' ? (
                      (() => {
                        const p = activeInboxMessage.payload as DamageReportPayload;
                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <button
                                onClick={() => downloadInboxMessagePdf(activeInboxMessage)}
                                className="bg-slate-900 hover:bg-slate-950 text-white py-3 rounded-2xl font-black text-xs"
                              >
                                Download PDF
                              </button>
                              <button
                                onClick={() => { if (p.kwitansiBuktiPerbaikan) downloadDamageAttachmentPdf(activeInboxMessage, 'kwitansi', p.kwitansiBuktiPerbaikan); }}
                                disabled={!p.kwitansiBuktiPerbaikan}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 py-3 rounded-2xl font-black text-xs disabled:opacity-40"
                              >
                                Download Kwitansi (PDF)
                              </button>
                              <button
                                onClick={() => { if (p.fotoPerangkatRusak) downloadDamageAttachmentPdf(activeInboxMessage, 'foto', p.fotoPerangkatRusak); }}
                                disabled={!p.fotoPerangkatRusak}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 py-3 rounded-2xl font-black text-xs disabled:opacity-40"
                              >
                                Download Foto (PDF)
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kerusakan Perangkat</p>
                                <p className="text-sm font-bold text-slate-900 mt-1 whitespace-pre-wrap">{p.kerusakanPerangkat}</p>
                              </div>
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Layanan yang Rusak</p>
                                <p className="text-sm font-bold text-slate-900 mt-1 whitespace-pre-wrap">{p.layananRusak}</p>
                              </div>
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jenis/Merk/SN Perangkat Rusak</p>
                                <p className="text-sm font-bold text-slate-900 mt-1 whitespace-pre-wrap">{p.jenisMerkSnPerangkatRusak}</p>
                              </div>
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama dan Kontak Pengguna</p>
                                <p className="text-sm font-bold text-slate-900 mt-1 whitespace-pre-wrap">{p.namaDanKontakPengguna}</p>
                              </div>
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perbaikan Mandiri</p>
                                <p className="text-sm font-bold text-slate-900 mt-1">{p.perbaikanMandiri}</p>
                              </div>
                              {p.perbaikanMandiri === 'Belum' ? (
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alasan Belum Melaksanakan Perbaikan Secara Mandiri</p>
                                  <p className="text-sm font-bold text-slate-900 mt-1 whitespace-pre-wrap">{p.alasanBelumMelaksanakanPerbaikanMandiri || '-'}</p>
                                </div>
                              ) : null}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="border border-slate-100 rounded-2xl p-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kwitansi Bukti Perbaikan</p>
                                {p.kwitansiBuktiPerbaikan ? (
                                  <button
                                    onClick={() => window.open(p.kwitansiBuktiPerbaikan?.dataUrl || '', '_blank')}
                                    className="mt-2 w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-blue-600 hover:bg-slate-50"
                                  >
                                    Lihat
                                  </button>
                                ) : (
                                  <p className="text-sm font-bold text-slate-600 mt-2">Tidak ada</p>
                                )}
                              </div>
                              <div className="border border-slate-100 rounded-2xl p-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto Perangkat Rusak</p>
                                {p.fotoPerangkatRusak ? (
                                  <button
                                    onClick={() => window.open(p.fotoPerangkatRusak?.dataUrl || '', '_blank')}
                                    className="mt-2 w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-blue-600 hover:bg-slate-50"
                                  >
                                    Lihat
                                  </button>
                                ) : (
                                  <p className="text-sm font-bold text-slate-600 mt-2">Tidak ada</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      (() => {
                        const p = activeInboxMessage.payload as DeviceRequestSubmissionPayload;
                        const jumlahText =
                          p.kebutuhanPerangkat === 'PC & PRINTER KESAMSATAN'
                            ? `PC ${Number(p.jumlahPermintaanPC || 0)} • PRINTER ${Number(p.jumlahPermintaanPrinter || 0)}`
                            : `${Number(p.jumlahPermintaan || 0)}`;
                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <button
                                onClick={() => downloadInboxMessagePdf(activeInboxMessage)}
                                className="bg-slate-900 hover:bg-slate-950 text-white py-3 rounded-2xl font-black text-xs"
                              >
                                Download PDF
                              </button>
                              <button
                                onClick={() => { if (p.suratPermintaan) downloadSuratPdf(activeInboxMessage, p.suratPermintaan); }}
                                disabled={!p.suratPermintaan}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 py-3 rounded-2xl font-black text-xs disabled:opacity-40"
                              >
                                Download Surat (PDF)
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Untuk Layanan</p>
                                <p className="text-sm font-bold text-slate-900 mt-1 whitespace-pre-wrap">{p.untukLayanan}</p>
                              </div>
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kebutuhan Perangkat</p>
                                <p className="text-sm font-bold text-slate-900 mt-1">{p.kebutuhanPerangkat}</p>
                              </div>
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jumlah Permintaan</p>
                                <p className="text-sm font-bold text-slate-900 mt-1">{jumlahText}</p>
                              </div>
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alasan Permintaan Perangkat</p>
                                <p className="text-sm font-bold text-slate-900 mt-1 whitespace-pre-wrap">{p.alasanPermintaan}</p>
                              </div>
                            </div>

                            <div className="border border-slate-100 rounded-2xl p-4">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Surat Permintaan</p>
                              {p.suratPermintaan ? (
                                <button
                                  onClick={() => window.open(p.suratPermintaan?.dataUrl || '', '_blank')}
                                  className="mt-2 w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-blue-600 hover:bg-slate-50"
                                >
                                  Lihat
                                </button>
                              ) : (
                                <p className="text-sm font-bold text-slate-600 mt-2">Tidak ada</p>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .bg-white.rounded-3xl, .bg-white.rounded-3xl * { visibility: visible; }
          .bg-white.rounded-3xl { position: fixed; left: 0; top: 0; }
        }
      `}</style>
    </div>
  )
}

export default App
