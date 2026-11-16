# Auto-Capture Scene HTML5 Canvas & WebGL Saat Unggah

Menambahkan mekanisme penangkapan scene otomatis begitu file `.html` game (HTML5 Canvas / WebGL) selesai diunggah dan merender frame pertamanya, sehingga foto latar langsung masuk ke galeri dan diterapkan pada seluruh opsi mockup tanpa perlu menekan tombol tangkap manual setiap kali unggah.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Pilihan yang sudah Anda konfirmasi telah dikunci sebagai perilaku utama. Satu keputusan teknis tambahan disediakan dengan nilai bawaan yang direkomendasikan.

- **Jenis Konten HTML Target (Terkonfirmasi)**: Game **HTML5 Canvas atau WebGL** (termasuk engine seperti Phaser, Three.js, PixiJS, Construct, maupun kanvas 2D/3D kustom).
- **Perilaku Unggah HTML (Terkonfirmasi)**: **Tangkap otomatis scene pertama saat file dimuat** — begitu pratinjau game selesai booting dan menggambar frame pertamanya, scene langsung ditangkap ke galeri dan menjadi latar belakang aktif.
- **Waktu Tunggu Kesiapan Frame (Default Direkomendasikan)**: Menggunakan pemantauan kesiapan kanvas cerdas (*frame-readiness polling* hingga ±3,5 detik) sebelum memotret, agar game Canvas/WebGL yang butuh waktu inisialisasi tidak tertangkap dalam kondisi kanvas kosong/transparan.

---

### 1. Overview & Core Concept

- **What It Does**: Mengubah alur unggah file HTML dari manual-only menjadi otomatis *capture-on-load* untuk game HTML5 Canvas dan WebGL. Sistem menyuntikkan skrip jembatan lebih awal, menunggu kanvas game berukuran valid dan benar-benar tergambar (tidak kosong), lalu mengirimkan hasil tangkapan PNG ke galeri studio dan langsung memperbarui pratinjau mockup.
- **Target Audience / Persona**: Developer game HTML5/WebGL dan kreator aset promosi yang mengunggah build `.html` untuk langsung menghasilkan variasi mockup pemasaran.
- **Key Value**: Menghilangkan langkah klik ganda yang membingungkan setelah upload, mencegah tangkapan frame kosong saat game sedang *booting*, sekaligus tetap menyediakan tombol tangkap manual untuk scene lanjutan.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Unggah File HTML**: Pengguna memilih atau menyeret file `.html` ke panel Ekstraktor HTML (opsi *"Tangkap otomatis saat unggah"* aktif secara bawaan).
  2. **Status Menunggu Frame**: Panel menampilkan indikator status jelas bahwa pratinjau sedang dimuat dan menunggu frame Canvas/WebGL pertama tergambar.
  3. **Penangkapan Otomatis & Penerapan**: Segera setelah kanvas game menggambar frame yang valid, sistem menangkap gambar, menyimpannya ke **Galeri Scene**, menjadikannya latar belakang aktif pada **10 Opsi Mockup**, dan memperbarui pesan sukses lengkap dengan dimensi piksel yang tertangkap.
  4. **Kontrol Lanjutan**: Jika game membutuhkan klik *"Start/Play"* terlebih dahulu atau pengguna ingin menangkap scene berikutnya, pengguna tetap dapat berinteraksi di pratinjau game lalu menekan **"Ambil Scene Saat Ini"** (atau *"Tangkap Otomatis N Scene"* jika tersedia).
- **Visual Identity & Theme**:
  - Mempertahankan desain dark studio profesional (`#0B0D11` / `#12151C`) dengan aksen crimson (`rose-600`) dan tipografi `Plus Jakarta Sans` + `JetBrains Mono` (`tabular-nums`) untuk metrik dimensi dan elemen.
  - Tidak ada badge pil statis, tidak ada titik animasi dekoratif (`animate-pulse`), dan seluruh kontrol menggunakan label satu baris yang bersih (`whitespace-nowrap shrink-0`).
  - Status proses menggunakan banner teks + ikon semantik yang jelas (menunggu frame, berhasil ditangkap, atau peringatan jika kanvas masih kosong/terhalang CORS).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Frame-Readiness Polling vs Fixed Delay (`setTimeout`)**
  - *Chosen Approach*: Skrip jembatan di dalam `iframe` memeriksa kesiapan `<canvas>` secara berkala menggunakan sampel piksel kecil (downsampled 32×32) hingga menemukan piksel tergambar yang valid, dengan batas tunggu aman sekitar 3,5 detik dan tetap menjamin tepat 1 kali tangkapan per file yang diunggah (*monotonic upload token*).
  - *Why*: Game Canvas/WebGL memiliki waktu muat berbeda-beda (sekitar 50ms hingga >1s untuk kompilasi shader atau load aset). Jeda tetap sering menangkap layar hitam/transparan atau gagal jika terlalu cepat.
  - *Alternatives Considered*: `setTimeout(300ms)` statis — ditolak karena terlalu rapuh untuk WebGL yang lambat dan terasa lambat untuk kanvas 2D sederhana.

- **Decision 2: Penanganan Multi-Canvas Terlihat & Prioritas Elemen**
  - *Chosen Approach*: Menyeleksi kanvas yang benar-benar terlihat di viewport (`width > 0`, `height > 0`, tidak tersembunyi via CSS), dan menggabungkan (*composite*) beberapa kanvas yang bertumpuk jika game memisahkan layer latar dan layer HUD/karakter, sebelum jatuh ke fallback `<img>` atau `<svg>`.
  - *Why*: Banyak game HTML5 memakai dua kanvas bertumpuk (misalnya kanvas background + kanvas UI/sprite).
  - *Alternatives Considered*: Mengambil satu `<canvas>` terbesar saja — berisiko kehilangan elemen foreground atau salah memilih kanvas offscreen tersembunyi.

- **Decision 3: Kontrol Toggle Auto-Capture (Default ON)**
  - *Chosen Approach*: Menyediakan sakelar ringkas *"Tangkap otomatis setelah unggah"* (aktif secara default) di bawah area unggah HTML, serta hanya memicu auto-capture ketika pengguna mengunggah file baru (bukan saat pertama kali membuka panel dengan demo bawaan).
  - *Why*: Menghindari duplikasi scene demo bawaan di galeri saat panel dibuka, namun memastikan setiap file HTML yang diunggah pengguna langsung tertangkap otomatis.

---

### 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Ekstraktor HTML (UI)                         │
│  [Unggah .html] ─▶ Naikkan uploadToken & set status "Menunggu..."    │
│  [Toggle: Tangkap otomatis saat unggah (ON)]                         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Muat srcDoc + skrip jembatan awal
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 Sandbox Iframe + Bridge Penangkap                    │
│  1. Override HTMLCanvasElement.getContext (preserveDrawingBuffer)    │
│  2. Laporkan statistik elemen (Canvas / Img / SVG / data-scene)      │
│  3. Terima perintah SCENEFORGE_WAIT_AND_CAPTURE (dengan token)       │
│     ├─ Poll tiap rAF/150ms hingga kanvas terlihat & tergambar        │
│     ├─ Gabungkan layer kanvas terlihat (atau fallback Img/SVG)       │
│     └─ Kirim dataUrl + dimensi + token via postMessage               │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ SCENEFORGE_CAPTURED (token cocok)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Studio State & Galeri Scene                      │
│  • Tambah scene baru ke urutan teratas galeri                        │
│  • Aktifkan langsung sebagai latar belakang pada 10 Opsi Mockup      │
│  • Pertahankan ukuran kanvas & sudut rounded (termasuk Kartu Kredit) │
└──────────────────────────────────────────────────────────────────────┘
```

- **Sinkronisasi State & Pencegahan Tangkapan Ganda**:
  - Setiap unggahan file baru membuat ID token unik (`uploadToken`) yang dikirim bersama pesan permintaan tangkap otomatis.
  - Listener pesan memverifikasi bahwa token hasil tangkapan cocok dengan unggahan aktif dan belum pernah diproses, sehingga event `load` maupun `SCENEFORGE_READY` tidak memicu tangkapan ganda.
- **Injeksi Awal Bridge & Keamanan Error**:
  - Skrip jembatan disuntikkan sedini mungkin di `<head>` (atau sebelum tag `<script>` pertama) agar `preserveDrawingBuffer: true` aktif sebelum konteks WebGL pertama kali dibuat oleh game.
  - Jika game menggunakan gambar eksternal tanpa izin CORS (*tainted canvas*) atau belum menggambar apa pun setelah batas tunggu habis, pesan error/info yang spesifik ditampilkan di panel agar pengguna tahu langkah berikutnya (misalnya klik *Play* di pratinjau lalu klik **"Ambil Scene Saat Ini"**).
- **Verifikasi Rencana Setelah Implementasi**:
  - Menambah pengujian unit untuk injeksi skrip awal, penanganan fragmen HTML tanpa `<head>`, serta logika/pesan protokol `SCENEFORGE_WAIT_AND_CAPTURE`.
  - Menjalankan uji browser dengan unggahan file HTML5 Canvas & WebGL simulasi untuk memastikan scene pertama otomatis masuk galeri dan memperbarui mockup tanpa intervensi manual.
