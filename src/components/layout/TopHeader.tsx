import React from 'react';

interface TopHeaderProps {
  viewMode: 'selection' | 'dashboard' | 'devices' | 'scan-qr';
  activeSamsat: string | null;
}

export function TopHeader({ viewMode, activeSamsat }: TopHeaderProps) {
  return (
    <header className="p-4 sm:p-8 pb-3 sm:pb-4">
      <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">
        {viewMode === 'selection' ? 'Daftar Kantor Samsat' : viewMode === 'scan-qr' ? 'Scan QR' : 'Dashboard'}
      </h2>
      <p className="text-xs sm:text-sm text-slate-500 font-medium">
        {viewMode === 'selection' ? 'Pilih kantor untuk melihat data inventaris' : viewMode === 'scan-qr' ? 'Pindai QR code untuk melihat detail perangkat' : `Ringkasan inventaris — ${activeSamsat}`}
      </p>
    </header>
  );
}
