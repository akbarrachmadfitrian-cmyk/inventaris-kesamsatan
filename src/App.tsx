import { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { 
  Camera, Upload, CheckCircle2, QrCode, Search, RefreshCw,
  Monitor, Printer, LayoutDashboard, ChevronRight,
  Building2, Layers, XCircle, AlertTriangle,
  ChevronDown, List, MoreVertical
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

const generateMockData = (): Device[] => {
  const samsats = ["SAMSAT Banjarmasin I", "SAMSAT Banjarmasin II", "SAMSAT Banjarbaru", "SAMSAT Martapura"];
  const services = ["KASIR", "PELAYANAN INDUK", "DRIVE THRU", "SAMSAT KELILING"];
  const names = ["PC LENOVO", "PRINTER HP", "SCANNER CANON", "UPS APC"];
  const staff = ["POPY", "SOPHIE", "DEA", "AHMAD", "BUDI"];

  const mock: Device[] = [];
  samsats.forEach(s => {
    services.forEach(serv => {
      const count = 5;
      for (let i = 0; i < count; i++) {
        const name = names[Math.floor(Math.random() * names.length)];
        mock.push({
          id: `MOCK-${s.replace(/\s+/g, '-')}-${serv}-${i}`,
          name: name,
          category: name.split(' ')[0],
          location: serv,
          subLocation: staff[Math.floor(Math.random() * staff.length)],
          serialNumber: `SN-MOCK-${Math.random().toString(36).toUpperCase().slice(2, 6)}`,
          phoneNumber: Math.random() > 0.25 ? `08${Math.floor(100000000 + Math.random() * 900000000)}` : '???',
          condition: Math.random() > 0.8 ? "Kurang Baik" : "Baik",
          isComplete: false,
          dataComplete: Math.random() > 0.3,
          samsat: s,
          serviceUnit: serv,
          sheetName: "Mock Data"
        });
      }
    });
  });
  return mock;
};

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Device>>({});
  
  // Dashboard Navigation State
  const [viewMode, setViewMode] = useState<'selection' | 'dashboard' | 'devices'>('selection');
  const [activeSamsat, setActiveSamsat] = useState<string | null>(null);
  const [showSamsatDropdown, setShowSamsatDropdown] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sheets = [
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

      const baseUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRqd9Fuc8MRfwWgzB5TJ-8trqSCerRy5-mbzhy-wJo_faoLLe9JItOxyKXBJ2A9l8MpFoswgpTxfxN1/pub?output=csv&gid=';
      
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
        const savedPhotos = JSON.parse(localStorage.getItem('samsat_device_photos') || '{}');
        const updatedDevices = JSON.parse(localStorage.getItem('samsat_updated_devices') || '{}');
        
        const finalDevices = allFetchedDevices.map(d => {
          // Terapkan update dari local storage jika ada
          const localUpdate = updatedDevices[d.id];
          const baseDevice = localUpdate ? { ...d, ...localUpdate } : d;
          
          return {
            ...baseDevice,
            photo: savedPhotos[d.id] || baseDevice.photo,
            isComplete: !!(savedPhotos[d.id] || baseDevice.photo)
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
    // Muat mock data segera agar UI tidak kosong
    setDevices(generateMockData());
    // Kemudian coba ambil data asli
    fetchData();
  }, [fetchData]);

  const handlePhotoUpload = (deviceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-40 shrink-0">
        <div className="p-6 flex flex-col items-center gap-3 border-b border-slate-50">
          <img
            src="https://bapenda.kalselprov.go.id/wp-content/uploads/2025/08/Logo-Sayembara-Bapenda.png?v=20250823"
            alt="Bapenda Kalimantan Selatan"
            referrerPolicy="no-referrer"
            className="h-12 w-auto object-contain"
          />
          <div className="text-center">
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Inventaris Kesamsatan</h1>
            <p className="text-[10px] text-slate-500 font-medium">BAPENDA PROV KALSEL</p>
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
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto">
        <header className="p-8 pb-4">
          <h2 className="text-2xl font-black text-slate-900 mb-1">
            {viewMode === 'selection' ? 'Daftar Kantor Samsat' : 'Dashboard'}
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            {viewMode === 'selection' ? 'Pilih kantor untuk melihat data inventaris' : `Ringkasan inventaris — ${activeSamsat}`}
          </p>
        </header>

        <div className="p-8 space-y-8">
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
                      className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group text-center"
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
          ) : viewMode === 'dashboard' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { label: 'Total Perangkat', value: stats.total, icon: <Monitor className="w-6 h-6" />, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Kondisi Baik', value: stats.baik, icon: <CheckCircle2 className="w-6 h-6" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Kurang Baik', value: stats.kurangBaik, icon: <AlertTriangle className="w-6 h-6" />, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Rusak / Tidak Baik', value: stats.rusak, icon: <XCircle className="w-6 h-6" />, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Jenis Layanan', value: stats.layanan, icon: <Layers className="w-6 h-6" />, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map((stat, i) => (
                  <motion.div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-start gap-4">
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
                      <MoreVertical className="w-5 h-5 text-slate-300" />
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
                  <label className="absolute bottom-8 left-8 right-8 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl cursor-pointer flex items-center justify-center gap-3 font-bold transition-all">
                    <Upload className="w-5 h-5" />
                    <span>Upload Foto</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(selectedDevice.id, e)} />
                  </label>
                </div>
                <div className="w-full lg:w-1/2 p-12 overflow-y-auto max-h-[80vh]">
                  <div className="mb-8">
                    <h3 className="text-3xl font-black text-slate-900 text-center">
                      {isEditing ? 'Edit Perangkat' : selectedDevice.name}
                    </h3>
                    {!isEditing && (
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
                      {selectedDevice.isComplete ? (
                        <div className="bg-slate-50 p-8 rounded-[2.5rem] flex flex-col items-center border border-slate-100">
                          <div className="bg-white p-4 rounded-3xl shadow-sm mb-6">
                            <QRCodeSVG value={JSON.stringify({ id: selectedDevice.id, sn: selectedDevice.serialNumber })} size={140} level="H" />
                          </div>
                          <button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3">
                            <Printer className="w-5 h-5" /> Cetak Label QR
                          </button>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center">
                          <QrCode className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                          <p className="text-xs text-slate-400 font-bold">Lengkapi foto untuk QR</p>
                        </div>
                      )}
                    </>
                  )}
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
