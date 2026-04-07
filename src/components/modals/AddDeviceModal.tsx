import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, Plus } from 'lucide-react';
import { Device } from '../../types';

interface AddDeviceModalProps {
  isOpen: boolean;
  isAdmin: boolean;
  strictSheetSync: boolean;
  activeSamsat: string | null;
  onClose: () => void;
  newDeviceDraft: Partial<Device>;
  setNewDeviceDraft: React.Dispatch<React.SetStateAction<Partial<Device>>>;
  addRequestedDevice: () => void;
}

export function AddDeviceModal({
  isOpen,
  isAdmin,
  strictSheetSync,
  activeSamsat,
  onClose,
  newDeviceDraft,
  setNewDeviceDraft,
  addRequestedDevice
}: AddDeviceModalProps) {
  if (!isOpen || !isAdmin || strictSheetSync || !activeSamsat) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[3rem] w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl relative">
        <button onClick={onClose} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl z-20">
          <XCircle className="w-6 h-6 text-slate-400" />
        </button>
        <div className="p-6 md:p-10 overflow-y-auto max-h-[calc(100vh-2rem)]">
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-900">Tambah Perangkat — {activeSamsat}</h3>
            <p className="text-xs text-slate-500 font-bold mt-1">Menu ini berdiri sendiri dan tidak terhubung ke proses permintaan perangkat.</p>
          </div>
          <div className="border border-slate-100 rounded-3xl p-5">
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Tahun Anggaran</label>
                <input
                  type="text"
                  value={String(newDeviceDraft.budgetYear || '')}
                  onChange={(e) => setNewDeviceDraft(prev => ({ ...prev, budgetYear: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
                  placeholder="Contoh: 2026"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Sumber Anggaran</label>
                <select
                  value={String(newDeviceDraft.budgetSource || 'APBD')}
                  onChange={(e) => setNewDeviceDraft(prev => ({ ...prev, budgetSource: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
                >
                  <option value="APBD">APBD</option>
                  <option value="Cost Sharing">Cost Sharing</option>
                  <option value="Hibah Bank Kalsel">Hibah Bank Kalsel</option>
                </select>
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
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Tambah Perangkat
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
