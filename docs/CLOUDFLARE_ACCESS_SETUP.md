# Proteksi Aplikasi & Endpoint dengan Cloudflare Access (Zero Trust)

Dokumen ini mengatur supaya `inventaris-kesamsatan.pages.dev` dan endpoint `/api/*` tidak bisa diakses publik (umum), hanya untuk user yang diizinkan.

## Target Hasil

- Membuka `https://inventaris-kesamsatan.pages.dev` dari mode incognito akan meminta login Cloudflare Access.
- Membuka `https://inventaris-kesamsatan.pages.dev/api/devices?limit=1` dari siapa pun yang tidak login akan ditolak.

## Langkah Konfigurasi (Cloudflare Dashboard)

1. Masuk ke Cloudflare Dashboard.
2. Buka **Zero Trust**.
3. Jika diminta, lakukan inisialisasi Zero Trust (set up) terlebih dahulu.
4. Masuk ke **Access → Applications**.
5. Klik **Add an application**.
6. Pilih **Self-hosted**.
7. Isi:
   - **Application name**: `Inventaris Kesamsatan`
   - **Session duration**: misalnya `8h` atau sesuai kebutuhan
8. Pada **Application domain**:
   - **Domain**: `inventaris-kesamsatan.pages.dev`
   - **Path**: kosong (untuk proteksi seluruh aplikasi) atau isi `/api/*` jika hanya mau proteksi endpoint
9. Klik **Next**.
10. Buat **Policy**:
    - **Policy name**: `Allow Staff`
    - **Action**: `Allow`
    - **Include**:
      - Opsi paling mudah: `Emails` (masukkan daftar email yang diizinkan)
      - Alternatif: `Email domain` jika punya domain instansi
    - (Opsional) Tambahkan **Require**: `Multi-factor authentication` jika diperlukan
11. Klik **Next → Add application**.

## Pilih Cara Login (Identity Provider)

1. Masuk ke **Access → Authentication**.
2. Tambahkan metode login:
   - Paling cepat: **One-time PIN** (email OTP)
   - Alternatif: Google Workspace / Microsoft Entra / GitHub, dll

## Testing

- Mode incognito:
  - Buka `https://inventaris-kesamsatan.pages.dev/` → harus diminta login Access.
  - Buka `https://inventaris-kesamsatan.pages.dev/api/devices?limit=1` → harus ditolak / diminta login.

## Catatan Penting

- Jika Anda hanya memproteksi `/api/*`, maka UI juga harus melewati login Access agar panggilan API dari browser user tidak gagal.
- Jika Anda memproteksi seluruh domain, aplikasi dan endpoint otomatis ikut aman.
