/**
 * Browser-side file inspection — everything here runs locally via the File
 * API. The file's bytes never leave the browser (this is what makes the
 * PROCESSED LOCALLY badge true for this tool).
 */

import type { FileFacts, FileKind } from '../engine/inspect';

const TEXT_EXTENSIONS: Record<string, FileKind> = {
  txt: 'text', md: 'markdown', markdown: 'markdown', csv: 'csv', tsv: 'csv',
  json: 'json', js: 'code', ts: 'code', py: 'code', java: 'code', go: 'code',
  rb: 'code', rs: 'code', c: 'code', cpp: 'code', h: 'code', cs: 'code',
  php: 'code', html: 'code', css: 'code', sql: 'code', sh: 'code', yaml: 'code', yml: 'code', xml: 'code',
};

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'heic']);
const OFFICE_EXTENSIONS = new Set(['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'doc', 'xls', 'ppt']);

export async function extractFileFacts(file: File): Promise<FileFacts> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const base: FileFacts = {
    name: file.name,
    sizeBytes: file.size,
    kind: 'unknown',
    textChars: null,
    pdfPages: null,
    pdfHasImages: false,
    pdfLikelyScanned: false,
    hasTables: false,
  };

  if (ext === 'pdf') {
    // Read raw bytes; count page objects and look for text/image markers.
    // Crude but local and deterministic — the assessment discloses it's an estimate.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ascii = latin1(bytes);
    const pages = (ascii.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    const hasImages = /\/Subtype\s*\/Image/.test(ascii) || /\/XObject/.test(ascii);
    const fontCount = (ascii.match(/\/Font/g) ?? []).length;
    return {
      ...base,
      kind: 'pdf',
      pdfPages: pages > 0 ? pages : Math.max(1, Math.round(file.size / 50_000)),
      pdfHasImages: hasImages,
      // A text PDF has font resources; a pure scan is images with (almost) none.
      pdfLikelyScanned: hasImages && fontCount === 0,
    };
  }

  if (IMAGE_EXTENSIONS.has(ext)) return { ...base, kind: 'image' };
  if (OFFICE_EXTENSIONS.has(ext)) return { ...base, kind: 'office_doc' };

  const kind = TEXT_EXTENSIONS[ext];
  if (kind) {
    const text = await file.text();
    return {
      ...base,
      kind,
      textChars: text.length,
      hasTables:
        kind === 'csv' ||
        /(^|\n)\|.+\|.*\n\|[\s:|-]+\|/.test(text) || // markdown table
        /\t.*\t/.test(text.slice(0, 5_000)), // tab-separated columns
    };
  }

  return base;
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}
