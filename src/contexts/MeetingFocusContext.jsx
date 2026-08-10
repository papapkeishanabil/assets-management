// ============================================================
// MeetingFocusContext — Presentation-only "Meeting Focus Mode"
// ============================================================
//
// Tujuan: saat meeting berstatus IN_PROGRESS, sidebar aplikasi utama
// disembunyikan agar Annotation Viewer / Technical Review mendapat
// area maksimum (projector/desktop).
//
// Aturan (bukan hanya local UI toggle):
// 1. Focus aktif HANYA jika meeting berstatus IN_PROGRESS (set oleh
//    halaman yang mem-fetch status meeting dari DB — lihat
//    PPMMeetingRoomPage / PPMPoDetailPage).
// 2. State disimpan di sessionStorage sehingga browser refresh saat
//    meeting masih IN_PROGRESS otomatis kembali ke Focus Mode.
//    BUKAN localStorage → bukan preference permanen user.
// 3. Navigation state TIDAK dihapus — hanya presentation/layout.
// ============================================================
import { createContext, useContext, useState, useCallback } from 'react';
import { PPM_MEETING_STATUS } from '../lib/constants';

const STORAGE_KEY = 'ppm-meeting-focus';

const MeetingFocusContext = createContext(null);

function readStoredFocus() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.status === PPM_MEETING_STATUS.IN_PROGRESS && parsed.meetingId) {
      return { meetingId: parsed.meetingId, status: parsed.status };
    }
    return null;
  } catch {
    return null;
  }
}

export function MeetingFocusProvider({ children }) {
  const [focus, setFocus] = useState(readStoredFocus);

  // Sinkronkan focus dengan status meeting (dipanggil halaman meeting).
  const setMeetingFocus = useCallback((meetingId, status) => {
    const next =
      meetingId && status === PPM_MEETING_STATUS.IN_PROGRESS
        ? { meetingId, status }
        : null;
    setFocus(next);
    try {
      if (next) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // sessionStorage tidak tersedia -> fallback tetap berfungsi in-memory.
    }
  }, []);

  const endMeetingFocus = useCallback(() => {
    setMeetingFocus(null, null);
  }, [setMeetingFocus]);

  return (
    <MeetingFocusContext.Provider value={{ focus, setMeetingFocus, endMeetingFocus }}>
      {children}
    </MeetingFocusContext.Provider>
  );
}

export function useMeetingFocus() {
  const ctx = useContext(MeetingFocusContext);
  if (!ctx) {
    throw new Error('useMeetingFocus harus dipakai di dalam <MeetingFocusProvider>');
  }
  return ctx;
}
