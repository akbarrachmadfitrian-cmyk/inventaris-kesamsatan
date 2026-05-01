import { useEffect, useRef } from 'react';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 menit

/**
 * Hook untuk auto-logout jika user tidak aktif (idle) selama 30 menit.
 * 
 * @param isActive Boolean yang menentukan apakah timer harus berjalan (misal: user sedang login)
 * @param onLogout Fungsi yang akan dipanggil ketika timeout tercapai
 */
export function useAutoLogout(isActive: boolean, onLogout: () => void) {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Jika user belum login, jangan jalankan timer
    if (!isActive) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      return;
    }

    const resetTimer = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        onLogout();
      }, TIMEOUT_MS) as unknown as number;
    };

    // Mulai timer pertama kali
    resetTimer();

    // Daftar event yang menandakan user sedang aktif
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Throttle sedikit agar tidak terlalu sering memanggil resetTimer (opsional tapi bagus untuk performa)
    let isThrottled = false;
    const handleActivity = () => {
      if (isThrottled) return;
      isThrottled = true;
      resetTimer();
      setTimeout(() => {
        isThrottled = false;
      }, 1000); // batasi deteksi maksimal 1 kali per detik
    };

    // Pasang event listener ke seluruh window
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup saat komponen unmount atau status login berubah
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isActive, onLogout]);
}
