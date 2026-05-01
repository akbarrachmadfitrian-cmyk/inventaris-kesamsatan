import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle } from 'lucide-react';

interface ManageLoginModalProps {
  isOpen: boolean;
  isAdmin: boolean;
  onClose: () => void;
  manageLoginForm: {
    targetUsername: string;
    newPassword: string;
    confirmPassword: string;
  };
  setManageLoginForm: React.Dispatch<React.SetStateAction<any>>;
  manageLoginError: string | null;
  manageLoginSuccess: string | null;
  saveManageLogin: () => void;
}

export function ManageLoginModal({
  isOpen,
  isAdmin,
  onClose,
  manageLoginForm,
  setManageLoginForm,
  manageLoginError,
  manageLoginSuccess,
  saveManageLogin
}: ManageLoginModalProps) {
  const SAMSAT_USERS = [
    'samsatbanjarmasin1', 'samsatbanjarmasin2', 'samsatbanjarbaru',
    'samsatmartapura', 'samsatpelaihari', 'samsatmarabahan',
    'samsatrantau', 'samsatkandangan', 'samsatbarabai',
    'samsatamuntai', 'samsattanjung', 'samsatparingin',
    'samsatbatulicin', 'samsatkotabaru'
  ];

  const ADMIN_USERS = [
    'admin', 'user', 'admininfra', 'adminagung',
    'adminfajrin', 'adminakbar', 'adminkurnia'
  ];

  return (
    <AnimatePresence>
      {isOpen && isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl relative"
          >
            <button onClick={onClose} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl z-20">
              <XCircle className="w-6 h-6 text-slate-400" />
            </button>

            <div className="p-8 md:p-10">
              <div className="mb-7">
                <h3 className="text-xl font-black text-slate-900">Manajemen Login (Database)</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">Hanya dapat diakses oleh Super Admin.</p>
              </div>

              <div className="space-y-5">
                <div className="border border-slate-100 rounded-3xl p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Akun</p>
                  <p className="text-xs font-black text-slate-900 mt-1">Tentukan akun yang akan diubah passwordnya</p>
                  <div className="mt-4">
                    <select
                      value={manageLoginForm.targetUsername}
                      onChange={(e) => setManageLoginForm((prev: any) => ({ ...prev, targetUsername: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Pilih Username...</option>
                      <optgroup label="Superadmin & Admin Regional">
                        {ADMIN_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                      </optgroup>
                      <optgroup label="14 SAMSAT Kalsel">
                        {SAMSAT_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-3xl p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubah Password</p>
                  <p className="text-xs font-black text-slate-900 mt-1">Masukkan password baru</p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="password"
                      value={manageLoginForm.newPassword}
                      onChange={(e) => setManageLoginForm((prev: any) => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Password baru"
                    />
                    <input
                      type="password"
                      value={manageLoginForm.confirmPassword}
                      onChange={(e) => setManageLoginForm((prev: any) => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Konfirmasi password baru"
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
                    disabled={!manageLoginForm.targetUsername}
                    className="flex-grow bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-blue-200"
                  >
                    Update Password di Database
                  </button>
                  <button
                    onClick={onClose}
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
  );
}