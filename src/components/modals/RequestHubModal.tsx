import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, Trash2 } from 'lucide-react';
import { AccountAccess, DeviceRequest } from '../../types';

interface RequestHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSamsat: string | null;
  isAdmin: boolean;
  accountAccess: AccountAccess;
  createNewRequestFromHub: () => void;
  requestHistoryLoading: boolean;
  requestHistoryItems: DeviceRequest[];
  openRequestEditor: (requestId: string) => void;
  openRequestStatusModal: (requestId: string) => void;
  deleteRequestFromHub: (request: DeviceRequest) => void;
}

export function RequestHubModal({
  isOpen,
  onClose,
  activeSamsat,
  isAdmin,
  accountAccess,
  createNewRequestFromHub,
  requestHistoryLoading,
  requestHistoryItems,
  openRequestEditor,
  openRequestStatusModal,
  deleteRequestFromHub
}: RequestHubModalProps) {
  return (
    <AnimatePresence>
      {isOpen && activeSamsat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[3rem] w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl relative flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-900">{isAdmin ? 'Permintaan Perangkat' : 'STATUS PERMINTAAN PERANGKAT'}</h3>
                <p className="text-sm font-bold text-slate-500 mt-1">{activeSamsat}</p>
              </div>
              <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto flex-grow">
              {isAdmin && accountAccess.canEditRequests ? (
                <button
                  onClick={createNewRequestFromHub}
                  disabled={requestHistoryLoading}
                  className="w-full mb-6 bg-slate-900 hover:bg-slate-950 text-white py-4 rounded-2xl font-black transition-all disabled:bg-slate-200 disabled:text-slate-500"
                >
                  Tambah Permintaan Baru
                </button>
              ) : null}

              <div className="border border-slate-200 rounded-3xl overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-lg font-black text-slate-900">History Permintaan Perangkat</h4>
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
                    {requestHistoryItems.length}
                  </span>
                </div>
                {requestHistoryLoading ? (
                  <div className="p-4 text-sm font-bold text-slate-600">Memuat...</div>
                ) : requestHistoryItems.length === 0 ? (
                  <div className="p-4 text-sm font-bold text-slate-600">Belum ada permintaan.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {requestHistoryItems.map((r) => {
                      const totalRequested =
                        r.requestType === 'PC & PRINTER KESAMSATAN'
                          ? Math.max(0, Number(r.requestedCountPC || 0)) + Math.max(0, Number(r.requestedCountPrinter || 0))
                          : Math.max(0, Number(r.requestedCount || 0));
                      const inputDone = r.addedDeviceIds.length;
                      const inputOk = r.stockStatus === 'ready' && totalRequested > 0 && inputDone >= totalRequested;
                      return (
                        <div key={r.requestId || r.createdAt} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                          <button
                            onClick={() =>
                              isAdmin ? (accountAccess.canEditRequests ? openRequestEditor(r.requestId) : openRequestStatusModal(r.requestId)) : openRequestStatusModal(r.requestId)
                            }
                            className="text-left flex-grow min-w-0"
                          >
                            <p className="font-black text-slate-900 truncate">{r.requestType}</p>
                            <p className="text-xs font-bold text-slate-500 mt-1">
                              {new Date(r.createdAt).toLocaleString()} • {inputDone}/{totalRequested} perangkat
                            </p>
                            <p className="text-xs font-bold text-slate-500 mt-1">
                              Stok: {r.stockStatus === 'ready' ? 'Ready' : r.stockStatus === 'empty' ? 'Empty' : 'Standby'}
                              {' • '}
                              Disposisi: Kabid {r.kabid.status === 'approved' ? 'Setuju' : r.kabid.status === 'rejected' ? 'Tidak' : 'Proses'} • Sekban {r.sekban.status === 'approved' ? 'Setuju' : r.sekban.status === 'rejected' ? 'Tidak' : 'Proses'}
                            </p>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                                inputOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {inputOk ? 'Selesai' : 'Proses'}
                            </span>
                            {isAdmin && accountAccess.canEditRequests ? (
                              <>
                                <button
                                  onClick={() => openRequestEditor(r.requestId)}
                                  className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-black transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteRequestFromHub(r)}
                                  className="p-2 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors"
                                  aria-label="Hapus history"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
