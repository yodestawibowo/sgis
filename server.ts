import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Response } from 'express';
import {
  hashPassword,
  issueAdminToken,
  requireAdminAuth,
  verifyAdminToken,
  verifyEnvPasscode,
  verifyPassword,
} from './src/server/auth.ts';
import {
  claimAdminHashOnce,
  createAlert,
  createFacility,
  deleteAlert,
  getClaimedAdminHash,
  getStorageMode,
  listAlerts,
  listFacilities,
  listKecamatan,
  toggleAlertStatus,
  updateKecamatan,
} from './src/server/repository.ts';
import type {
  AlertCategory,
  AlertSeverity,
  KecamatanRecord,
  ServicePriority,
} from './src/types/tanggamus.ts';

const app = express();
app.use(express.json({ limit: '1mb' }));

const sseClients = new Set<Response>();

function broadcastEvent(event: string, payload: unknown): void {
  const data = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.round(num);
}

function toBoundedFloat(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Number(num.toFixed(2))));
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeSqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// Runtime config endpoint (never exposes server secrets)
app.get('/api/config', async (_req, res) => {
  try {
    const storageEngine = await getStorageMode();
    const googleMapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({
      googleMapsApiKey,
      storageEngine,
      kabupatenName: 'Kabupaten Tanggamus',
    });
  } catch (err) {
    console.error('Failed to read runtime config:', err);
    res.status(500).json({ error: 'Gagal memuat konfigurasi aplikasi.' });
  }
});

// Server-Sent Events for real-time map & dashboard sync
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ event: 'connected', timestamp: new Date().toISOString() })}\n\n`);
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Public read endpoints
app.get('/api/kecamatan', async (_req, res) => {
  try {
    const rows = await listKecamatan();
    res.json(rows);
  } catch (err) {
    console.error('GET /api/kecamatan error:', err);
    res.status(500).json({ error: 'Gagal memuat data kecamatan.' });
  }
});

app.get('/api/facilities', async (_req, res) => {
  try {
    const rows = await listFacilities();
    res.json(rows);
  } catch (err) {
    console.error('GET /api/facilities error:', err);
    res.status(500).json({ error: 'Gagal memuat data fasilitas.' });
  }
});

app.get('/api/alerts', async (_req, res) => {
  try {
    const rows = await listAlerts();
    res.json(rows);
  } catch (err) {
    console.error('GET /api/alerts error:', err);
    res.status(500).json({ error: 'Gagal memuat notifikasi lokasi.' });
  }
});

// Automatic CSV report export
app.get('/api/export/csv', async (_req, res) => {
  try {
    const rows = await listKecamatan();
    const headers = [
      'Kode Kemendagri',
      'Kecamatan',
      'Ibu Kota',
      'Luas (km2)',
      'Pekon',
      'Kelurahan',
      'Total Penduduk',
      'Laki-laki',
      'Perempuan',
      'Jumlah KK',
      'Usia Produktif (%)',
      'Pertumbuhan (%)',
      'Rumah Sakit',
      'Puskesmas',
      'Pustu',
      'Klinik/Poskesdes',
      'Apotek',
      'Tenaga Medis',
      'PAUD/TK',
      'SD/MI',
      'SMP/MTs',
      'SMA/SMK/MA',
      'Perguruan Tinggi',
      'Jalan Mantap (%)',
      'Jembatan',
      'Menara BTS',
      'Elektrifikasi (%)',
      'Air Bersih',
      'Lahan Pertanian (Ha)',
      'Produksi Padi (Ton)',
      'Produksi Kopi (Ton)',
      'Kakao & Lada (Ton)',
      'Kelompok Tani',
      'Komoditas Unggulan',
      'Status Prioritas',
      'Pembaruan Terakhir',
    ];
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((k) =>
        [
          k.kodeKemendagri,
          k.nama,
          k.ibuKota,
          k.luasKm2,
          k.jumlahPekon,
          k.jumlahKelurahan,
          k.pendudukTotal,
          k.pendudukLaki,
          k.pendudukPerempuan,
          k.jumlahKk,
          k.usiaProduktifPersen,
          k.pertumbuhanPersen,
          k.rumahSakit,
          k.puskesmas,
          k.pustu,
          k.klinikPoskesdes,
          k.apotek,
          k.tenagaMedis,
          k.paudTk,
          k.sdMi,
          k.smpMts,
          k.smaSmkMa,
          k.perguruanTinggi,
          k.jalanMantapPersen,
          k.jembatanLayak,
          k.menaraBts,
          k.cakupanListrikPersen,
          k.jaringanAirBersih,
          k.luasLahanPertanianHa,
          k.produksiPadiTon,
          k.produksiKopiTon,
          k.produksiKakaoLadaTon,
          k.kelompokTani,
          k.komoditasUnggulan,
          k.prioritasLayanan,
          k.updatedAt,
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ];
    const csvContent = `\uFEFF${lines.join('\r\n')}`;
    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="laporan-tanggamus-${dateStamp}.csv"`
    );
    res.send(csvContent);
  } catch (err) {
    console.error('GET /api/export/csv error:', err);
    res.status(500).json({ error: 'Gagal mengekspor laporan CSV.' });
  }
});

// Automatic PostgreSQL migration dump (for CasaOS Docker sync)
app.get('/api/export/sql', async (_req, res) => {
  try {
    const schemaPath = path.resolve(process.cwd(), 'db', 'init.sql');
    const ddl = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : '';
    const [kecamatanRows, facilityRows, alertRows] = await Promise.all([
      listKecamatan(),
      listFacilities(),
      listAlerts(),
    ]);

    const kecInserts = kecamatanRows
      .map(
        (k) =>
          `INSERT INTO kecamatan (id, kode_kemendagri, nama, ibu_kota, latitude, longitude, altitude, luas_km2, jumlah_pekon, jumlah_kelurahan, penduduk_total, penduduk_laki, penduduk_perempuan, jumlah_kk, usia_produktif_persen, pertumbuhan_persen, rumah_sakit, puskesmas, pustu, klinik_poskesdes, apotek, tenaga_medis, paud_tk, sd_mi, smp_mts, sma_smk_ma, perguruan_tinggi, jalan_mantap_persen, jembatan_layak, menara_bts, cakupan_listrik_persen, jaringan_air_bersih, luas_lahan_pertanian_ha, produksi_padi_ton, produksi_kopi_ton, produksi_kakao_lada_ton, kelompok_tani, komoditas_unggulan, prioritas_layanan, catatan_lapangan, updated_at, updated_by) VALUES (${[
            escapeSqlText(k.id),
            escapeSqlText(k.kodeKemendagri),
            escapeSqlText(k.nama),
            escapeSqlText(k.ibuKota),
            k.latitude,
            k.longitude,
            k.altitude,
            k.luasKm2,
            k.jumlahPekon,
            k.jumlahKelurahan,
            k.pendudukTotal,
            k.pendudukLaki,
            k.pendudukPerempuan,
            k.jumlahKk,
            k.usiaProduktifPersen,
            k.pertumbuhanPersen,
            k.rumahSakit,
            k.puskesmas,
            k.pustu,
            k.klinikPoskesdes,
            k.apotek,
            k.tenagaMedis,
            k.paudTk,
            k.sdMi,
            k.smpMts,
            k.smaSmkMa,
            k.perguruanTinggi,
            k.jalanMantapPersen,
            k.jembatanLayak,
            k.menaraBts,
            k.cakupanListrikPersen,
            k.jaringanAirBersih,
            k.luasLahanPertanianHa,
            k.produksiPadiTon,
            k.produksiKopiTon,
            k.produksiKakaoLadaTon,
            k.kelompokTani,
            escapeSqlText(k.komoditasUnggulan),
            escapeSqlText(k.prioritasLayanan),
            escapeSqlText(k.catatanLapangan),
            escapeSqlText(k.updatedAt),
            escapeSqlText(k.updatedBy),
          ].join(', ')}) ON CONFLICT (id) DO UPDATE SET penduduk_total = EXCLUDED.penduduk_total, rumah_sakit = EXCLUDED.rumah_sakit, puskesmas = EXCLUDED.puskesmas, sd_mi = EXCLUDED.sd_mi, smp_mts = EXCLUDED.smp_mts, sma_smk_ma = EXCLUDED.sma_smk_ma, jalan_mantap_persen = EXCLUDED.jalan_mantap_persen, jembatan_layak = EXCLUDED.jembatan_layak, menara_bts = EXCLUDED.menara_bts, cakupan_listrik_persen = EXCLUDED.cakupan_listrik_persen, jaringan_air_bersih = EXCLUDED.jaringan_air_bersih, luas_lahan_pertanian_ha = EXCLUDED.luas_lahan_pertanian_ha, produksi_padi_ton = EXCLUDED.produksi_padi_ton, produksi_kopi_ton = EXCLUDED.produksi_kopi_ton, produksi_kakao_lada_ton = EXCLUDED.produksi_kakao_lada_ton, kelompok_tani = EXCLUDED.kelompok_tani, komoditas_unggulan = EXCLUDED.komoditas_unggulan, prioritas_layanan = EXCLUDED.prioritas_layanan, catatan_lapangan = EXCLUDED.catatan_lapangan, updated_at = EXCLUDED.updated_at;`
      )
      .join('\n');

    const facInserts = facilityRows
      .map(
        (f) =>
          `INSERT INTO facilities (id, kecamatan_id, nama, jenis, sub_jenis, alamat, latitude, longitude, kapasitas, status_operasional) VALUES (${[
            escapeSqlText(f.id),
            escapeSqlText(f.kecamatanId),
            escapeSqlText(f.nama),
            escapeSqlText(f.jenis),
            escapeSqlText(f.subJenis),
            escapeSqlText(f.alamat),
            f.latitude,
            f.longitude,
            escapeSqlText(f.kapasitas),
            escapeSqlText(f.statusOperasional),
          ].join(', ')}) ON CONFLICT (id) DO NOTHING;`
      )
      .join('\n');

    const alertInserts = alertRows
      .map(
        (a) =>
          `INSERT INTO field_alerts (id, kecamatan_id, kecamatan_nama, judul, deskripsi, kategori, severity, latitude, longitude, radius_meter, aktif, created_at, created_by) VALUES (${[
            escapeSqlText(a.id),
            escapeSqlText(a.kecamatanId),
            escapeSqlText(a.kecamatanNama),
            escapeSqlText(a.judul),
            escapeSqlText(a.deskripsi),
            escapeSqlText(a.kategori),
            escapeSqlText(a.severity),
            a.latitude,
            a.longitude,
            a.radiusMeter,
            a.aktif ? 'TRUE' : 'FALSE',
            escapeSqlText(a.createdAt),
            escapeSqlText(a.createdBy),
          ].join(', ')}) ON CONFLICT (id) DO UPDATE SET aktif = EXCLUDED.aktif;`
      )
      .join('\n');

    const sqlDump = `${ddl}\n\n-- Data Kecamatan\n${kecInserts}\n\n-- Data Fasilitas\n${facInserts}\n\n-- Notifikasi Lapangan\n${alertInserts}\n`;
    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tanggamus-casaos-postgres-${dateStamp}.sql"`
    );
    res.send(sqlDump);
  } catch (err) {
    console.error('GET /api/export/sql error:', err);
    res.status(500).json({ error: 'Gagal mengekspor skema SQL.' });
  }
});

// Admin authentication endpoints
app.get('/api/admin/status', async (req, res) => {
  try {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const claimedHash = await getClaimedAdminHash();
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : '';
    const authenticated = token ? verifyAdminToken(token) : false;

    if (envPasscode.length > 0) {
      res.json({ configured: true, source: 'env', authenticated });
      return;
    }
    if (claimedHash) {
      res.json({ configured: true, source: 'claimed', authenticated });
      return;
    }
    res.json({ configured: false, source: 'unclaimed', authenticated: false });
  } catch (err) {
    console.error('GET /api/admin/status error:', err);
    res.status(500).json({ error: 'Gagal memeriksa status admin.' });
  }
});

app.post('/api/admin/claim', async (req, res) => {
  try {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPasscode.length > 0) {
      res.status(403).json({
        error: 'Passcode admin sudah dikunci melalui environment server.',
      });
      return;
    }

    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (passcode.length < 6 || passcode.length > 128) {
      res.status(400).json({
        error: 'Kata sandi admin minimal 6 karakter.',
      });
      return;
    }

    const hashed = hashPassword(passcode);
    const claimed = await claimAdminHashOnce(hashed);
    if (!claimed) {
      res.status(409).json({
        error: 'Akun admin sudah pernah diatur sebelumnya. Silakan masuk dengan kata sandi yang ada.',
      });
      return;
    }

    const token = issueAdminToken();
    res.status(201).json({ token });
  } catch (err) {
    console.error('POST /api/admin/claim error:', err);
    res.status(500).json({ error: 'Gagal mengatur kata sandi admin awal.' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!passcode) {
      res.status(400).json({ error: 'Kata sandi wajib diisi.' });
      return;
    }

    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPasscode.length > 0) {
      if (!verifyEnvPasscode(passcode, envPasscode)) {
        res.status(401).json({ error: 'Kata sandi admin salah.' });
        return;
      }
      res.json({ token: issueAdminToken() });
      return;
    }

    const claimedHash = await getClaimedAdminHash();
    if (!claimedHash) {
      res.status(400).json({
        error: 'Kata sandi admin belum diatur. Silakan buat kata sandi awal terlebih dahulu.',
      });
      return;
    }

    if (!verifyPassword(passcode, claimedHash)) {
      res.status(401).json({ error: 'Kata sandi admin salah.' });
      return;
    }

    res.json({ token: issueAdminToken() });
  } catch (err) {
    console.error('POST /api/admin/login error:', err);
    res.status(500).json({ error: 'Gagal melakukan verifikasi admin.' });
  }
});

// Protected Admin CRUD routes
app.put('/api/kecamatan/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const list = await listKecamatan();
    const current = list.find((k) => k.id === id);
    if (!current) {
      res.status(404).json({ error: 'Kecamatan tidak ditemukan.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const validPriority: ServicePriority[] = ['optimal', 'perlu_perhatian', 'prioritas'];
    const prioritas = validPriority.includes(body.prioritasLayanan as ServicePriority)
      ? (body.prioritasLayanan as ServicePriority)
      : current.prioritasLayanan;

    const laki = toNonNegativeInt(body.pendudukLaki, current.pendudukLaki);
    const perempuan = toNonNegativeInt(body.pendudukPerempuan, current.pendudukPerempuan);
    const totalInput = toNonNegativeInt(body.pendudukTotal, current.pendudukTotal);
    const pendudukTotal =
      body.pendudukLaki !== undefined || body.pendudukPerempuan !== undefined
        ? laki + perempuan
        : totalInput;

    const patch: Partial<KecamatanRecord> = {
      pendudukTotal,
      pendudukLaki: laki,
      pendudukPerempuan: perempuan,
      jumlahKk: toNonNegativeInt(body.jumlahKk, current.jumlahKk),
      usiaProduktifPersen: toBoundedFloat(
        body.usiaProduktifPersen,
        current.usiaProduktifPersen,
        0,
        100
      ),
      pertumbuhanPersen: toBoundedFloat(
        body.pertumbuhanPersen,
        current.pertumbuhanPersen,
        -10,
        20
      ),
      rumahSakit: toNonNegativeInt(body.rumahSakit, current.rumahSakit),
      puskesmas: toNonNegativeInt(body.puskesmas, current.puskesmas),
      pustu: toNonNegativeInt(body.pustu, current.pustu),
      klinikPoskesdes: toNonNegativeInt(body.klinikPoskesdes, current.klinikPoskesdes),
      apotek: toNonNegativeInt(body.apotek, current.apotek),
      tenagaMedis: toNonNegativeInt(body.tenagaMedis, current.tenagaMedis),
      paudTk: toNonNegativeInt(body.paudTk, current.paudTk),
      sdMi: toNonNegativeInt(body.sdMi, current.sdMi),
      smpMts: toNonNegativeInt(body.smpMts, current.smpMts),
      smaSmkMa: toNonNegativeInt(body.smaSmkMa, current.smaSmkMa),
      perguruanTinggi: toNonNegativeInt(body.perguruanTinggi, current.perguruanTinggi),
      jalanMantapPersen: toBoundedFloat(
        body.jalanMantapPersen,
        current.jalanMantapPersen,
        0,
        100
      ),
      jembatanLayak: toNonNegativeInt(body.jembatanLayak, current.jembatanLayak),
      menaraBts: toNonNegativeInt(body.menaraBts, current.menaraBts),
      cakupanListrikPersen: toBoundedFloat(
        body.cakupanListrikPersen,
        current.cakupanListrikPersen,
        0,
        100
      ),
      jaringanAirBersih: toNonNegativeInt(body.jaringanAirBersih, current.jaringanAirBersih),
      luasLahanPertanianHa: toNonNegativeInt(
        body.luasLahanPertanianHa,
        current.luasLahanPertanianHa
      ),
      produksiPadiTon: toNonNegativeInt(body.produksiPadiTon, current.produksiPadiTon),
      produksiKopiTon: toNonNegativeInt(body.produksiKopiTon, current.produksiKopiTon),
      produksiKakaoLadaTon: toNonNegativeInt(
        body.produksiKakaoLadaTon,
        current.produksiKakaoLadaTon
      ),
      kelompokTani: toNonNegativeInt(body.kelompokTani, current.kelompokTani),
      komoditasUnggulan:
        typeof body.komoditasUnggulan === 'string'
          ? body.komoditasUnggulan.trim().slice(0, 160)
          : current.komoditasUnggulan,
      prioritasLayanan: prioritas,
      catatanLapangan:
        typeof body.catatanLapangan === 'string'
          ? body.catatanLapangan.slice(0, 600)
          : current.catatanLapangan,
      updatedBy:
        typeof body.updatedBy === 'string' && body.updatedBy.trim()
          ? body.updatedBy.trim().slice(0, 80)
          : 'Admin Lapangan',
    };

    const updated = await updateKecamatan(id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Gagal memperbarui kecamatan.' });
      return;
    }

    broadcastEvent('kecamatan_updated', updated);
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/kecamatan/:id error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pembaruan kecamatan.' });
  }
});

app.post('/api/facilities', requireAdminAuth, async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const kecamatanId = String(body.kecamatanId || '').trim();
    const nama = String(body.nama || '').trim().slice(0, 120);
    const subJenis = String(body.subJenis || '').trim().slice(0, 80);
    const alamat = String(body.alamat || '').trim().slice(0, 200);
    const kapasitas = String(body.kapasitas || '').trim().slice(0, 120);
    const jenis =
      body.jenis === 'kesehatan' || body.jenis === 'pendidikan' || body.jenis === 'pemerintahan'
        ? body.jenis
        : 'kesehatan';
    const statusOperasional =
      body.statusOperasional === 'aktif' ||
      body.statusOperasional === 'terbatas' ||
      body.statusOperasional === 'perbaikan'
        ? body.statusOperasional
        : 'aktif';

    if (!kecamatanId || !nama || !alamat) {
      res.status(400).json({ error: 'Kecamatan, nama fasilitas, dan alamat wajib diisi.' });
      return;
    }

    const kecList = await listKecamatan();
    const kec = kecList.find((k) => k.id === kecamatanId);
    if (!kec) {
      res.status(404).json({ error: 'Kecamatan tidak ditemukan.' });
      return;
    }

    const lat = Number(body.latitude);
    const lng = Number(body.longitude);

    const created = await createFacility({
      id: `fac-${Date.now()}`,
      kecamatanId,
      nama,
      jenis,
      subJenis: subJenis || (jenis === 'kesehatan' ? 'Puskesmas / Klinik' : 'Sekolah'),
      alamat,
      latitude: Number.isFinite(lat) ? lat : kec.latitude,
      longitude: Number.isFinite(lng) ? lng : kec.longitude,
      kapasitas: kapasitas || 'Operasional Standar',
      statusOperasional,
    });

    broadcastEvent('facility_created', created);
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/facilities error:', err);
    res.status(500).json({ error: 'Gagal menambahkan fasilitas baru.' });
  }
});

app.post('/api/alerts', requireAdminAuth, async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const kecamatanId = String(body.kecamatanId || '').trim();
    const judul = String(body.judul || '').trim().slice(0, 140);
    const deskripsi = String(body.deskripsi || '').trim().slice(0, 500);
    const createdBy = String(body.createdBy || 'Admin Lapangan').trim().slice(0, 80);

    if (!kecamatanId || !judul || !deskripsi) {
      res.status(400).json({ error: 'Kecamatan, judul, dan deskripsi laporan wajib diisi.' });
      return;
    }

    const kecList = await listKecamatan();
    const kec = kecList.find((k) => k.id === kecamatanId);
    if (!kec) {
      res.status(404).json({ error: 'Kecamatan tujuan tidak valid.' });
      return;
    }

    const validCategories: AlertCategory[] = [
      'kesehatan',
      'pendidikan',
      'infrastruktur',
      'demografi',
      'bencana',
    ];
    const kategori = validCategories.includes(body.kategori as AlertCategory)
      ? (body.kategori as AlertCategory)
      : 'kesehatan';

    const validSeverities: AlertSeverity[] = ['info', 'warning', 'critical'];
    const severity = validSeverities.includes(body.severity as AlertSeverity)
      ? (body.severity as AlertSeverity)
      : 'info';

    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    const radiusMeter = Math.min(20000, Math.max(200, toNonNegativeInt(body.radiusMeter, 3000)));

    const created = await createAlert({
      id: `alert-${Date.now()}`,
      kecamatanId: kec.id,
      kecamatanNama: kec.nama,
      judul,
      deskripsi,
      kategori,
      severity,
      latitude: Number.isFinite(lat) ? lat : kec.latitude,
      longitude: Number.isFinite(lng) ? lng : kec.longitude,
      radiusMeter,
      aktif: true,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'Admin Lapangan',
    });

    broadcastEvent('alert_created', created);
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/alerts error:', err);
    res.status(500).json({ error: 'Gagal membuat notifikasi lokasi.' });
  }
});

app.patch('/api/alerts/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const aktif = Boolean(req.body?.aktif);
    const updated = await toggleAlertStatus(id, aktif);
    if (!updated) {
      res.status(404).json({ error: 'Notifikasi tidak ditemukan.' });
      return;
    }
    broadcastEvent('alert_updated', updated);
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/alerts/:id error:', err);
    res.status(500).json({ error: 'Gagal memperbarui status notifikasi.' });
  }
});

app.delete('/api/alerts/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const removed = await deleteAlert(id);
    if (!removed) {
      res.status(404).json({ error: 'Notifikasi tidak ditemukan.' });
      return;
    }
    broadcastEvent('alert_deleted', { id });
    res.json({ deleted: true, id });
  } catch (err) {
    console.error('DELETE /api/alerts/:id error:', err);
    res.status(500).json({ error: 'Gagal menghapus notifikasi.' });
  }
});

async function startServer(): Promise<void> {
  const port = Number(process.env.PORT || 3000);
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';

  if (isProduction) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server WebGIS 3D Tanggamus aktif pada port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Server gagal dimulai:', err);
  process.exit(1);
});
