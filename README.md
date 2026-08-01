# Kapan Lari

Aplikasi web untuk mencari **jam lari terbaik hari ini** di Indonesia: tidak bentrok waktu sholat, dan menghindari cuaca yang kurang aman.

Tanpa backend. Data cuaca dan pencarian kota dari [Open-Meteo](https://open-meteo.com/), jadwal sholat dari [Aladhan](https://aladhan.com/) (metode Kemenag).

---

## Daftar isi

1. [Tentang aplikasi](#tentang-aplikasi)
2. [Cara pemasangan](#cara-pemasangan)
3. [Perintah yang tersedia](#perintah-yang-tersedia)
4. [Cara memakai aplikasi](#cara-memakai-aplikasi)
5. [User story, success case, dan edge case](#user-story-success-case-dan-edge-case)
6. [Aturan rekomendasi slot](#aturan-rekomendasi-slot)
7. [Struktur proyek](#struktur-proyek)
8. [Pengujian](#pengujian)
9. [Deploy](#deploy)
10. [Batasan & catatan](#batasan--catatan)

---

## Tentang aplikasi

**Kapan Lari** menampilkan hingga 5 slot lari (masing-masing 1 jam) untuk hari ini, diurutkan dari yang paling cocok. Slot terbaik ditandai **Terbaik**.

Untuk setiap lokasi, aplikasi juga menampilkan:

- Jadwal sholat (Subuh, Zuhur, Ashar, Maghrib, Isya)
- Ringkasan cuaca hari ini (suhu min/maks, peluang hujan tertinggi, kondisi)
- Grafik peluang hujan per jam (05:00–21:00)

Tema visual: **lime green**, teks dan tombol besar agar mudah dibaca. Mendukung mode terang dan gelap.

**Stack:**

| Bagian | Teknologi |
| --- | --- |
| Frontend | Astro + TypeScript |
| Styling | Vanilla CSS |
| Backend | Tidak ada (static + API publik dari browser) |
| Testing | Vitest |
| Node | ≥ 22.12.0 |

---

## Cara pemasangan

### Prasyarat

- [Node.js](https://nodejs.org/) versi **22.12.0** atau lebih baru
- npm (biasanya ikut terpasang bersama Node.js)
- Koneksi internet (untuk cuaca, sholat, dan pencarian kota)

### Langkah instalasi

```sh
# 1. Masuk ke folder proyek
cd kapan-lari

# 2. Pasang dependensi
npm install

# 3. Jalankan server pengembangan
npm run dev
```

Buka browser di alamat yang ditampilkan terminal (umumnya `http://localhost:4321`).

Jika memakai alur Astro background di lingkungan agen:

```sh
astro dev --background
astro dev status
astro dev logs
astro dev stop
```

### Build produksi (opsional)

```sh
npm run build
npm run preview
```

Hasil build ada di folder `dist/`.

---

## Perintah yang tersedia

| Perintah | Fungsi |
| --- | --- |
| `npm install` | Memasang dependensi |
| `npm run dev` | Menjalankan server pengembangan |
| `npm run build` | Membangun situs produksi ke `./dist/` |
| `npm run preview` | Pratinjau hasil build secara lokal |
| `npm test` | Menjalankan seluruh tes (Vitest, sekali jalan) |
| `npm run test:watch` | Menjalankan tes dalam mode watch |
| `npm run astro ...` | Menjalankan perintah CLI Astro |

---

## Cara memakai aplikasi

1. Buka aplikasi → lokasi awal adalah **Jakarta**.
2. (Opsional) tekan **Pakai lokasi saya**, atau ketik nama kota/kabupaten (minimal 2 huruf) lalu pilih dari daftar.
3. Tunggu pemuatan data → lihat daftar **Slot lari hari ini**.
4. Baca detail slot: jam, suhu, peluang hujan, sholat terdekat, dan alasan.
5. (Opsional) lihat jadwal sholat dan grafik hujan di bagian bawah.
6. (Opsional) ganti mode terang/gelap lewat tombol di pojok atas.

Lokasi sesi **tidak** disimpan ke `localStorage`. Setiap kali halaman dimuat ulang, lokasi kembali ke Jakarta (kecuali kamu memilih lagi). Preferensi tema **disimpan** di `localStorage`.

---

## User story, success case, dan edge case

### US-1 — Melihat rekomendasi slot lari untuk lokasi default

**Sebagai** pengguna yang baru membuka aplikasi,  
**saya ingin** langsung melihat rekomendasi jam lari,  
**agar** saya tidak perlu mengatur lokasi dulu.

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Halaman memuat data untuk Jakarta. Muncul daftar slot (maks. 5), diurutkan dari skor tertinggi. Slot pertama berlabel **Terbaik**. Setiap slot menampilkan rentang jam, suhu, % hujan, sholat terdekat, dan alasan. Jadwal sholat dan ringkasan cuaca ikut terisi. |
| **Edge case — sedang memuat** | Tampil skeleton + pesan: *“Sedang mencari slot lari terbaik untuk lokasimu…”*. Daftar slot disembunyikan. |
| **Edge case — API gagal** | Tampil pesan error: *“Data belum bisa dimuat. Periksa koneksi internet, lalu coba lagi.”* Tombol **Coba lagi** muncul. Jadwal sholat/cuaca tetap placeholder (`—`). |
| **Edge case — tidak ada slot aman** | Daftar slot kosong; muncul pesan empty state sesuai penyebab dominan (lihat [US-7](#us-7--memahami-ketika-tidak-ada-slot-aman)). Grafik hujan tetap bisa ditampilkan jika data cuaca berhasil. |
| **Edge case — tidak auto-prompt GPS** | Saat first load, browser **tidak** diminta izin lokasi otomatis. |

---

### US-2 — Membaca detail setiap slot rekomendasi

**Sebagai** pelari,  
**saya ingin** melihat alasan dan kondisi tiap slot,  
**agar** saya bisa memilih jam yang cocok.

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Setiap slot menampilkan: rentang waktu lokal (format `id-ID`), suhu (`°C`), peluang hujan (`%`), sholat terdekat (mis. `Zuhur (45 mnt)`), dan alasan (mis. *Tidak berdekatan dengan waktu sholat · Peluang hujan rendah · …*). Hanya slot teratas yang punya badge **Terbaik**. |
| **Edge case — suhu di luar zona nyaman** | Slot tetap bisa muncul jika lolos filter keamanan, tetapi alasan *“Suhu nyaman untuk lari”* tidak ditambahkan (nyaman = 22–30°C). Skor suhu lebih rendah. |
| **Edge case — hujan rendah tapi bukan “nyaman”** | Alasan hujan rendah tetap ada jika peluang hujan `< 50%`. |

---

### US-3 — Memakai lokasi perangkat (geolocation)

**Sebagai** pengguna di lapangan,  
**saya ingin** memakai koordinat perangkat saya,  
**agar** rekomendasi sesuai tempat saya berada.

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Setelah izin diberikan, label lokasi menjadi **Lokasi saat ini**, data cuaca + sholat + slot dimuat ulang untuk koordinat tersebut. Hint lokasi hilang; pencarian kota dikosongkan. |
| **Edge case — izin ditolak / gagal / timeout** | Label lokasi **tetap** di lokasi aktif sebelumnya. Hint: *“Lokasi ditolak atau gagal. Tetap di lokasi aktif — cari kota di bawah.”* UI tidak diblokir; rekomendasi lama tetap bisa dipakai sampai kamu ganti lokasi lewat pencarian. |
| **Edge case — browser tidak mendukung geolocation** | Hint: *“Peramban tidak mendukung lokasi. Cari kota di bawah saja.”* Tombol tidak memicu request GPS. |
| **Edge case — sedang mengambil lokasi** | Hint: *“Mengambil lokasi perangkat…”*; tombol sementara dinonaktifkan. |
| **Edge case — timeout GPS** | Timeout 10 detik; setelah gagal, perilaku sama seperti penolakan (hint + lokasi aktif tetap). |

---

### US-4 — Mencari kota atau kabupaten di Indonesia

**Sebagai** pengguna yang ingin cek kota lain,  
**saya ingin** mencari nama kota/kabupaten,  
**agar** rekomendasi mengikuti lokasi itu.

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Ketik ≥ 2 huruf → setelah debounce 300 ms, muncul hingga 5 hasil (bahasa Indonesia, `countryCode=ID`). Label hasil: `Nama, Provinsi` jika ada `admin1`, atau hanya nama. Memilih hasil → input dikosongkan, daftar hasil hilang, data lokasi baru dimuat. |
| **Edge case — kurang dari 2 karakter** | Tidak ada request ke API; daftar hasil dan pesan kosong disembunyikan. |
| **Edge case — tidak ditemukan** | Pesan: *“Kota tidak ditemukan. Coba ejaan lain atau nama kabupaten.”* |
| **Edge case — API geocoding gagal** | UI memperlakukan seperti tidak ditemukan (pesan yang sama), tanpa crash. |
| **Edge case — hasil tanpa koordinat/timezone** | Hasil tidak lengkap dilewati; hanya entri valid yang ditampilkan. |
| **Edge case — ketikan cepat** | Hanya respons pencarian terbaru yang dipakai (request lama diabaikan). |

---

### US-5 — Melihat jadwal sholat untuk lokasi aktif

**Sebagai** pengguna Muslim yang ingin lari tanpa bentrok sholat,  
**saya ingin** melihat jadwal sholat hari ini,  
**agar** saya paham kenapa beberapa jam tidak direkomendasikan.

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Lima waktu terisi: Subuh, Zuhur, Ashar, Maghrib, Isya (metode Aladhan `method=20` / Kemenag, `school=0` / Shafi). Format jam dinormalisasi ke `HH:mm` (sufiks zona waktu dari API dibuang). |
| **Edge case — gagal memuat sholat** | Seluruh pemuatan lokasi gagal → state error + **Coba lagi** (cuaca dan sholat diambil paralel; satu gagal = error bersama). |
| **Edge case — field waktu hilang / format invalid** | Fetch sholat melempar error → UI error seperti di atas. |

---

### US-6 — Melihat ringkasan cuaca dan peluang hujan per jam

**Sebagai** pelari,  
**saya ingin** melihat kondisi cuaca hari ini,  
**agar** saya bisa menilai risiko hujan di luar daftar slot.

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Ringkasan: suhu min/maks, peluang hujan tertinggi, label kondisi (Bahasa Indonesia, dari kode WMO). Grafik batang jam 05–21; tinggi batang = peluang hujan. |
| **Edge case — data hourly kosong / tidak selaras** | Fetch cuaca gagal → state error. |
| **Edge case — nilai null di satu jam** | Jam dengan data null dilewati; jam lain tetap dipakai. |
| **Edge case — tidak ada bar di jendela 05–21** | Grafik disembunyikan. |
| **Edge case — kode cuaca tidak dikenal** | Label kondisi: *“Kondisi tidak diketahui”*. |

---

### US-7 — Memahami ketika tidak ada slot aman

**Sebagai** pengguna di hari yang buruk untuk lari,  
**saya ingin** pesan yang menjelaskan kenapa tidak ada rekomendasi,  
**agar** saya tahu harus coba lagi kapan / di mana.

Pesan dipilih dari penyebab **paling dominan** di antara slot yang dibuang (16 kandidat jam 05–20). Jika ada **seri** (dua penyebab sama-sama tertinggi), dipakai pesan campuran.

| Penyebab dominan | Pesan |
| --- | --- |
| Slot sudah lewat (`past`) | *Hari hampir habis — tidak ada slot lari tersisa untuk hari ini.* |
| Bentrok buffer sholat (`prayerConflict`) | *Sisa hari terlalu dekat dengan waktu sholat. Coba cek lagi besok.* |
| Cuaca tidak aman (`unsafeWeather`) | *Cuaca hari ini kurang aman untuk lari. Coba cek lagi nanti atau pilih kota lain.* |
| Seri / campuran | *Tidak ada slot aman tersisa hari ini. Coba cek lagi besok, atau pilih kota lain.* |

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Tidak ada daftar slot; pesan empty sesuai tabel di atas; tombol **Coba lagi** tidak muncul (bukan error jaringan). |
| **Edge case — malam hari (setelah ~21:00 lokal)** | Semua 16 kandidat terhitung `past` → pesan “hari hampir habis”. |
| **Edge case — hujan/panas ekstrem sepanjang sisa hari** | `unsafeWeather` dominan → pesan cuaca. |

---

### US-8 — Mencoba ulang saat data gagal dimuat

**Sebagai** pengguna dengan koneksi sempat putus,  
**saya ingin** menekan **Coba lagi**,  
**agar** saya tidak perlu me-refresh seluruh halaman.

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Klik **Coba lagi** memuat ulang cuaca + sholat + rekomendasi untuk **lokasi aktif** saat ini. Jika berhasil, slot dan meta tampil normal. |
| **Edge case — gagal lagi** | State error tetap / muncul kembali dengan tombol yang sama. |

---

### US-9 — Mengganti mode tampilan (terang / gelap)

**Sebagai** pengguna,  
**saya ingin** ganti tema,  
**agar** nyaman di siang atau malam.

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Klik tombol tema → beralih `light` ↔ `dark`, preferensi disimpan di `localStorage` (`kapan-lari-theme`), `aria-label` tombol menyesuaikan aksi berikutnya. |
| **Edge case — belum pernah memilih** | Tema mengikuti preferensi sistem (`prefers-color-scheme`). Perubahan sistem diikuti selama belum ada preferensi tersimpan. |
| **Edge case — nilai tersimpan invalid** | Dianggap tidak ada preferensi → ikut sistem. |
| **Edge case — localStorage gagal** (mode privat / kuota) | Tema tetap berubah di sesi berjalan; kegagalan simpan diabaikan tanpa crash. |
| **Edge case — FOUC** | Script inline di `<head>` menerapkan tema sebelum paint agar tidak kedip. |

---

### US-10 — Aksesibilitas dan kenyamanan baca

**Sebagai** pengguna dengan kebutuhan aksesibilitas,  
**saya ingin** teks besar, kontrol jelas, dan hormat terhadap reduced motion,  
**agar** aplikasi tetap nyaman dipakai.

| Jenis | Perilaku yang diharapkan |
| --- | --- |
| **Success case** | Bahasa UI Indonesia (`lang="id"`). Tombol dan teks besar; kontras tema lime. Area rekomendasi memakai `aria-live="polite"`. Grafik punya `aria-label` ringkas per jam. |
| **Edge case — prefers-reduced-motion** | Transisi masuk slot/grafik/label lokasi dipersingkat: kelas enter diterapkan langsung tanpa double-`requestAnimationFrame` / delay animasi. |

---

## Aturan rekomendasi slot

Mesin rekomendasi murni (tanpa I/O), diuji di `src/lib/recommendRunSlots.test.ts`.

### Jendela kandidat

- Slot berdurasi **1 jam**
- Mulai setiap jam penuh dari **05:00** sampai **20:00** (slot terakhir berakhir 21:00)
- Zona waktu mengikuti lokasi (dari cuaca / geocoding)

### Filter (slot dibuang jika…)

1. **Sudah lewat** — `now >= akhir slot` (batas tepat di akhir slot = dibuang)
2. **Bentrok sholat** — overlap dengan jendela **±30 menit** di sekitar tiap waktu sholat (Subuh–Isya)
3. **Cuaca tidak aman** — salah satu dari:
   - peluang hujan **≥ 50%**
   - suhu **> 33°C** (tepat 33°C masih lolos)
   - kode cuaca berbahaya: `65, 66, 67, 75, 82, 95, 96, 99`
   - data cuaca jam tersebut hilang

### Peringkat (maks. 5 slot)

Skor (lebih tinggi lebih baik):

1. Kecocokan suhu (ideal 22–30°C, pusat 26°C)
2. Peluang hujan lebih rendah
3. Jam lebih pagi

Cuaca yang dipakai untuk satu slot adalah data pada **jam mulai slot** (bukan rata-rata antar jam).

---

## Struktur proyek

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── pages/
│   │   └── index.astro      # UI utama + orkestrasi client
│   ├── styles/
│   │   └── global.css
│   └── lib/
│       ├── location.ts              # Tipe domain + default Jakarta
│       ├── recommendRunSlots.ts     # Mesin rekomendasi
│       ├── weather.ts               # Open-Meteo forecast
│       ├── prayer.ts                # Aladhan timings
│       ├── geocoding.ts             # Pencarian kota ID
│       ├── display.ts               # Label UI (ID)
│       ├── theme.ts                 # Preferensi tema
│       └── *.test.ts                # Tes unit
├── package.json
├── vitest.config.ts
├── vercel.json
└── README.md
```

---

## Pengujian

```sh
npm test
```

Tes mencakup logika bisnis inti, antara lain:

- filter & ranking slot lari
- pesan empty state
- parsing cuaca / sholat / geocoding
- label tampilan
- resolusi tema
- lokasi default Jakarta

Tidak perlu backend atau browser untuk menjalankan tes unit.

---

## Deploy

Proyek sudah menyertakan `vercel.json` (framework Astro, output `dist`). Alur umum:

1. Push repositori ke GitHub (atau penyedia yang didukung Vercel)
2. Impor proyek di Vercel
3. Build command: `npm run build` · Output: `dist`

Bisa juga di-deploy ke host static lain setelah `npm run build`, selama file di `dist/` dilayani sebagai situs statis.

---

## Batasan & catatan

- **Hanya hari ini** — tidak ada rekomendasi multi-hari.
- **Fokus Indonesia** — pencarian kota difilter `countryCode=ID`.
- **Tanpa akun / tanpa penyimpanan lokasi** — lokasi tidak dipersist; tema ya.
- **Bergantung API publik** — butuh jaringan; kuota/limit pihak ketiga di luar kontrol aplikasi.
- **Rekomendasi bukan saran medis** — filter cuaca/sholat adalah heuristik kenyamanan, bukan jaminan keamanan absolut.
- **Geolocation opsional** — selalu bisa pakai pencarian kota jika GPS ditolak.

---

## Lisensi & kredit data

- Cuaca & geocoding: [Open-Meteo](https://open-meteo.com/)
- Jadwal sholat: [Aladhan](https://aladhan.com/) (metode Kemenag)
- Framework: [Astro](https://astro.build/)
