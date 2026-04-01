# Proteksi Aplikasi & Endpoint dengan Cloudflare Access (Zero Trust)

Dokumen ini mengatur supaya aplikasi `inventaris-kesamsatan.pages.dev` dan endpoint API tidak bisa diakses publik (umum), hanya untuk user yang diizinkan.

Aplikasi sudah dipisah endpoint-nya berdasarkan role:

- `/api/public/*` untuk data read-only (dibaca user & admin)
- `/api/user/*` untuk submit oleh user (laporan kerusakan & permintaan perangkat)
- `/api/admin/*` untuk aksi admin (create/update/delete/import, pengelolaan inbox, dll)

## Target Hasil

- Membuka `https://inventaris-kesamsatan.pages.dev` dari mode incognito akan meminta login Cloudflare Access.
- Membuka `https://inventaris-kesamsatan.pages.dev/api/public/devices?limit=1` dari siapa pun yang tidak login akan ditolak.

## Langkah Konfigurasi (Cloudflare Dashboard)

Buat 4 aplikasi Access (Self-hosted), masing-masing dengan path berbeda.

1. Masuk ke Cloudflare Dashboard.
2. Buka **Zero Trust**.
3. Jika diminta, lakukan inisialisasi Zero Trust (set up) terlebih dahulu.
4. Masuk ke **Access → Applications**.

### 1) Aplikasi Web (UI)

- **Application name**: `Inventaris Kesamsatan (Web)`
- **Domain**: `inventaris-kesamsatan.pages.dev`
- **Path**: kosong
- **Policy**: Allow user + admin (emails/domain yang diizinkan)

### 2) API Public (read-only)

- **Application name**: `Inventaris Kesamsatan (API Public)`
- **Domain**: `inventaris-kesamsatan.pages.dev`
- **Path**: `/api/public/*`
- **Policy**: Allow user + admin

### 3) API User (submit laporan/permintaan)

- **Application name**: `Inventaris Kesamsatan (API User)`
- **Domain**: `inventaris-kesamsatan.pages.dev`
- **Path**: `/api/user/*`
- **Policy**: Allow user + admin

Ini dipakai untuk submit:

- POST `/api/user/inbox` (upload PDF dan input data laporan kerusakan & permintaan perangkat)

### 4) API Admin (aksi admin)

- **Application name**: `Inventaris Kesamsatan (API Admin)`
- **Domain**: `inventaris-kesamsatan.pages.dev`
- **Path**: `/api/admin/*`
- **Policy**: Allow admin saja

## Pilih Cara Login (Identity Provider)

1. Masuk ke **Access → Authentication**.
2. Tambahkan metode login:
   - Paling cepat: **One-time PIN** (email OTP)
   - Alternatif: Google Workspace / Microsoft Entra / GitHub, dll

## Testing

- Mode incognito:
  - Buka `https://inventaris-kesamsatan.pages.dev/` → harus diminta login Access.
  - Buka `https://inventaris-kesamsatan.pages.dev/api/public/devices?limit=1` → harus ditolak / diminta login.
  - Setelah login sebagai user:
    - Buka `https://inventaris-kesamsatan.pages.dev/api/public/devices?limit=1` → harus bisa.
    - Kirim laporan kerusakan/permintaan perangkat → harus bisa (POST `/api/user/inbox`).
  - Setelah login sebagai admin:
    - Aksi admin (import/tambah/edit/hapus) → harus bisa via `/api/admin/*`.

## Catatan Penting

- Jangan buat satu aplikasi Access untuk `/api/*` karena akan menyulitkan pemisahan role. Gunakan 3 path prefix: `/api/public/*`, `/api/user/*`, `/api/admin/*`.

## Alternatif Gratis Tanpa Cloudflare Access

Jika Zero Trust/Access tetap meminta metode pembayaran dan Anda tidak bisa menambahkannya, aplikasi tetap bisa membatasi endpoint admin dengan API Key di server.

### Cara pakai

1. Di Cloudflare Pages → **Settings → Environment variables**, tambahkan:
   - `ADMIN_API_KEY` = nilai rahasia (misalnya string random panjang)
2. Saat login sebagai admin di aplikasi, akan muncul prompt untuk mengisi **Admin API Key**.
3. Endpoint admin hanya bisa dipanggil jika request memiliki header:
   - `x-admin-key: <ADMIN_API_KEY>`

Catatan: alternatif ini hanya mengunci endpoint admin (`/api/admin/*`). Endpoint public/user tetap mengikuti rule akses yang Anda atur sendiri.
