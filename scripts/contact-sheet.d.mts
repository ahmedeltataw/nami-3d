export type FrameDirection = 'fwd' | 'rev' | 'seek';
export type FrameKind = 'jump' | 'scene';
export interface ContactFrame {
  file: string;
  card: string;
  kind: FrameKind;
  id: string;
  direction: FrameDirection;
  t?: number;
  b?: number;
  note?: string;
  missing?: boolean;
  label?: string;
}
export interface ContactSheetGroup {
  kind: FrameKind;
  card: string;
  id: string;
  frames: ContactFrame[];
}
export const DEFAULT_JUMP_TIMES: number[];
export function parseFrameName(file: string): ContactFrame;
export function orderFrames<T extends ContactFrame>(frames: T[]): T[];
export function groupFrames(frames: ContactFrame[]): ContactSheetGroup[];
export function readFrames(options: { framesPath?: string; dir?: string }): Promise<ContactFrame[]>;
export function sheetFrames(group: ContactSheetGroup): ContactFrame[];
export function sheetSections(group: ContactSheetGroup): { direction: FrameDirection | null; label: string; frames: ContactFrame[] }[];
export function renderSheets(groups: ContactSheetGroup[], outDir: string, options?: { browserType?: unknown; date?: string }): Promise<{ filename: string; group: ContactSheetGroup }[]>;
