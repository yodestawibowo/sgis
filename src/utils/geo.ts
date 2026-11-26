import type { KecamatanRecord, ServicePriority } from '../types/tanggamus.ts';

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '-';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(value));
}

export function getHealthTotal(k: KecamatanRecord): number {
  return k.rumahSakit + k.puskesmas + k.pustu + k.klinikPoskesdes + k.apotek;
}

export function getEducationTotal(k: KecamatanRecord): number {
  return k.paudTk + k.sdMi + k.smpMts + k.smaSmkMa + k.perguruanTinggi;
}

export function getDensity(k: KecamatanRecord): number {
  if (k.luasKm2 <= 0) return 0;
  return Math.round(k.pendudukTotal / k.luasKm2);
}

export function getPriorityLabel(priority: ServicePriority): string {
  if (priority === 'optimal') return 'Layanan Optimal';
  if (priority === 'perlu_perhatian') return 'Perlu Penguatan';
  return 'Prioritas Intervensi';
}

export function getPriorityColor(priority: ServicePriority): {
  text: string;
  bg: string;
  border: string;
  hex: string;
} {
  if (priority === 'optimal') {
    return {
      text: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      hex: '#0D9488',
    };
  }
  if (priority === 'perlu_perhatian') {
    return {
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      hex: '#D97706',
    };
  }
  return {
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    hex: '#DC2626',
  };
}

export function detectWebGL2Support(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function findNearestKecamatan(
  lat: number,
  lng: number,
  list: KecamatanRecord[]
): { kecamatan: KecamatanRecord; distance: number } | null {
  if (list.length === 0) return null;
  let best = list[0];
  let bestDist = distanceMeters(lat, lng, best.latitude, best.longitude);
  for (let i = 1; i < list.length; i += 1) {
    const d = distanceMeters(lat, lng, list[i].latitude, list[i].longitude);
    if (d < bestDist) {
      best = list[i];
      bestDist = d;
    }
  }
  return { kecamatan: best, distance: bestDist };
}
