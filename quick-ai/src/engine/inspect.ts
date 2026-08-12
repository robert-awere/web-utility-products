/**
 * CAN AI HANDLE THIS? — document/file practicality assessment.
 *
 * The browser extracts FileFacts locally (src/ui/main.ts); this module is
 * the pure, testable assessment over those facts. Token estimates are
 * heuristics and are labeled as such — no fake precision.
 */

import type { ModelProfile } from '../domain/model';
import type { Reason } from '../domain/result';

export type FileKind =
  | 'text'
  | 'markdown'
  | 'csv'
  | 'json'
  | 'code'
  | 'pdf'
  | 'office_doc'
  | 'image'
  | 'unknown';

export interface FileFacts {
  name: string;
  sizeBytes: number;
  kind: FileKind;
  /** Character count, when the file was readable as text locally. */
  textChars: number | null;
  /** PDF page-object count, when detectable. */
  pdfPages: number | null;
  /** PDF contains embedded images. */
  pdfHasImages: boolean;
  /** PDF has little/no embedded text — likely a scan needing OCR. */
  pdfLikelyScanned: boolean;
  /** Table-like structure detected (CSV, or markdown/TSV tables). */
  hasTables: boolean;
}

export type InspectVerdict = 'direct' | 'preprocess' | 'chunk' | 'impractical';

export interface DocumentAssessment {
  verdict: InspectVerdict;
  headline: string;
  /** Heuristic token estimate — always presented with its basis. */
  estTokens: number | null;
  estBasis: string;
  facts: Reason[];
  failureModes: string[];
  preprocessing: string[];
  recommendedClass: string;
  workflow: string[];
  /** Registry models whose (verified) context window fits the estimate. */
  fittingModels: string[];
}

/** ~4 chars/token for prose; PDFs estimated at ~800 tokens/page. */
export function estimateTokens(facts: FileFacts): { tokens: number | null; basis: string } {
  if (facts.textChars != null) {
    return { tokens: Math.round(facts.textChars / 4), basis: 'measured locally: characters ÷ 4' };
  }
  if (facts.kind === 'pdf' && facts.pdfPages != null && facts.pdfPages > 0) {
    return { tokens: facts.pdfPages * 800, basis: `estimated: ${facts.pdfPages} pages × ~800 tokens/page` };
  }
  if (facts.kind === 'office_doc') {
    // Office files are zipped XML; ~1 token per 6 bytes of file is a rough proxy.
    return { tokens: Math.round(facts.sizeBytes / 6), basis: 'rough estimate from compressed file size — verify with a real token count' };
  }
  if (facts.kind === 'image') return { tokens: null, basis: 'images are billed per-image by resolution, not text tokens' };
  return { tokens: null, basis: 'could not read the file as text locally' };
}

export function assessFile(facts: FileFacts, registry: ModelProfile[]): DocumentAssessment {
  const { tokens, basis } = estimateTokens(facts);
  const factLines: Reason[] = [];
  const failureModes: string[] = [];
  const preprocessing: string[] = [];
  const workflow: string[] = [];

  factLines.push({ sign: '+', text: `${facts.name} — ${fmtBytes(facts.sizeBytes)}, detected as ${facts.kind.replace('_', ' ')}` });
  if (tokens != null) factLines.push({ sign: '+', text: `~${tokens.toLocaleString('en-US')} tokens (${basis})` });
  else factLines.push({ sign: '△', text: `token estimate unavailable — ${basis}` });
  if (facts.pdfPages != null) factLines.push({ sign: '+', text: `~${facts.pdfPages} pages` });
  if (facts.hasTables) factLines.push({ sign: '△', text: 'contains table structures — layout can be lost in plain-text extraction' });
  if (facts.pdfHasImages) factLines.push({ sign: '△', text: 'contains embedded images/figures — text-only processing loses them' });

  // Failure modes and preprocessing, by kind.
  if (facts.kind === 'pdf' && facts.pdfLikelyScanned) {
    failureModes.push('This PDF appears to be scanned (little embedded text): a text-only pipeline reads almost nothing from it.');
    preprocessing.push('Run OCR first (or use a vision-capable model that reads page images directly), then spot-check 2–3 pages for OCR quality.');
  }
  if (facts.hasTables) {
    failureModes.push('Tables often scramble when flattened to plain text — numbers can silently land in wrong columns.');
    preprocessing.push('Extract tables to CSV/structured form separately, or use a model/tool that preserves layout.');
  }
  if (facts.pdfHasImages) {
    failureModes.push('Figures and diagrams are invisible to text-only processing; conclusions that depend on them will be wrong.');
    preprocessing.push('Use a multimodal model that accepts page images, or extract figures separately.');
  }
  if (facts.kind === 'image') {
    failureModes.push('This is an image: any model without vision support cannot process it at all.');
  }
  if (facts.kind === 'unknown') {
    failureModes.push('Unrecognized format — conversion to text/PDF is required before any model can use it.');
    preprocessing.push('Convert to a standard format (text, PDF, or images) first.');
  }

  // Context fit against the registry (verified limits only).
  const fittingModels = tokens == null
    ? []
    : registry
        .filter((m) => m.contextLimit.value != null && m.contextLimit.value >= tokens)
        .map((m) => m.model);

  // Verdict.
  let verdict: InspectVerdict;
  let headline: string;
  const needsPreprocessing = preprocessing.length > 0;
  if (facts.kind === 'unknown') {
    verdict = 'impractical';
    headline = 'Not directly — convert the file first.';
  } else if (tokens != null && fittingModels.length === 0) {
    verdict = 'chunk';
    headline = 'Not in one pass — chunk it or use retrieval.';
    failureModes.push('The estimated size exceeds every verified context window in the registry.');
    workflow.push('Split by structure (chapters/sections), process each chunk, then merge — or index it and retrieve only relevant sections per question.');
  } else if (needsPreprocessing) {
    verdict = 'preprocess';
    headline = 'Yes, with preprocessing.';
  } else {
    verdict = 'direct';
    headline = 'Yes — direct processing is practical.';
  }

  // Recommended model class.
  let recommendedClass: string;
  if (facts.kind === 'image' || facts.pdfHasImages || facts.pdfLikelyScanned) {
    recommendedClass = tokens != null && tokens > 100_000
      ? 'long-context multimodal model (vision + large window)'
      : 'multimodal (vision-capable) model';
  } else if (tokens != null && tokens > 100_000) {
    recommendedClass = 'long-context model (verify the window fits before committing)';
  } else if (facts.kind === 'code') {
    recommendedClass = 'coding-capable model';
  } else {
    recommendedClass = 'any capable general model — size is not a constraint here';
  }

  // Workflow.
  if (workflow.length === 0) {
    if (needsPreprocessing) workflow.push('Do the preprocessing above before the first model call.');
    workflow.push('Trial on a representative slice (a few pages / one file) and check the output against the source before scaling.');
  }
  if (tokens != null && tokens > 50_000) {
    workflow.push('Ask questions against the document rather than requesting one giant summary — targeted extraction degrades less.');
  }

  return {
    verdict,
    headline,
    estTokens: tokens,
    estBasis: basis,
    facts: factLines,
    failureModes,
    preprocessing,
    recommendedClass,
    workflow,
    fittingModels,
  };
}

function fmtBytes(n: number): string {
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
