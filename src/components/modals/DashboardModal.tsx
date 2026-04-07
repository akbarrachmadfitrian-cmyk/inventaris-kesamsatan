import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle } from 'lucide-react';
import { Device } from '../../types';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  activeSamsat: string | null;
  filteredDevices: Device[];
  handleDeviceCardClick: (device: Device) => void;
  normalizeCondition: (raw: string) => string;
}

export function DashboardModal({
  isOpen,
  onClose,
  title,
  activeSamsat,
  filteredDevices,
  handleDeviceCardClick,
  normalizeCondition
}: DashboardModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[3rem] w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl relative flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-900">{title}</h3>
                <p className="text-sm font-bold text-slate-500 mt-1">{activeSamsat}</p>
              </div>
              <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto flex-grow">
              {filteredDevices.length === 0 ? (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">
                  Tidak ada perangkat pada kategori ini.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-3xl overflow-hidden">
                  {filteredDevices.map((d) => (
                    <button
                      key={d.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClose();
                        handleDeviceCardClick(d);
                      }}
                      className="w-full text-left p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-black text-slate-900">{d.name}</p>
                        <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">{d.serialNumber}</p>
                        <p className="text-xs font-bold text-slate-500 mt-1">{d.serviceUnit}</p>
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
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
