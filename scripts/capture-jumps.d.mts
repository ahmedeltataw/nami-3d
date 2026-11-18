import type { Page } from '@playwright/test';

export type JumpDescriptor = {
  boundary: number;
  id: string;
  slug: string;
  from: string;
  to: string;
  departure: number;
  length: number;
};

export type CaptureDirection = 'forward' | 'reverse' | 'direct-seek';

export type CapturedFrameEntry = {
  direction: CaptureDirection;
  t: number;
  label: string;
  file: string;
  sha256: string;
  canvasSha256: string;
  pixelHash: number;
  colorCount: number;
  owner: string;
  scene: string;
  cameraZ: number;
  washOpacity: number;
  transitionProgress: number;
};

export type JumpCaptureManifest = {
  jump: string;
  slug: string;
  boundary: number;
  from: string;
  to: string;
  ambientTime: number;
  introTime: number;
  viewport: { width: number; height: number };
  tValues: number[];
  directions: CaptureDirection[];
  frames: CapturedFrameEntry[];
  parity: {
    allMatch: boolean;
    mismatches: Array<{
      t: number;
      label: string;
      expectedDirection: CaptureDirection;
      expectedCanvasSha256: string;
      actualDirection: CaptureDirection;
      actualCanvasSha256: string;
    }>;
  };
  generatedAt: string;
};

export type SettledFrameSample = {
  hash: number;
  colorCount: number;
  settled: boolean;
  dataUrl: string;
  owner: string;
  scene: string;
  b: number;
  progress: number;
  cameraZ: number;
  transition: { id: string; progress: number } | null;
  washOpacity: number;
  canvasPng: Buffer;
  canvasSha256: string;
};

export type CaptureJumpOptions = {
  ambientTime?: number;
  introTime?: number;
  tValues?: number[];
  directions?: CaptureDirection[];
  outDir?: string;
  writeFiles?: boolean;
  canvasOnly?: boolean;
};

export const SCENE_IDS: readonly string[];
export const SCROLL_BUDGETS: readonly number[];
export const TOTAL_BUDGET: number;
export const DEFAULT_JUMP_T: readonly number[];
export const CAPTURE_DIRECTIONS: readonly CaptureDirection[];
export const JUMPS: readonly JumpDescriptor[];
export const JUMP_IDS: readonly string[];
export const JUMP_SLUGS: readonly string[];

export function formatJumpT(t: number): string;
export function captureFrameFileName(direction: CaptureDirection, t: number): string;
export function contactFrameRelativePath(slug: string, fileName: string): string;
export function progressForJump(boundary: number | string, t: number): number;
export function resolveJumpTargets(input?: string): JumpDescriptor[];
export function parseTValues(input?: string): number[];
export function waitForSettledFrame(
  page: Page,
  expectedMounted?: string[],
  options?: { includePng?: boolean },
): Promise<SettledFrameSample>;
export function captureJumpFrames(
  page: Page,
  jumpInput: string | JumpDescriptor,
  options?: CaptureJumpOptions,
): Promise<JumpCaptureManifest>;
export function runCaptureJumpsCli(argv?: string[]): Promise<
  Array<{
    jump: string;
    slug: string;
    frames: number;
    allMatch: boolean;
    manifestPath: string;
  }>
>;
