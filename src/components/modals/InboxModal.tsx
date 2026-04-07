import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, Trash2, Pencil } from 'lucide-react';
import {
  InboxMessage,
  MessageDirectoryItem,
  DamageReportPayload,
  DeviceRequestSubmissionPayload,
  InboxAttachment,
  InboxKind,
  InboxStatus
} from '../../types';

interface InboxModalProps {
  isOpen: boolean;
  isAdmin: boolean;
  onClose: () => void;
  inboxTab: string;
  setInboxTab: (tab: 'damage_report' | 'device_request' | 'downloads') => void;
  setActiveInboxMessage: (msg: InboxMessage | null) => void;
  fetchInboxItems: (kind: InboxKind, filterStatus: 'all' | InboxStatus) => Promise<InboxMessage[] | void>;
  setMessageDirectory: React.Dispatch<React.SetStateAction<MessageDirectoryItem[]>>;
  cleanupMessageDirectory: (directory: MessageDirectoryItem[]) => MessageDirectoryItem[];
  refreshUnreadInboxCount: () => void;
  messageDirectory: MessageDirectoryItem[];
  downloadMessageDirectoryItem: (item: MessageDirectoryItem) => void;
  deleteMessageDirectoryItem: (id: string) => void;
  inboxLoading: boolean;
  inboxItems: InboxMessage[];
  openInboxMessage: (m: InboxMessage) => void;
  openInboxEdit: (m: InboxMessage) => void;
  deleteInboxMessage: (m: InboxMessage) => void;
  activeInboxMessage: InboxMessage | null;
  downloadInboxMessagePdf: (m: InboxMessage) => void;
  downloadDamageAttachmentPdf: (m: InboxMessage, kind: 'kwitansi' | 'foto', att: InboxAttachment) => void;
  downloadSuratPdf: (m: InboxMessage, att: InboxAttachment) => void;
}

export function InboxModal({
  isOpen,
  isAdmin,
  onClose,
  inboxTab,
  setInboxTab,
  setActiveInboxMessage,
  fetchInboxItems,
  setMessageDirectory,
  cleanupMessageDirectory,
  refreshUnreadInboxCount,
  messageDirectory,
  downloadMessageDirectoryItem,
  deleteMessageDirectoryItem,
  inboxLoading,
  inboxItems,
  openInboxMessage,
  openInboxEdit,
  deleteInboxMessage,
  activeInboxMessage,
  downloadInboxMessagePdf,
  downloadDamageAttachmentPdf,
  downloadSuratPdf
}: InboxModalProps) {
  return (
    <AnimatePresence>
      {isOpen && isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[3rem] w-full max-w-6xl max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl relative"
          >
            <button onClick={onClose} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl z-20">
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
                      onClick={async () => { if (inboxTab !== 'downloads') { await fetchInboxItems(inboxTab as InboxKind, 'all'); refreshUnreadInboxCount(); } else { setMessageDirectory(prev => cleanupMessageDirectory(prev)); } }}
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
                          <div
                            key={m.id}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                onClick={() => openInboxMessage(m)}
                                className="flex-grow text-left min-w-0"
                              >
                                <p className="text-sm font-black text-slate-900 truncate">{m.samsat}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                  {m.kind === 'damage_report' ? 'Laporan Kerusakan' : 'Permintaan Perangkat'} • {new Date(m.createdAt).toLocaleString()}
                                </p>
                              </button>
                              <div className="flex items-center gap-2 shrink-0">
                                {m.status === 'unread' && (
                                  <span className="w-3 h-3 rounded-full bg-rose-600 mt-1 shrink-0" />
                                )}
                                <button
                                  onClick={() => openInboxEdit(m)}
                                  className="p-2 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
                                  aria-label="Edit pesan"
                                >
                                  <Pencil className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => deleteInboxMessage(m)}
                                  className="p-2 rounded-2xl bg-slate-50 hover:bg-rose-50 text-rose-600 transition-colors"
                                  aria-label="Hapus pesan"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
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
  );
}