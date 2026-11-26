import { useEffect, useState } from 'react';
import {
  BellPlus,
  Building2,
  CheckCircle2,
  Database,
  Lock,
  LogOut,
  Save,
  Server,
  Trash2,
} from 'lucide-react';
import type {
  AdminAuthStatus,
  AlertCategory,
  AlertSeverity,
  FacilityPoint,
  FieldAlert,
  KecamatanRecord,
  ServicePriority,
} from '../types/tanggamus.ts';

interface AdminDashboardProps {
  kecamatanList: KecamatanRecord[];
  alerts: FieldAlert[];
  storageEngine: 'postgresql' | 'local-store';
  initialSelectedKecamatanId?: string | null;
  authToken: string | null;
  onSetAuthToken: (token: string | null) => void;
  onKecamatanUpdated: (updated: KecamatanRecord) => void;
  onAlertCreated: (alert: FieldAlert) => void;
  onAlertUpdated: (alert: FieldAlert) => void;
  onAlertDeleted: (id: string) => void;
  onFacilityCreated: (facility: FacilityPoint) => void;
}

type AdminTab = 'kecamatan' | 'alerts' | 'facilities' | 'casaos';

export function AdminDashboard({
  kecamatanList,
  alerts,
  storageEngine,
  initialSelectedKecamatanId,
  authToken,
  onSetAuthToken,
  onKecamatanUpdated,
  onAlertCreated,
  onAlertUpdated,
  onAlertDeleted,
  onFacilityCreated,
}: AdminDashboardProps) {
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('kecamatan');
  const [selectedId, setSelectedId] = useState<string>(
    initialSelectedKecamatanId || kecamatanList[0]?.id || ''
  );
  const [formState, setFormState] = useState<KecamatanRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Alert creation form state
  const [alertForm, setAlertForm] = useState({
    kecamatanId: kecamatanList[0]?.id || '',
    judul: '',
    deskripsi: '',
    kategori: 'kesehatan' as AlertCategory,
    severity: 'warning' as AlertSeverity,
    radiusMeter: 3500,
    createdBy: 'Admin Lapangan',
  });

  // Facility creation form state
  const [facForm, setFacForm] = useState({
    kecamatanId: kecamatanList[0]?.id || '',
    nama: '',
    jenis: 'kesehatan' as FacilityPoint['jenis'],
    subJenis: 'Puskesmas Pembantu',
    alamat: '',
    kapasitas: 'Operasional Harian',
    statusOperasional: 'aktif' as FacilityPoint['statusOperasional'],
  });

  useEffect(() => {
    if (initialSelectedKecamatanId) {
      setSelectedId(initialSelectedKecamatanId);
      setActiveTab('kecamatan');
    }
  }, [initialSelectedKecamatanId]);

  useEffect(() => {
    const target = kecamatanList.find((k) => k.id === selectedId) || kecamatanList[0];
    if (target) {
      setFormState({ ...target });
    }
  }, [selectedId, kecamatanList]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/admin/status', {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (res.ok) {
          const data = (await res.json()) as AdminAuthStatus;
          setAuthStatus(data);
          if (authToken && !data.authenticated) {
            onSetAuthToken(null);
          }
        }
      } catch {
        // ignore transient network check
      }
    };
    void fetchStatus();
  }, [authToken, onSetAuthToken]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!passcodeInput.trim()) {
      setAuthError('Masukkan kata sandi admin.');
      return;
    }
    setAuthLoading(true);
    try {
      const endpoint =
        authStatus && !authStatus.configured ? '/api/admin/claim' : '/api/admin/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'Verifikasi admin gagal.');
        return;
      }
      onSetAuthToken(data.token);
      setPasscodeInput('');
      setAuthStatus({ configured: true, source: authStatus?.source || 'claimed', authenticated: true });
    } catch {
      setAuthError('Tidak dapat terhubung ke server.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveKecamatan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState || !authToken) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/kecamatan/${formState.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(formState),
      });
      const data = (await res.json()) as KecamatanRecord & { error?: string };
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Gagal menyimpan pembaruan.' });
        return;
      }
      onKecamatanUpdated(data);
      setFeedback({
        type: 'ok',
        text: `Data Kec. ${data.nama} berhasil diperbarui dan disiarkan real-time.`,
      });
    } catch {
      setFeedback({ type: 'err', text: 'Koneksi gagal saat menyimpan data.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(alertForm),
      });
      const data = (await res.json()) as FieldAlert & { error?: string };
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Gagal membuat notifikasi.' });
        return;
      }
      onAlertCreated(data);
      setAlertForm((prev) => ({ ...prev, judul: '', deskripsi: '' }));
      setFeedback({ type: 'ok', text: 'Notifikasi lokasi berhasil dipublikasikan ke peta.' });
    } catch {
      setFeedback({ type: 'err', text: 'Terjadi kesalahan saat mengirim notifikasi.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAlert = async (alert: FieldAlert) => {
    if (!authToken) return;
    const res = await fetch(`/api/alerts/${alert.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ aktif: !alert.aktif }),
    });
    if (res.ok) {
      const updated = (await res.json()) as FieldAlert;
      onAlertUpdated(updated);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!authToken) return;
    const res = await fetch(`/api/alerts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      onAlertDeleted(id);
    }
  };

  const handleCreateFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/facilities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(facForm),
      });
      const data = (await res.json()) as FacilityPoint & { error?: string };
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Gagal menambahkan fasilitas.' });
        return;
      }
      onFacilityCreated(data);
      setFacForm((prev) => ({ ...prev, nama: '', alamat: '' }));
      setFeedback({ type: 'ok', text: `Fasilitas ${data.nama} ditambahkan ke peta.` });
    } catch {
      setFeedback({ type: 'err', text: 'Gagal terhubung ke server.' });
    } finally {
      setSaving(false);
    }
  };

  // Unauthenticated gate (inline claim or login)
  if (!authToken || (authStatus && !authStatus.authenticated)) {
    const isFirstRunSetup = authStatus && !authStatus.configured;
    return (
      <div className="max-w-md mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {isFirstRunSetup
                  ? 'Atur Kata Sandi Admin Pertama Kali'
                  : 'Masuk Dashboard Admin WebGIS'}
              </h1>
              <p className="text-xs text-slate-500">
                {isFirstRunSetup
                  ? 'Buat kata sandi admin (min. 6 karakter) untuk mengamankan pembaruan data Tanggamus.'
                  : 'Masukkan kata sandi admin untuk memperbarui data kecamatan dan notifikasi lapangan.'}
              </p>
            </div>
          </div>

          <form onSubmit={(e) => void handleAuthSubmit(e)} className="space-y-4">
            <div>
              <label
                htmlFor="admin-passcode"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {isFirstRunSetup ? 'Kata Sandi Admin Baru' : 'Kata Sandi Admin'}
              </label>
              <input
                id="admin-passcode"
                type="password"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {authError && (
              <div className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {authLoading
                ? 'Memverifikasi...'
                : isFirstRunSetup
                  ? 'Simpan & Aktifkan Admin'
                  : 'Masuk ke Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="text-xs font-semibold text-teal-700">
            Panel Pengelola Data Real-Time · Kabupaten Tanggamus
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Dashboard Admin & Sinkronisasi PostgreSQL
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-teal-700" />
            <span>
              Engine:{' '}
              <strong>
                {storageEngine === 'postgresql' ? 'PostgreSQL Aktif' : 'Penyimpanan Lokal (Siap Migrasi PG)'}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSetAuthToken(null)}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit overflow-x-auto max-w-full">
        {(
          [
            ['kecamatan', 'Update Data Kecamatan'],
            ['alerts', 'Notifikasi Lokasi'],
            ['facilities', 'Tambah Fasilitas'],
            ['casaos', 'Docker & PostgreSQL CasaOS'],
          ] as Array<[AdminTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setActiveTab(id);
              setFeedback(null);
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Tab 1: Edit Kecamatan */}
      {activeTab === 'kecamatan' && formState && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-3 max-h-[620px] overflow-y-auto space-y-1">
            <div className="px-2.5 py-1.5 text-xs font-bold text-slate-500">
              Pilih Kecamatan ({kecamatanList.length})
            </div>
            {kecamatanList.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setSelectedId(k.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                  k.id === selectedId
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{k.nama}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    k.id === selectedId ? 'text-teal-100' : 'text-slate-400'
                  }`}
                >
                  {k.kodeKemendagri}
                </span>
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => void handleSaveKecamatan(e)}
            className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Kecamatan {formState.nama}
                </h2>
                <p className="text-xs text-slate-500">
                  Perubahan langsung diperbarui di Peta 3D dan Grafik Statistik untuk semua pengguna.
                </p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Real-Time'}</span>
              </button>
            </div>

            {/* Demografi */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 mb-3">Data Demografi</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <label className="block">
                  <span className="text-[11px] text-slate-600">Penduduk Laki-laki</span>
                  <input
                    type="number"
                    min={0}
                    value={formState.pendudukLaki}
                    onChange={(e) => {
                      const laki = Number(e.target.value) || 0;
                      setFormState({
                        ...formState,
                        pendudukLaki: laki,
                        pendudukTotal: laki + formState.pendudukPerempuan,
                      });
                    }}
                    className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-600">Penduduk Perempuan</span>
                  <input
                    type="number"
                    min={0}
                    value={formState.pendudukPerempuan}
                    onChange={(e) => {
                      const per = Number(e.target.value) || 0;
                      setFormState({
                        ...formState,
                        pendudukPerempuan: per,
                        pendudukTotal: formState.pendudukLaki + per,
                      });
                    }}
                    className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-600">Jumlah KK</span>
                  <input
                    type="number"
                    min={0}
                    value={formState.jumlahKk}
                    onChange={(e) =>
                      setFormState({ ...formState, jumlahKk: Number(e.target.value) || 0 })
                    }
                    className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-600">Usia Produktif (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={formState.usiaProduktifPersen}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        usiaProduktifPersen: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-600">Pertumbuhan (%)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formState.pertumbuhanPersen}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        pertumbuhanPersen: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </label>
              </div>
            </div>

            {/* Kesehatan */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 mb-3">
                Fasilitas Kesehatan & Tenaga Medis
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                {[
                  ['rumahSakit', 'Rumah Sakit'],
                  ['puskesmas', 'Puskesmas'],
                  ['pustu', 'Pustu'],
                  ['klinikPoskesdes', 'Poskesdes'],
                  ['apotek', 'Apotek'],
                  ['tenagaMedis', 'Tenaga Medis'],
                ].map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="text-[11px] text-slate-600">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={formState[field as keyof KecamatanRecord] as number}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          [field]: Number(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Pendidikan */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 mb-3">Fasilitas Pendidikan</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  ['paudTk', 'PAUD / TK'],
                  ['sdMi', 'SD / MI'],
                  ['smpMts', 'SMP / MTs'],
                  ['smaSmkMa', 'SMA / SMK / MA'],
                  ['perguruanTinggi', 'Perguruan Tinggi'],
                ].map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="text-[11px] text-slate-600">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={formState[field as keyof KecamatanRecord] as number}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          [field]: Number(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Infrastruktur */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 mb-3">Infrastruktur Wilayah</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { field: 'jalanMantapPersen', label: 'Jalan Mantap (%)', step: '0.1', max: 100 },
                  { field: 'jembatanLayak', label: 'Jembatan (Unit)', step: '1', max: undefined },
                  { field: 'menaraBts', label: 'Menara BTS (Unit)', step: '1', max: undefined },
                  { field: 'cakupanListrikPersen', label: 'Elektrifikasi (%)', step: '0.1', max: 100 },
                  { field: 'jaringanAirBersih', label: 'Air Bersih / SPAM', step: '1', max: undefined },
                ].map((item) => (
                  <label key={item.field} className="block">
                    <span className="text-[11px] text-slate-600">{item.label}</span>
                    <input
                      type="number"
                      step={item.step}
                      min={0}
                      max={item.max}
                      value={formState[item.field as keyof KecamatanRecord] as number}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          [item.field]: Number(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Pertanian & Komoditas */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-bold text-slate-500">Pertanian & Komoditas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  ['luasLahanPertanianHa', 'Luas Lahan (Ha)'],
                  ['produksiPadiTon', 'Produksi Padi (Ton)'],
                  ['produksiKopiTon', 'Produksi Kopi (Ton)'],
                  ['produksiKakaoLadaTon', 'Kakao & Lada (Ton)'],
                  ['kelompokTani', 'Kelompok Tani'],
                ].map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="text-[11px] text-slate-600">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={formState[field as keyof KecamatanRecord] as number}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          [field]: Number(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                    />
                  </label>
                ))}
              </div>
              <label className="block">
                <span className="text-[11px] text-slate-600">Komoditas Unggulan Utama</span>
                <input
                  type="text"
                  value={formState.komoditasUnggulan}
                  onChange={(e) =>
                    setFormState({ ...formState, komoditasUnggulan: e.target.value })
                  }
                  placeholder="Contoh: Kopi Robusta, Lada Hitam, Kakao"
                  className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </label>
            </div>

            {/* Status & Catatan */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-[11px] text-slate-600 font-semibold">
                  Status Prioritas Layanan
                </span>
                <select
                  value={formState.prioritasLayanan}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      prioritasLayanan: e.target.value as ServicePriority,
                    })
                  }
                  className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="optimal">Layanan Optimal</option>
                  <option value="perlu_perhatian">Perlu Penguatan</option>
                  <option value="prioritas">Prioritas Intervensi</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-[11px] text-slate-600 font-semibold">
                  Petugas / Instansi Pembaru
                </span>
                <input
                  type="text"
                  value={formState.updatedBy}
                  onChange={(e) => setFormState({ ...formState, updatedBy: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </label>

              <label className="block sm:col-span-3">
                <span className="text-[11px] text-slate-600 font-semibold">
                  Catatan Kondisi Lapangan
                </span>
                <textarea
                  rows={2}
                  value={formState.catatanLapangan}
                  onChange={(e) =>
                    setFormState({ ...formState, catatanLapangan: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </label>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Manage Location-Based Alerts */}
      {activeTab === 'alerts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={(e) => void handleCreateAlert(e)}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 self-start"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <BellPlus className="w-4 h-4 text-teal-700" />
              <span>Terbitkan Notifikasi Lokasi</span>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Kecamatan</span>
              <select
                value={alertForm.kecamatanId}
                onChange={(e) =>
                  setAlertForm({ ...alertForm, kecamatanId: e.target.value })
                }
                className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {kecamatanList.map((k) => (
                  <option key={k.id} value={k.id}>
                    Kec. {k.nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Judul Kondisi Lapangan</span>
              <input
                type="text"
                required
                value={alertForm.judul}
                onChange={(e) => setAlertForm({ ...alertForm, judul: e.target.value })}
                placeholder="Contoh: Posyandu Keliling Pekon Tekad"
                className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Deskripsi Detail</span>
              <textarea
                rows={3}
                required
                value={alertForm.deskripsi}
                onChange={(e) =>
                  setAlertForm({ ...alertForm, deskripsi: e.target.value })
                }
                placeholder="Detail perubahan kondisi di lapangan..."
                className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Kategori</span>
                <select
                  value={alertForm.kategori}
                  onChange={(e) =>
                    setAlertForm({
                      ...alertForm,
                      kategori: e.target.value as AlertCategory,
                    })
                  }
                  className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="kesehatan">Kesehatan</option>
                  <option value="pendidikan">Pendidikan</option>
                  <option value="infrastruktur">Infrastruktur</option>
                  <option value="demografi">Demografi</option>
                  <option value="bencana">Kebencanaan</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Tingkat</span>
                <select
                  value={alertForm.severity}
                  onChange={(e) =>
                    setAlertForm({
                      ...alertForm,
                      severity: e.target.value as AlertSeverity,
                    })
                  }
                  className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="info">Informasi</option>
                  <option value="warning">Peringatan</option>
                  <option value="critical">Kritis</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">
                Radius Geofence (meter)
              </span>
              <input
                type="number"
                min={200}
                max={20000}
                value={alertForm.radiusMeter}
                onChange={(e) =>
                  setAlertForm({
                    ...alertForm,
                    radiusMeter: Number(e.target.value) || 3000,
                  })
                }
                className="mt-1 w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
            >
              Publikasikan Notifikasi
            </button>
          </form>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            <div className="px-5 py-3.5 text-xs font-bold text-slate-600">
              Daftar Notifikasi Lapangan ({alerts.length})
            </div>
            {alerts.map((a) => (
              <div
                key={a.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">
                    Kec. {a.kecamatanNama} · {a.kategori} · Radius {a.radiusMeter} m
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">{a.judul}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{a.deskripsi}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleToggleAlert(a)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                      a.aktif
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {a.aktif ? 'Aktif' : 'Nonaktif'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAlert(a.id)}
                    aria-label="Hapus notifikasi"
                    className="p-1.5 text-slate-400 hover:text-rose-700 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Add Facility */}
      {activeTab === 'facilities' && (
        <form
          onSubmit={(e) => void handleCreateFacility(e)}
          className="max-w-2xl bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Building2 className="w-4 h-4 text-teal-700" />
            <span>Tambah Titik Fasilitas Kesehatan / Pendidikan</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Kecamatan</span>
              <select
                value={facForm.kecamatanId}
                onChange={(e) => setFacForm({ ...facForm, kecamatanId: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {kecamatanList.map((k) => (
                  <option key={k.id} value={k.id}>
                    Kec. {k.nama}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Sektor</span>
              <select
                value={facForm.jenis}
                onChange={(e) =>
                  setFacForm({ ...facForm, jenis: e.target.value as FacilityPoint['jenis'] })
                }
                className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="kesehatan">Kesehatan</option>
                <option value="pendidikan">Pendidikan</option>
                <option value="pemerintahan">Pemerintahan</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-700">Nama Fasilitas</span>
              <input
                type="text"
                required
                value={facForm.nama}
                onChange={(e) => setFacForm({ ...facForm, nama: e.target.value })}
                placeholder="Contoh: Puskesmas Pembantu Pekon Ngarip"
                className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Sub Jenis</span>
              <input
                type="text"
                value={facForm.subJenis}
                onChange={(e) => setFacForm({ ...facForm, subJenis: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Kapasitas / Layanan</span>
              <input
                type="text"
                value={facForm.kapasitas}
                onChange={(e) => setFacForm({ ...facForm, kapasitas: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-700">Alamat Lengkap</span>
              <input
                type="text"
                required
                value={facForm.alamat}
                onChange={(e) => setFacForm({ ...facForm, alamat: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
          >
            Simpan Titik Fasilitas
          </button>
        </form>
      )}

      {/* Tab 4: CasaOS + Docker + PostgreSQL Migration Guide */}
      {activeTab === 'casaos' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <Server className="w-5 h-5 text-teal-700 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Panduan Migrasi PostgreSQL & Docker untuk Server CasaOS
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Proyek ini sudah dilengkapi <code className="font-mono">Dockerfile</code>,{' '}
                  <code className="font-mono">docker-compose.yml</code>, dan{' '}
                  <code className="font-mono">db/init.sql</code> dengan dukungan driver PostgreSQL (<code className="font-mono">pg</code>).
                </p>
              </div>
            </div>
            <a
              href="/api/export/sql"
              className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Unduh SQL Snapshot Terbaru</span>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="font-bold text-slate-900">1. Langkah Deploy di CasaOS</div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-700">
                <li>Salin folder proyek ke server CasaOS (mis. <code className="font-mono">/DATA/AppData/tanggamus-webgis</code>).</li>
                <li>Buat file <code className="font-mono">.env</code> berisi <code className="font-mono">PGUSER</code>, <code className="font-mono">PGPASSWORD</code>, <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code>, dan <code className="font-mono">ADMIN_PASSCODE</code>.</li>
                <li>Jalankan <code className="font-mono">docker compose up -d --build</code> atau impor <code className="font-mono">docker-compose.yml</code> via App Store Custom Install di CasaOS.</li>
                <li>Server otomatis menginisialisasi tabel PostgreSQL 16 dan mengisi data 20 kecamatan Tanggamus.</li>
              </ol>
            </div>
            <div className="p-4 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed">
              <div># Perintah cepat di terminal CasaOS</div>
              <div className="text-teal-300 mt-1">docker compose up -d --build</div>
              <div className="mt-2"># Cek status PostgreSQL container</div>
              <div className="text-teal-300 mt-1">docker compose ps</div>
              <div className="mt-2"># Backup manual database PostgreSQL</div>
              <div className="text-teal-300 mt-1">
                docker exec tanggamus-postgres pg_dump -U tanggamus_admin tanggamus_webgis &gt; backup.sql
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
