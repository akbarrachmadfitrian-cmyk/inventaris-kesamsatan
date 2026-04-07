import { 
  Building2, ChevronDown, Layers, Inbox, LayoutDashboard, Monitor, 
  Send, Truck, QrCode, Plus, KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthSession, AccountAccess } from '../../types';

interface SidebarProps {
  isAdmin: boolean;
  accountAccess: AccountAccess;
  session: AuthSession | null;
  logout: () => void;
  activeSamsat: string | null;
  setActiveSamsat: (samsat: string | null) => void;
  showSamsatDropdown: boolean;
  setShowSamsatDropdown: (show: boolean) => void;
  visibleSamsatList: string[];
  viewMode: 'selection' | 'dashboard' | 'devices' | 'scan-qr';
  setViewMode: (mode: 'selection' | 'dashboard' | 'devices' | 'scan-qr') => void;
  openInbox: () => void;
  unreadInboxCount: number;
  openRequestHubModal: () => void;
  requestStatusLoading: boolean;
  strictSheetSync: boolean;
  openAddDeviceModal: () => void;
  setIsManageLoginOpen: (show: boolean) => void;
  setManageLoginError: (err: string | null) => void;
  setManageLoginSuccess: (succ: string | null) => void;
  setIsDamageReportOpen: (show: boolean) => void;
  setDamageSuccess: (succ: string | null) => void;
  setIsDeviceRequestOpen: (show: boolean) => void;
  setDeviceRequestSuccess: (succ: string | null) => void;
}

export function Sidebar({
  isAdmin,
  accountAccess,
  logout,
  activeSamsat,
  setActiveSamsat,
  showSamsatDropdown,
  setShowSamsatDropdown,
  visibleSamsatList,
  viewMode,
  setViewMode,
  openInbox,
  unreadInboxCount,
  openRequestHubModal,
  requestStatusLoading,
  strictSheetSync,
  openAddDeviceModal,
  setIsManageLoginOpen,
  setManageLoginError,
  setManageLoginSuccess,
  setIsDamageReportOpen,
  setDamageSuccess,
  setIsDeviceRequestOpen,
  setDeviceRequestSuccess
}: SidebarProps) {
  return (
    <aside className="w-full lg:w-72 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col z-40 shrink-0">
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

      {activeSamsat && accountAccess.canSelectSamsat && (
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
                  {visibleSamsatList.map(s => (
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
            {isAdmin ? (
              <button
                onClick={openRequestHubModal}
                className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all text-slate-500 hover:bg-slate-50"
              >
                <Send className="w-5 h-5" />
                <span>Permintaan Perangkat</span>
              </button>
            ) : (
              <button
                onClick={openRequestHubModal}
                disabled={requestStatusLoading}
                className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <Truck className="w-5 h-5" />
                <span>STATUS PERMINTAAN PERANGKAT</span>
              </button>
            )}
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
            {isAdmin && accountAccess.canAddDevice && !strictSheetSync && (
              <button
                onClick={openAddDeviceModal}
                className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all text-slate-500 hover:bg-slate-50"
              >
                <Plus className="w-5 h-5" />
                <span>Tambah Perangkat</span>
              </button>
            )}
            {isAdmin && accountAccess.canManageLogin && (
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
  );
}
