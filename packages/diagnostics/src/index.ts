/** Shared, editor-agnostic diagnostic contracts. All positions are 0-based UTF-16; ends are exclusive. */
/**
 * @beta
 */
export interface SourcePosition {
  line: number;
  column: number;
}

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
export interface SourceReference {
  file: string;
  range: SourceRange;
}

/**
 * @beta
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

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
