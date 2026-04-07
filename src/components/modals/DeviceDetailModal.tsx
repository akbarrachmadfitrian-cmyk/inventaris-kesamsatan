import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Camera, Upload, AlertTriangle, XCircle, Printer, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ImageWithPlaceholder } from '../ImageWithPlaceholder';
import { Device } from '../../types';

interface DeviceDetailModalProps {
  selectedDevice: Device | null;
  handleCloseDeviceModal: (e?: { preventDefault: () => void; stopPropagation: () => void; target?: any; currentTarget?: any }) => void;
  showPhoto: boolean;
  setShowPhoto: (show: boolean) => void;
  modalImageUrl: string | null;
  modalImageTooLarge: boolean;
  isAdmin: boolean;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  handlePhotoUpload: (deviceId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePhotoDelete: (deviceId: string) => void;
  strictSheetSync: boolean;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<Device>>>;
  editForm: Partial<Device>;
  handleDeviceSave: () => Promise<void>;
  loading: boolean;
  handleDeviceDelete: (device: Device) => Promise<void>;
  normalizeCondition: (raw: string) => string;
}

export function DeviceDetailModal({
  selectedDevice,
  handleCloseDeviceModal,
  showPhoto,
  setShowPhoto,
  modalImageUrl,
  modalImageTooLarge,
  isAdmin,
  isEditing,
  setIsEditing,
  handlePhotoUpload,
  handlePhotoDelete,
  strictSheetSync,
  setEditForm,
  editForm,
  handleDeviceSave,
  loading,
  handleDeviceDelete,
  normalizeCondition
}: DeviceDetailModalProps) {
  // ESC key listener — global document level, paling reliable
  useEffect(() => {
    if (!selectedDevice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCloseDeviceModal();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [selectedDevice, handleCloseDeviceModal]);

  if (typeof document === 'undefined' || !selectedDevice) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop — klik untuk tutup */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => handleCloseDeviceModal()}
      />

      {/* Modal centered */}
      <div className="absolute inset-0 flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[3rem] w-full max-w-4xl overflow-hidden shadow-2xl relative"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tombol X — di dalam card, selalu di atas semua konten */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCloseDeviceModal();
            }}
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-2xl z-[100] cursor-pointer transition-colors"
            aria-label="Tutup"
          >
            <XCircle className="w-6 h-6 text-slate-500" />
          </button>

          <div className="flex flex-col lg:flex-row">
            <div className="w-full lg:w-1/2 bg-slate-50 relative min-h-[400px]">
              {(() => {
                const hasPhoto = Boolean(selectedDevice.photoR2Key || selectedDevice.photo);

                if (!showPhoto) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-12">
                      <Camera className="w-20 h-20 mb-6 opacity-20" />
                      <p className="text-sm font-bold">Foto disembunyikan untuk performa</p>
                      {hasPhoto ? (
                        <button
                          onClick={() => setShowPhoto(true)}
                          className="mt-6 px-6 py-3 bg-slate-900 hover:bg-slate-950 text-white rounded-2xl font-black transition-all"
                        >
                          Lihat Foto
                        </button>
                      ) : (
                        <p className="text-sm font-bold mt-6 text-slate-300">Belum Ada Foto</p>
                      )}
                    </div>
                  );
                }

                if (modalImageUrl) return <ImageWithPlaceholder src={modalImageUrl} alt={selectedDevice.name} />;
                if (modalImageTooLarge) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center text-rose-500 p-12">
                      <AlertTriangle className="w-20 h-20 mb-6 opacity-40" />
                      <p className="text-sm font-black">Foto Terlalu Besar</p>
                    </div>
                  );
                }
                if (hasPhoto) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-12">
                      <div className="relative mb-6">
                        <Camera className="w-16 h-16 opacity-20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-20 h-20 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                      </div>
                      <p className="text-sm font-black text-slate-500">Memuat Foto...</p>
                      <p className="text-xs font-bold text-slate-400 mt-1">Mengunduh dari database</p>
                    </div>
                  );
                }
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 p-12">
                    <Camera className="w-20 h-20 mb-6 opacity-20" />
                    <p className="text-sm font-bold">Belum Ada Foto</p>
                  </div>
                );
              })()}

              {isAdmin && isEditing && (
                <div className="absolute bottom-8 left-8 right-8 flex gap-3">
                  <label className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl cursor-pointer flex items-center justify-center gap-3 font-bold transition-all">
                    <Upload className="w-5 h-5" />
                    <span>Upload Foto</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(selectedDevice.id, e)} />
                  </label>
                  {(selectedDevice.photo || selectedDevice.photoR2Key) && (
                    <button
                      onClick={() => handlePhotoDelete(selectedDevice.id)}
                      className="px-5 bg-white border border-slate-200 hover:bg-rose-50 text-rose-600 py-4 rounded-2xl font-black transition-all"
                    >
                      Hapus
                    </button>
                  )}
                </div>
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
                        setEditForm({
                          ...selectedDevice,
                          condition: normalizeCondition(selectedDevice.condition),
                          budgetSource: selectedDevice.budgetSource || 'APBD'
                        });
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
                      onChange={(e) => setEditForm(prev => ({...prev, name: e.target.value}))}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">User/Pemegang</label>
                      <input 
                        type="text" 
                        value={editForm.subLocation || ''} 
                        onChange={(e) => setEditForm(prev => ({...prev, subLocation: e.target.value}))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">No HP User</label>
                      <input 
                        type="text" 
                        value={editForm.phoneNumber || ''} 
                        onChange={(e) => setEditForm(prev => ({...prev, phoneNumber: e.target.value}))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Serial Number</label>
                    <input 
                      type="text" 
                      value={editForm.serialNumber || ''} 
                      onChange={(e) => setEditForm(prev => ({...prev, serialNumber: e.target.value}))}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Tahun Anggaran</label>
                      <input 
                        type="text" 
                        value={editForm.budgetYear || ''} 
                        onChange={(e) => setEditForm(prev => ({...prev, budgetYear: e.target.value}))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Sumber Anggaran</label>
                      <select
                        value={editForm.budgetSource || 'APBD'}
                        onChange={(e) => setEditForm(prev => ({...prev, budgetSource: e.target.value}))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
                      >
                        <option value="APBD">APBD</option>
                        <option value="KORLANTAS / APBN">KORLANTAS / APBN</option>
                        <option value="HIBAH">HIBAH</option>
                        <option value="JASA RAHARJA">JASA RAHARJA</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Kondisi</label>
                    <select
                      value={editForm.condition || 'Baik'}
                      onChange={(e) => setEditForm(prev => ({...prev, condition: e.target.value}))}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
                    >
                      <option value="Baik">Baik</option>
                      <option value="Kurang Baik">Kurang Baik</option>
                      <option value="Rusak">Rusak</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Riwayat Servis</label>
                    <textarea 
                      value={editForm.serviceHistory || ''} 
                      onChange={(e) => setEditForm(prev => ({...prev, serviceHistory: e.target.value}))}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none min-h-[100px] resize-y"
                      placeholder="Catatan servis, contoh: 12/03/2026 - Ganti RAM"
                    />
                  </div>
                  <div className="pt-6 border-t border-slate-100 flex gap-3">
                    <button
                      onClick={handleDeviceSave}
                      disabled={loading}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" /> SIMPAN PERUBAHAN
                    </button>
                    {!selectedDevice.id.startsWith('dev-') && (
                      <button
                        onClick={() => handleDeviceDelete(selectedDevice)}
                        disabled={loading}
                        className="px-6 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-black transition-all flex hidden items-center justify-center"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-y-8 gap-x-6 mb-8">
                    <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Serial Number</p><p className="text-slate-900 font-bold">{selectedDevice.serialNumber || '-'}</p></div>
                    <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Kategori</p><p className="text-slate-900 font-bold">{selectedDevice.category}</p></div>
                    <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Jenis Layanan</p><p className="text-slate-900">{selectedDevice.serviceUnit}</p></div>
                    <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">No HP User</p><p className="text-slate-900">{selectedDevice.phoneNumber || '-'}</p></div>
                    <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Pemegang</p><p className="text-slate-900">{selectedDevice.subLocation || '-'}</p></div>
                    <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Samsat</p><p className="text-slate-900">{selectedDevice.samsat}</p></div>
                    <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Sumber Data</p><p className="text-slate-900">{selectedDevice.sheetName || '-'}</p></div>
                    <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Tahun Anggaran</p><p className="text-slate-900">{selectedDevice.budgetYear || '-'}</p></div>
                    <div><p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Sumber Anggaran</p><p className="text-slate-900">{selectedDevice.budgetSource || '-'}</p></div>
                    <div>
                      <p className="text-slate-400 uppercase text-[10px] tracking-widest mb-1">Kondisi</p>
                      <p className={normalizeCondition(selectedDevice.condition) === 'Baik' ? 'text-emerald-600 font-bold' : normalizeCondition(selectedDevice.condition) === 'Kurang Baik' ? 'text-amber-700 font-bold' : 'text-rose-600 font-bold'}>
                        {normalizeCondition(selectedDevice.condition)}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5 mb-8">
                    <p className="text-slate-400 uppercase text-[10px] tracking-widest mb-2 font-black">Riwayat Servis</p>
                    <p className="text-sm font-bold text-slate-900 whitespace-pre-wrap">{selectedDevice.serviceHistory || '-'}</p>
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
    </div>,
    document.body
  );
}
