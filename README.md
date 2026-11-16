# SceneForge Studio

Aplikasi pembuat mockup gambar 5 opsi dengan variasi ukuran, kustomisasi teks, dan ekstraksi latar belakang scene game dari file HTML.

Seluruh proses berjalan di browser (client-side), jadi hasil build-nya adalah situs statis.

## Menjalankan secara lokal

**Prasyarat:** Node.js 22.x

```bash
npm install
npm run dev      # http://localhost:3000
```

Perintah lain:

```bash
npm run build    # build produksi ke folder dist/
npm run preview  # cek hasil build secara lokal
npm run lint     # type-check TypeScript
```

## Deploy ke Vercel

Project ini sudah disiapkan untuk Vercel lewat `vercel.json`:

- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

Langkah deploy:

1. Buka [vercel.com/new](https://vercel.com/new), lalu import repo `soundtext/sceneforge-studio`.
2. Biarkan semua pengaturan default (Vercel membaca `vercel.json`).
3. Klik **Deploy**. Tidak ada environment variable yang wajib diisi.

Atau lewat CLI:

```bash
npx vercel --prod
```

### Catatan penting saat deploy

- **Gunakan `package-lock.json` sebagai satu-satunya lockfile.** Jangan menambahkan `bun.lock`/`pnpm-lock.yaml` di repo yang sama — konflik lockfile membuat proses instalasi memilih resolver yang berbeda dan bisa memunculkan error `ERESOLVE`.
- **Jangan menambahkan `esbuild` manual ke devDependencies.** Vite 8 memakai `esbuild` sebagai *optional peer* (`^0.27 || ^0.28`), dan `tsx` sudah membawa versi yang cocok. Memasang `esbuild@0.25` secara eksplisit akan membuat `npm install` gagal dengan `ERESOLVE`.
- `npm warn Unknown env config "cache-dir"` yang muncul di log Vercel hanyalah peringatan dari environment Vercel dan tidak mempengaruhi build.
