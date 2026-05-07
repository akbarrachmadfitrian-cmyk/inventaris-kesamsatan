import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Table, ChevronDown, Loader2 } from 'lucide-react';

interface ExportDropdownProps {
  /** Export current samsat to PDF */
  onExportPdf: () => Promise<void>;
  /** Export current samsat to Excel */
  onExportExcel: () => Promise<void>;
  /** Export ALL samsat to PDF (superadmin / admin_infra only) */
  onExportAllPdf?: () => Promise<void>;
  /** Export ALL samsat to Excel (superadmin / admin_infra only) */
  onExportAllExcel?: () => Promise<void>;
  /** Whether the "all samsat" options should be shown */
  showAllSamsatOptions?: boolean;
}

export function ExportDropdown({
  onExportPdf,
  onExportExcel,
  onExportAllPdf,
  onExportAllExcel,
  showAllSamsatOptions = false,
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleAction = async (fn: () => Promise<void>) => {
    setIsExporting(true);
    setIsOpen(false);
    try {
      await fn();
    } catch (err) {
      console.error('Export failed:', err);
      window.alert('Gagal mengekspor data. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-bold text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        ) : (
          <Download className="w-4 h-4 text-slate-500" />
        )}
        <span className="hidden sm:inline">{isExporting ? 'Mengekspor...' : 'Ekspor'}</span>
        {!isExporting && <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50"
          >
            {/* Per-samsat section */}
            <div className="p-2">
              <p className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Samsat Aktif</p>
              <button
                onClick={() => handleAction(onExportPdf)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-left group"
              >
                <div className="w-8 h-8 bg-red-50 group-hover:bg-red-100 rounded-lg flex items-center justify-center transition-colors">
                  <FileText className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Ekspor PDF</p>
                  <p className="text-[10px] text-slate-400 font-medium">Laporan format PDF</p>
                </div>
              </button>
              <button
                onClick={() => handleAction(onExportExcel)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors text-left group"
              >
                <div className="w-8 h-8 bg-emerald-50 group-hover:bg-emerald-100 rounded-lg flex items-center justify-center transition-colors">
                  <Table className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Ekspor Excel</p>
                  <p className="text-[10px] text-slate-400 font-medium">Laporan format XLSX</p>
                </div>
              </button>
            </div>

            {/* All samsat section */}
            {showAllSamsatOptions && onExportAllPdf && onExportAllExcel && (
              <>
                <div className="border-t border-slate-100" />
                <div className="p-2">
                  <p className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seluruh Samsat</p>
                  <button
                    onClick={() => handleAction(onExportAllPdf)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-left group"
                  >
                    <div className="w-8 h-8 bg-red-50 group-hover:bg-red-100 rounded-lg flex items-center justify-center transition-colors">
                      <FileText className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">PDF Semua Samsat</p>
                      <p className="text-[10px] text-slate-400 font-medium">Gabungan seluruh kantor</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleAction(onExportAllExcel)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors text-left group"
                  >
                    <div className="w-8 h-8 bg-emerald-50 group-hover:bg-emerald-100 rounded-lg flex items-center justify-center transition-colors">
                      <Table className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Excel Semua Samsat</p>
                      <p className="text-[10px] text-slate-400 font-medium">Gabungan seluruh kantor</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
