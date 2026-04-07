export interface Device {
  id: string;
  name: string;
  category: string;
  location: string;
  subLocation?: string;
  serialNumber: string;
  phoneNumber: string;
  condition: 'Baik' | 'Rusak' | string;
  budgetYear?: string;
  budgetSource?: string;
  serviceHistory?: string;
  photoR2Key?: string | null;
  photo?: string;
  isComplete: boolean;
  dataComplete: boolean;
  samsat: string;
  serviceUnit: string;
  sheetName: string;
}

export interface Stats {
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

export type StockStatus = 'ready' | 'empty' | 'standby';
export type ApprovalStatus = 'approved' | 'rejected' | 'pending';
export type RequestType = 'PC KESAMSATAN' | 'PRINTER KESAMSATAN' | 'PC & PRINTER KESAMSATAN';

export interface DeviceRequestLetter {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface DeviceRequest {
  requestId: string;
  samsat: string;
  requestType: RequestType;
  requestedCount: number;
  requestedCountPC: number;
  requestedCountPrinter: number;
  letter: DeviceRequestLetter | null;
  beritaAcara: DeviceRequestLetter | null;
  stockStatus: StockStatus;
  kabid: { status: ApprovalStatus; approvedCount: number | null };
  sekban: { status: ApprovalStatus; approvedCount: number | null };
  addedDeviceIds: string[];
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InboxKind = 'damage_report' | 'device_request';
export type InboxStatus = 'unread' | 'read';

export interface InboxAttachment {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface DamageReportPayload {
  kerusakanPerangkat: string;
  layananRusak: string;
  jenisMerkSnPerangkatRusak: string;
  namaDanKontakPengguna: string;
  perbaikanMandiri: 'Sudah' | 'Belum';
  alasanBelumMelaksanakanPerbaikanMandiri: string | null;
  kwitansiBuktiPerbaikan: InboxAttachment | null;
  fotoPerangkatRusak: InboxAttachment | null;
}

export interface DeviceRequestSubmissionPayload {
  suratPermintaan: InboxAttachment | null;
  untukLayanan: string;
  kebutuhanPerangkat: 'PC KESAMSATAN' | 'PRINTER KESAMSATAN' | 'PC & PRINTER KESAMSATAN';
  jumlahPermintaan: number | null;
  jumlahPermintaanPC: number | null;
  jumlahPermintaanPrinter: number | null;
  alasanPermintaan: string;
}

export interface InboxMessage {
  id: string;
  kind: InboxKind;
  status: InboxStatus;
  samsat: string;
  createdAt: string;
  payload: DamageReportPayload | DeviceRequestSubmissionPayload;
}

export type MessageDirectoryKind = 'message' | 'kwitansi' | 'foto' | 'surat';

export interface MessageDirectoryItem {
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

export type AuthRole = 'admin' | 'user';

export interface AuthCredentials {
  adminPassword: string;
  userPassword: string;
}

export interface AuthSession {
  role: AuthRole;
  username: string;
  loggedInAt: string;
}

export type AdminAccessScope = 'all' | 'restricted';

export interface AccountAccess {
  canSelectSamsat: boolean;
  canManageLogin: boolean;
  canAddDevice: boolean;
  canEditRequests: boolean;
  allowedSamsat: string[] | null;
}
