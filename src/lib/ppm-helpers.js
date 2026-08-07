// ============================================================
// PPM (Pre-Production Meeting) Helper Functions
// ============================================================
import { supabase } from './supabase';

//
// Generates a unique meeting code in the format PPM-YYYY-XXXX
// Uses a loop to ensure uniqueness by checking the database.
//
export async function generateMeetingCode(year) {
  const targetYear = year || new Date().getFullYear();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // Generate random 4-digit suffix
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const code = `PPM-${targetYear}-${suffix}`;

    // Check uniqueness
    const { data, error } = await supabase
      .from('ppm_meetings')
      .select('meeting_code', { count: 'exact', head: true })
      .eq('meeting_code', code);

    if (error) {
      console.error('Error checking meeting code uniqueness:', error);
      // On error, still return the code (will likely succeed)
      return code;
    }

    if (!data || data.length === 0) {
      return code;
    }

    attempts++;
  }

  // Fallback: use timestamp-based suffix
  const fallback = `PPM-${targetYear}-${Date.now().toString().slice(-4)}`;
  return fallback;
}

//
// Formats a date string into a long Indonesian format
// e.g. "Sabtu, 8 Agustus 2026"
//
export function formatDateLongID(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

//
// Formats a time string (HH:MM) into Indonesian time format
//
export function formatTimeID(timeString) {
  if (!timeString) return '-';
  // Handle both "HH:MM:SS" and "HH:MM"
  const parts = timeString.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]} WIB`;
  }
  return timeString;
}

//
// Uploads a PO document to the ppm-documents storage bucket
// Returns { url, type, name }
//
export async function uploadPPMDocument(file) {
  if (!file) {
    throw new Error('File tidak boleh kosong');
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Dokumen PO harus berupa JPG, PNG, atau PDF.');
  }

  // Validate file size (5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('Ukuran file maksimal 5MB.');
  }

  // Determine document type from file
  const ext = file.name.split('.').pop().toLowerCase();
  let docType;
  if (['jpg', 'jpeg'].includes(ext)) {
    docType = 'jpg';
  } else if (ext === 'png') {
    docType = 'png';
  } else if (ext === 'pdf') {
    docType = 'pdf';
  } else {
    throw new Error('Ekstensi file tidak didukung. Gunakan JPG, PNG, atau PDF.');
  }

  const fileExt = ext;
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `ppm/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('ppm-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('ppm-documents')
    .getPublicUrl(filePath);

  return {
    url: publicUrl,
    type: docType,
    name: file.name
  };
}

//
// Returns the display URL for a PO document based on type
//
export function getDocumentDisplayUrl(documentUrl, documentType) {
  if (!documentUrl) return '';
  return documentUrl;
}

//
// Checks if a document is an image
//
export function isImageDocument(documentType) {
  return ['jpg', 'jpeg', 'png'].includes(documentType);
}

//
// Checks if a document is a PDF
//
export function isPdfDocument(documentType) {
  return documentType === 'pdf';
}