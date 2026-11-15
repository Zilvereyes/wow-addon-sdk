/** Shared, editor-agnostic diagnostic contracts. All positions are 0-based UTF-16; ends are exclusive. */
export interface SourcePosition {
    line: number;
    column: number;
}
export interface SourceRange {
    start: SourcePosition;
    end: SourcePosition;
}
export interface SourceReference {
    file: string;
    range: SourceRange;
}
export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export interface Diagnostic {
    code: string;
    severity: DiagnosticSeverity;
    message: string;
    source: SourceReference;
    related?: SourceReference[];
}
