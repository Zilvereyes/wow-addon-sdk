/** Shared, editor-agnostic diagnostic contracts. All positions are 0-based UTF-16; ends are exclusive. */
/**
 * @beta
 */
/**
 * Shared, editor-agnostic diagnostic contracts. All positions are 0-based UTF-16; ends are exclusive.
 *
 * @beta
 */
export interface SourcePosition {
  line: number;
  column: number;
}

/**
 * @beta
 */
/**
 * @beta
 */
export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

/**
 * @beta
 */
/**
 * @beta
 */
export interface SourceReference {
  file: string;
  range: SourceRange;
}

/**
 * @beta
 */
/**
 * @beta
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * @beta
 */
/**
 * @beta
 */
export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  source: SourceReference;
  related?: SourceReference[];
}
