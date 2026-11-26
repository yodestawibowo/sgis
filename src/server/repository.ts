import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import {
  INITIAL_ALERTS,
  INITIAL_FACILITIES,
  INITIAL_KECAMATAN,
} from '../data/tanggamusSeed.ts';
import type {
  AlertCategory,
  AlertSeverity,
  FacilityPoint,
  FieldAlert,
  KecamatanRecord,
  ServicePriority,
} from '../types/tanggamus.ts';

interface LocalStorePayload {
  kecamatan: KecamatanRecord[];
  facilities: FacilityPoint[];
  alerts: FieldAlert[];
  adminPasswordHash: string | null;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'tanggamus-store.json');

let pgPool: Pool | null = null;
let usePostgres = false;
let pgInitPromise: Promise<void> | null = null;

function hasPostgresEnv(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.PGHOST);
}

function getPool(): Pool {
  if (!pgPool) {
    if (process.env.DATABASE_URL) {
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 10000,
      });
    } else {
      pgPool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'tanggamus_admin',
        password: process.env.PGPASSWORD || '',
        database: process.env.PGDATABASE || 'tanggamus_webgis',
        max: 10,
        connectionTimeoutMillis: 10000,
      });
    }
    pgPool.on('error', (err) => {
      console.error('PostgreSQL pool idle error:', err.message);
    });
  }
  return pgPool;
}

function readLocalStore(): LocalStorePayload {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: LocalStorePayload = {
      kecamatan: INITIAL_KECAMATAN,
      facilities: INITIAL_FACILITIES,
      alerts: INITIAL_ALERTS,
      adminPasswordHash: null,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalStorePayload>;
    const seedById: Record<string, KecamatanRecord> = {};
    for (const seed of INITIAL_KECAMATAN) {
      seedById[seed.id] = seed;
    }
    const hydratedKecamatan =
      Array.isArray(parsed.kecamatan) && parsed.kecamatan.length > 0
        ? parsed.kecamatan.map((item) => {
            const seed = seedById[item.id];
            return {
              ...seed,
              ...item,
              jalanMantapPersen:
                typeof item.jalanMantapPersen === 'number'
                  ? item.jalanMantapPersen
                  : (seed?.jalanMantapPersen ?? 75),
              jembatanLayak:
                typeof item.jembatanLayak === 'number'
                  ? item.jembatanLayak
                  : (seed?.jembatanLayak ?? 0),
              menaraBts:
                typeof item.menaraBts === 'number'
                  ? item.menaraBts
                  : (seed?.menaraBts ?? 0),
              cakupanListrikPersen:
                typeof item.cakupanListrikPersen === 'number'
                  ? item.cakupanListrikPersen
                  : (seed?.cakupanListrikPersen ?? 95),
              jaringanAirBersih:
                typeof item.jaringanAirBersih === 'number'
                  ? item.jaringanAirBersih
                  : (seed?.jaringanAirBersih ?? 0),
              luasLahanPertanianHa:
                typeof item.luasLahanPertanianHa === 'number'
                  ? item.luasLahanPertanianHa
                  : (seed?.luasLahanPertanianHa ?? 0),
              produksiPadiTon:
                typeof item.produksiPadiTon === 'number'
                  ? item.produksiPadiTon
                  : (seed?.produksiPadiTon ?? 0),
              produksiKopiTon:
                typeof item.produksiKopiTon === 'number'
                  ? item.produksiKopiTon
                  : (seed?.produksiKopiTon ?? 0),
              produksiKakaoLadaTon:
                typeof item.produksiKakaoLadaTon === 'number'
                  ? item.produksiKakaoLadaTon
                  : (seed?.produksiKakaoLadaTon ?? 0),
              kelompokTani:
                typeof item.kelompokTani === 'number'
                  ? item.kelompokTani
                  : (seed?.kelompokTani ?? 0),
              komoditasUnggulan:
                typeof item.komoditasUnggulan === 'string' && item.komoditasUnggulan.trim()
                  ? item.komoditasUnggulan
                  : (seed?.komoditasUnggulan ?? ''),
            };
          })
        : INITIAL_KECAMATAN;
    return {
      kecamatan: hydratedKecamatan,
      facilities:
        Array.isArray(parsed.facilities) && parsed.facilities.length > 0
          ? parsed.facilities
          : INITIAL_FACILITIES,
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : INITIAL_ALERTS,
      adminPasswordHash:
        typeof parsed.adminPasswordHash === 'string' ? parsed.adminPasswordHash : null,
    };
  } catch {
    const fallback: LocalStorePayload = {
      kecamatan: INITIAL_KECAMATAN,
      facilities: INITIAL_FACILITIES,
      alerts: INITIAL_ALERTS,
      adminPasswordHash: null,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function writeLocalStore(payload: LocalStorePayload): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function mapRowToKecamatan(row: Record<string, unknown>): KecamatanRecord {
  return {
    id: String(row.id),
    kodeKemendagri: String(row.kode_kemendagri),
    nama: String(row.nama),
    ibuKota: String(row.ibu_kota),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    altitude: Number(row.altitude),
    luasKm2: Number(row.luas_km2),
    jumlahPekon: Number(row.jumlah_pekon),
    jumlahKelurahan: Number(row.jumlah_kelurahan),
    pendudukTotal: Number(row.penduduk_total),
    pendudukLaki: Number(row.penduduk_laki),
    pendudukPerempuan: Number(row.penduduk_perempuan),
    jumlahKk: Number(row.jumlah_kk),
    usiaProduktifPersen: Number(row.usia_produktif_persen),
    pertumbuhanPersen: Number(row.pertumbuhan_persen),
    rumahSakit: Number(row.rumah_sakit),
    puskesmas: Number(row.puskesmas),
    pustu: Number(row.pustu),
    klinikPoskesdes: Number(row.klinik_poskesdes),
    apotek: Number(row.apotek),
    tenagaMedis: Number(row.tenaga_medis),
    paudTk: Number(row.paud_tk),
    sdMi: Number(row.sd_mi),
    smpMts: Number(row.smp_mts),
    smaSmkMa: Number(row.sma_smk_ma),
    perguruanTinggi: Number(row.perguruan_tinggi),
    jalanMantapPersen: Number(row.jalan_mantap_persen ?? 75),
    jembatanLayak: Number(row.jembatan_layak ?? 0),
    menaraBts: Number(row.menara_bts ?? 0),
    cakupanListrikPersen: Number(row.cakupan_listrik_persen ?? 95),
    jaringanAirBersih: Number(row.jaringan_air_bersih ?? 0),
    luasLahanPertanianHa: Number(row.luas_lahan_pertanian_ha ?? 0),
    produksiPadiTon: Number(row.produksi_padi_ton ?? 0),
    produksiKopiTon: Number(row.produksi_kopi_ton ?? 0),
    produksiKakaoLadaTon: Number(row.produksi_kakao_lada_ton ?? 0),
    kelompokTani: Number(row.kelompok_tani ?? 0),
    komoditasUnggulan: String(row.komoditas_unggulan || ''),
    prioritasLayanan: (row.prioritas_layanan as ServicePriority) || 'optimal',
    catatanLapangan: String(row.catatan_lapangan || ''),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at || new Date().toISOString()),
    updatedBy: String(row.updated_by || 'System'),
  };
}

function mapRowToFacility(row: Record<string, unknown>): FacilityPoint {
  return {
    id: String(row.id),
    kecamatanId: String(row.kecamatan_id),
    nama: String(row.nama),
    jenis: row.jenis as FacilityPoint['jenis'],
    subJenis: String(row.sub_jenis),
    alamat: String(row.alamat),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    kapasitas: String(row.kapasitas),
    statusOperasional: row.status_operasional as FacilityPoint['statusOperasional'],
  };
}

function mapRowToAlert(row: Record<string, unknown>): FieldAlert {
  return {
    id: String(row.id),
    kecamatanId: String(row.kecamatan_id),
    kecamatanNama: String(row.kecamatan_nama),
    judul: String(row.judul),
    deskripsi: String(row.deskripsi),
    kategori: row.kategori as AlertCategory,
    severity: row.severity as AlertSeverity,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeter: Number(row.radius_meter),
    aktif: Boolean(row.aktif),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || new Date().toISOString()),
    createdBy: String(row.created_by || 'Admin'),
  };
}

async function ensurePostgresReady(): Promise<void> {
  if (!hasPostgresEnv()) {
    usePostgres = false;
    return;
  }
  if (!pgInitPromise) {
    pgInitPromise = (async () => {
      try {
        const pool = getPool();
        const schemaPath = path.resolve(process.cwd(), 'db', 'init.sql');
        if (fs.existsSync(schemaPath)) {
          const ddl = fs.readFileSync(schemaPath, 'utf8');
          await pool.query(ddl);
        }

        const countRes = await pool.query('SELECT COUNT(*)::int AS total FROM kecamatan');
        const total = Number(countRes.rows[0]?.total ?? 0);

        if (total === 0) {
          for (const k of INITIAL_KECAMATAN) {
            await pool.query(
              `INSERT INTO kecamatan (
                id, kode_kemendagri, nama, ibu_kota, latitude, longitude, altitude,
                luas_km2, jumlah_pekon, jumlah_kelurahan, penduduk_total, penduduk_laki,
                penduduk_perempuan, jumlah_kk, usia_produktif_persen, pertumbuhan_persen,
                rumah_sakit, puskesmas, pustu, klinik_poskesdes, apotek, tenaga_medis,
                paud_tk, sd_mi, smp_mts, sma_smk_ma, perguruan_tinggi,
                jalan_mantap_persen, jembatan_layak, menara_bts, cakupan_listrik_persen,
                jaringan_air_bersih, luas_lahan_pertanian_ha, produksi_padi_ton,
                produksi_kopi_ton, produksi_kakao_lada_ton, kelompok_tani,
                komoditas_unggulan, prioritas_layanan, catatan_lapangan, updated_at, updated_by
              ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42
              ) ON CONFLICT (id) DO NOTHING`,
              [
                k.id,
                k.kodeKemendagri,
                k.nama,
                k.ibuKota,
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
                k.komoditasUnggulan,
                k.prioritasLayanan,
                k.catatanLapangan,
                k.updatedAt,
                k.updatedBy,
              ]
            );
          }

          for (const f of INITIAL_FACILITIES) {
            await pool.query(
              `INSERT INTO facilities (
                id, kecamatan_id, nama, jenis, sub_jenis, alamat,
                latitude, longitude, kapasitas, status_operasional
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
              [
                f.id,
                f.kecamatanId,
                f.nama,
                f.jenis,
                f.subJenis,
                f.alamat,
                f.latitude,
                f.longitude,
                f.kapasitas,
                f.statusOperasional,
              ]
            );
          }

          for (const a of INITIAL_ALERTS) {
            await pool.query(
              `INSERT INTO field_alerts (
                id, kecamatan_id, kecamatan_nama, judul, deskripsi, kategori,
                severity, latitude, longitude, radius_meter, aktif, created_at, created_by
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
              [
                a.id,
                a.kecamatanId,
                a.kecamatanNama,
                a.judul,
                a.deskripsi,
                a.kategori,
                a.severity,
                a.latitude,
                a.longitude,
                a.radiusMeter,
                a.aktif,
                a.createdAt,
                a.createdBy,
              ]
            );
          }
        }

        usePostgres = true;
      } catch (err) {
        console.warn(
          'PostgreSQL belum tersedia, beralih ke penyimpanan lokal persisten:',
          err instanceof Error ? err.message : String(err)
        );
        usePostgres = false;
      }
    })();
  }
  await pgInitPromise;
}

export async function getStorageMode(): Promise<'postgresql' | 'local-store'> {
  await ensurePostgresReady();
  return usePostgres ? 'postgresql' : 'local-store';
}

export async function listKecamatan(): Promise<KecamatanRecord[]> {
  await ensurePostgresReady();
  if (usePostgres) {
    const res = await getPool().query('SELECT * FROM kecamatan ORDER BY nama ASC');
    return res.rows.map(mapRowToKecamatan);
  }
  const store = readLocalStore();
  return [...store.kecamatan].sort((a, b) => a.nama.localeCompare(b.nama));
}

export async function updateKecamatan(
  id: string,
  patch: Partial<KecamatanRecord>
): Promise<KecamatanRecord | null> {
  await ensurePostgresReady();
  const nowIso = new Date().toISOString();

  if (usePostgres) {
    const existingRes = await getPool().query('SELECT * FROM kecamatan WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) return null;
    const current = mapRowToKecamatan(existingRes.rows[0]);
    const next: KecamatanRecord = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: nowIso,
    };

    const res = await getPool().query(
      `UPDATE kecamatan SET
        penduduk_total = $2,
        penduduk_laki = $3,
        penduduk_perempuan = $4,
        jumlah_kk = $5,
        usia_produktif_persen = $6,
        pertumbuhan_persen = $7,
        rumah_sakit = $8,
        puskesmas = $9,
        pustu = $10,
        klinik_poskesdes = $11,
        apotek = $12,
        tenaga_medis = $13,
        paud_tk = $14,
        sd_mi = $15,
        smp_mts = $16,
        sma_smk_ma = $17,
        perguruan_tinggi = $18,
        jalan_mantap_persen = $19,
        jembatan_layak = $20,
        menara_bts = $21,
        cakupan_listrik_persen = $22,
        jaringan_air_bersih = $23,
        luas_lahan_pertanian_ha = $24,
        produksi_padi_ton = $25,
        produksi_kopi_ton = $26,
        produksi_kakao_lada_ton = $27,
        kelompok_tani = $28,
        komoditas_unggulan = $29,
        prioritas_layanan = $30,
        catatan_lapangan = $31,
        updated_at = $32,
        updated_by = $33
      WHERE id = $1
      RETURNING *`,
      [
        next.id,
        next.pendudukTotal,
        next.pendudukLaki,
        next.pendudukPerempuan,
        next.jumlahKk,
        next.usiaProduktifPersen,
        next.pertumbuhanPersen,
        next.rumahSakit,
        next.puskesmas,
        next.pustu,
        next.klinikPoskesdes,
        next.apotek,
        next.tenagaMedis,
        next.paudTk,
        next.sdMi,
        next.smpMts,
        next.smaSmkMa,
        next.perguruanTinggi,
        next.jalanMantapPersen,
        next.jembatanLayak,
        next.menaraBts,
        next.cakupanListrikPersen,
        next.jaringanAirBersih,
        next.luasLahanPertanianHa,
        next.produksiPadiTon,
        next.produksiKopiTon,
        next.produksiKakaoLadaTon,
        next.kelompokTani,
        next.komoditasUnggulan,
        next.prioritasLayanan,
        next.catatanLapangan,
        next.updatedAt,
        next.updatedBy,
      ]
    );
    return res.rows.length > 0 ? mapRowToKecamatan(res.rows[0]) : null;
  }

  const store = readLocalStore();
  const idx = store.kecamatan.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const updated: KecamatanRecord = {
    ...store.kecamatan[idx],
    ...patch,
    id: store.kecamatan[idx].id,
    updatedAt: nowIso,
  };
  store.kecamatan[idx] = updated;
  writeLocalStore(store);
  return updated;
}

export async function listFacilities(): Promise<FacilityPoint[]> {
  await ensurePostgresReady();
  if (usePostgres) {
    const res = await getPool().query('SELECT * FROM facilities ORDER BY nama ASC');
    return res.rows.map(mapRowToFacility);
  }
  const store = readLocalStore();
  return [...store.facilities].sort((a, b) => a.nama.localeCompare(b.nama));
}

export async function createFacility(facility: FacilityPoint): Promise<FacilityPoint> {
  await ensurePostgresReady();
  if (usePostgres) {
    const res = await getPool().query(
      `INSERT INTO facilities (
        id, kecamatan_id, nama, jenis, sub_jenis, alamat,
        latitude, longitude, kapasitas, status_operasional
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        facility.id,
        facility.kecamatanId,
        facility.nama,
        facility.jenis,
        facility.subJenis,
        facility.alamat,
        facility.latitude,
        facility.longitude,
        facility.kapasitas,
        facility.statusOperasional,
      ]
    );
    return mapRowToFacility(res.rows[0]);
  }
  const store = readLocalStore();
  store.facilities.push(facility);
  writeLocalStore(store);
  return facility;
}

export async function listAlerts(): Promise<FieldAlert[]> {
  await ensurePostgresReady();
  if (usePostgres) {
    const res = await getPool().query(
      'SELECT * FROM field_alerts ORDER BY aktif DESC, created_at DESC'
    );
    return res.rows.map(mapRowToAlert);
  }
  const store = readLocalStore();
  return [...store.alerts].sort((a, b) => {
    if (a.aktif !== b.aktif) return a.aktif ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function createAlert(alert: FieldAlert): Promise<FieldAlert> {
  await ensurePostgresReady();
  if (usePostgres) {
    const res = await getPool().query(
      `INSERT INTO field_alerts (
        id, kecamatan_id, kecamatan_nama, judul, deskripsi, kategori,
        severity, latitude, longitude, radius_meter, aktif, created_at, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        alert.id,
        alert.kecamatanId,
        alert.kecamatanNama,
        alert.judul,
        alert.deskripsi,
        alert.kategori,
        alert.severity,
        alert.latitude,
        alert.longitude,
        alert.radiusMeter,
        alert.aktif,
        alert.createdAt,
        alert.createdBy,
      ]
    );
    return mapRowToAlert(res.rows[0]);
  }
  const store = readLocalStore();
  store.alerts.unshift(alert);
  writeLocalStore(store);
  return alert;
}

export async function toggleAlertStatus(id: string, aktif: boolean): Promise<FieldAlert | null> {
  await ensurePostgresReady();
  if (usePostgres) {
    const res = await getPool().query(
      'UPDATE field_alerts SET aktif = $2 WHERE id = $1 RETURNING *',
      [id, aktif]
    );
    return res.rows.length > 0 ? mapRowToAlert(res.rows[0]) : null;
  }
  const store = readLocalStore();
  const idx = store.alerts.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  store.alerts[idx] = { ...store.alerts[idx], aktif };
  writeLocalStore(store);
  return store.alerts[idx];
}

export async function deleteAlert(id: string): Promise<boolean> {
  await ensurePostgresReady();
  if (usePostgres) {
    const res = await getPool().query('DELETE FROM field_alerts WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
  const store = readLocalStore();
  const before = store.alerts.length;
  store.alerts = store.alerts.filter((a) => a.id !== id);
  if (store.alerts.length === before) return false;
  writeLocalStore(store);
  return true;
}

export async function getClaimedAdminHash(): Promise<string | null> {
  await ensurePostgresReady();
  if (usePostgres) {
    const res = await getPool().query(
      'SELECT password_hash FROM admin_credentials WHERE id = 1'
    );
    return res.rows.length > 0 ? String(res.rows[0].password_hash) : null;
  }
  const store = readLocalStore();
  return store.adminPasswordHash;
}

export async function claimAdminHashOnce(passwordHash: string): Promise<boolean> {
  await ensurePostgresReady();
  if (usePostgres) {
    const res = await getPool().query(
      `INSERT INTO admin_credentials (id, password_hash)
       VALUES (1, $1)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [passwordHash]
    );
    return res.rows.length > 0;
  }
  const store = readLocalStore();
  if (store.adminPasswordHash) return false;
  store.adminPasswordHash = passwordHash;
  writeLocalStore(store);
  return true;
}
