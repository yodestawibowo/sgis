export type ServicePriority = 'optimal' | 'perlu_perhatian' | 'prioritas';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertCategory =
  | 'kesehatan'
  | 'pendidikan'
  | 'infrastruktur'
  | 'demografi'
  | 'bencana';

export interface KecamatanRecord {
  id: string;
  kodeKemendagri: string;
  nama: string;
  ibuKota: string;
  latitude: number;
  longitude: number;
  altitude: number;
  luasKm2: number;
  jumlahPekon: number;
  jumlahKelurahan: number;
  // Demografi
  pendudukTotal: number;
  pendudukLaki: number;
  pendudukPerempuan: number;
  jumlahKk: number;
  usiaProduktifPersen: number;
  pertumbuhanPersen: number;
  // Fasilitas Kesehatan
  rumahSakit: number;
  puskesmas: number;
  pustu: number;
  klinikPoskesdes: number;
  apotek: number;
  tenagaMedis: number;
  // Fasilitas Pendidikan
  paudTk: number;
  sdMi: number;
  smpMts: number;
  smaSmkMa: number;
  perguruanTinggi: number;
  // Data Infrastruktur
  jalanMantapPersen: number;
  jembatanLayak: number;
  menaraBts: number;
  cakupanListrikPersen: number;
  jaringanAirBersih: number;
  // Data Pertanian & Komoditas
  luasLahanPertanianHa: number;
  produksiPadiTon: number;
  produksiKopiTon: number;
  produksiKakaoLadaTon: number;
  kelompokTani: number;
  komoditasUnggulan: string;
  // Metadata & Analisis
  prioritasLayanan: ServicePriority;
  catatanLapangan: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FacilityPoint {
  id: string;
  kecamatanId: string;
  nama: string;
  jenis: 'kesehatan' | 'pendidikan' | 'pemerintahan';
  subJenis: string;
  alamat: string;
  latitude: number;
  longitude: number;
  kapasitas: string;
  statusOperasional: 'aktif' | 'terbatas' | 'perbaikan';
}

export interface FieldAlert {
  id: string;
  kecamatanId: string;
  kecamatanNama: string;
  judul: string;
  deskripsi: string;
  kategori: AlertCategory;
  severity: AlertSeverity;
  latitude: number;
  longitude: number;
  radiusMeter: number;
  aktif: boolean;
  createdAt: string;
  createdBy: string;
}

export interface AdminAuthStatus {
  configured: boolean;
  source: 'env' | 'claimed' | 'unclaimed';
  authenticated: boolean;
}

export interface AppRuntimeConfig {
  googleMapsApiKey: string;
  storageEngine: 'postgresql' | 'local-store';
  kabupatenName: string;
}
