-- Skema Database PostgreSQL untuk WebGIS 3D Kabupaten Tanggamus
-- Siap dijalankan otomatis oleh container PostgreSQL di CasaOS / Docker

CREATE TABLE IF NOT EXISTS kecamatan (
  id TEXT PRIMARY KEY,
  kode_kemendagri TEXT NOT NULL,
  nama TEXT NOT NULL,
  ibu_kota TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude INTEGER NOT NULL DEFAULT 50,
  luas_km2 DOUBLE PRECISION NOT NULL,
  jumlah_pekon INTEGER NOT NULL DEFAULT 0,
  jumlah_kelurahan INTEGER NOT NULL DEFAULT 0,
  penduduk_total INTEGER NOT NULL,
  penduduk_laki INTEGER NOT NULL,
  penduduk_perempuan INTEGER NOT NULL,
  jumlah_kk INTEGER NOT NULL,
  usia_produktif_persen DOUBLE PRECISION NOT NULL,
  pertumbuhan_persen DOUBLE PRECISION NOT NULL,
  rumah_sakit INTEGER NOT NULL DEFAULT 0,
  puskesmas INTEGER NOT NULL DEFAULT 0,
  pustu INTEGER NOT NULL DEFAULT 0,
  klinik_poskesdes INTEGER NOT NULL DEFAULT 0,
  apotek INTEGER NOT NULL DEFAULT 0,
  tenaga_medis INTEGER NOT NULL DEFAULT 0,
  paud_tk INTEGER NOT NULL DEFAULT 0,
  sd_mi INTEGER NOT NULL DEFAULT 0,
  smp_mts INTEGER NOT NULL DEFAULT 0,
  sma_smk_ma INTEGER NOT NULL DEFAULT 0,
  perguruan_tinggi INTEGER NOT NULL DEFAULT 0,
  jalan_mantap_persen DOUBLE PRECISION NOT NULL DEFAULT 75,
  jembatan_layak INTEGER NOT NULL DEFAULT 0,
  menara_bts INTEGER NOT NULL DEFAULT 0,
  cakupan_listrik_persen DOUBLE PRECISION NOT NULL DEFAULT 95,
  jaringan_air_bersih INTEGER NOT NULL DEFAULT 0,
  luas_lahan_pertanian_ha INTEGER NOT NULL DEFAULT 0,
  produksi_padi_ton INTEGER NOT NULL DEFAULT 0,
  produksi_kopi_ton INTEGER NOT NULL DEFAULT 0,
  produksi_kakao_lada_ton INTEGER NOT NULL DEFAULT 0,
  kelompok_tani INTEGER NOT NULL DEFAULT 0,
  komoditas_unggulan TEXT NOT NULL DEFAULT '',
  prioritas_layanan TEXT NOT NULL DEFAULT 'optimal',
  catatan_lapangan TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'System'
);

ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS jalan_mantap_persen DOUBLE PRECISION NOT NULL DEFAULT 75;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS jembatan_layak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS menara_bts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS cakupan_listrik_persen DOUBLE PRECISION NOT NULL DEFAULT 95;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS jaringan_air_bersih INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS luas_lahan_pertanian_ha INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS produksi_padi_ton INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS produksi_kopi_ton INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS produksi_kakao_lada_ton INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS kelompok_tani INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kecamatan ADD COLUMN IF NOT EXISTS komoditas_unggulan TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  kecamatan_id TEXT NOT NULL REFERENCES kecamatan(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL,
  sub_jenis TEXT NOT NULL,
  alamat TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  kapasitas TEXT NOT NULL,
  status_operasional TEXT NOT NULL DEFAULT 'aktif'
);

CREATE TABLE IF NOT EXISTS field_alerts (
  id TEXT PRIMARY KEY,
  kecamatan_id TEXT NOT NULL REFERENCES kecamatan(id) ON DELETE CASCADE,
  kecamatan_nama TEXT NOT NULL,
  judul TEXT NOT NULL,
  deskripsi TEXT NOT NULL,
  kategori TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meter INTEGER NOT NULL DEFAULT 3000,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'Admin'
);

CREATE TABLE IF NOT EXISTS admin_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facilities_kecamatan ON facilities(kecamatan_id);
CREATE INDEX IF NOT EXISTS idx_alerts_kecamatan ON field_alerts(kecamatan_id);
CREATE INDEX IF NOT EXISTS idx_alerts_aktif ON field_alerts(aktif);
