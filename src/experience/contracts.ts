import type { Camera, Group } from 'three';
import type { Profile } from './profile';
import type { InteractionState } from './interaction';
import type { AssetKey } from './assets/manifest';

export type { Profile, InteractionState, AssetKey };
export type SceneId = 's01' | 's02' | 's03' | 's04' | 's05' | 's06' | 's07';
export type ClipName = 'Idle' | 'Sleep' | 'WakeUp' | 'LookAround' | 'Wave' | 'Draw' | 'Point' | 'ChargeEnergy' | 'React' | 'OpenPortal' | 'Fly' | 'Present' | 'Thinking' | 'Grab' | 'Celebrate' | 'Guide';
export type PoseName = 'rest';
export type EffectSpec = { id: string; from: number; to: number };
export type Ctx = { root: Group; ambient: number; ambientWeight?: number; visibility?: number; transition?: TransitionIntents | null; reducedMotion: boolean; beforeRender?: (camera: Camera) => void };
export type SampleInput = { local:number; narrativeLocal?:number; viewport:{w:number;h:number;dpr:number}; profile:Profile; interaction:InteractionState; seed:number; ambient:number; ambientWeight?:number; introSeconds?:number };
export type SceneSnapshot = { camera: CameraPose; robot: RobotDirective; visual: Record<string, unknown> };
export interface SceneDef { id:'s01'|'s02'|'s03'|'s04'|'s05'|'s06'|'s07'; assets:AssetKey[]; sample(i:SampleInput):SceneSnapshot; apply(s:SceneSnapshot, ctx:Ctx):void; effects?:EffectSpec[]; poster:string }
export type RobotDirective = {kind:'clip';name:ClipName;timeSeconds:number;weight:number} | {kind:'pose';name:PoseName} | {kind:'point';target:string} | {kind:'rest'};
export type CameraPose = { position:[number,number,number]; quaternion:[number,number,number,number]; fov:number; near:number; far:number };

export type TransitionId = 's01->s02' | 's02->s03' | 's03->s04' | 's04->s05' | 's05->s06' | 's06->s07';
export type CameraTransitionIntent = { from: CameraPose; to: CameraPose; blend: number };
export type RobotTransitionIntent = { directive: RobotDirective; position: [number, number, number] | null; quaternion: [number, number, number, number] | null };
export type ParticleTransitionIntent = { progress: number; opacity: number };
export type LightingTransitionIntent = { intensity: number; color: [number, number, number] };
export type UITransitionIntent = { aProgress: number; bProgress: number; jumpProgress: number };
export type RobotPoseIntent = { clipA: RobotDirective; clipB: RobotDirective | null; weight: number; pose: PoseName; poseWeight: number };
export type TransitionIntents = {
  fromVisibility: number; toVisibility: number;
  camera: CameraTransitionIntent; robot: RobotTransitionIntent;
  particles: ParticleTransitionIntent | null;
  lighting: LightingTransitionIntent | null;
  owner: SceneId;
  portal: { anchor: [number, number, number]; radius: number; open: number; previewOn: boolean };
  wash: number; dissolve: number; robotPose: RobotPoseIntent;
  background: [number, number, number] | null;
  fog: { color: [number, number, number]; density: number } | null;
  exposure: number;
  lights: { aWeight: number; bWeight: number };
  ui: UITransitionIntent;
};
export type TransitionSnapshot = TransitionIntents & { id: TransitionId; progress: number };
export type TransitionInput = SampleInput & { active: SceneId; from: SceneSnapshot; to: SceneSnapshot; camera: CameraTransitionIntent };
// Apply publishes intents only. CameraRig and RobotComposer retain transform ownership.
export type TransitionCtx = { intents: TransitionIntents | null };
export interface TransitionDef {
  from: SceneId; to: SceneId;
  window: readonly [startLocal: number, endLocal: number];
  sample(t: number, input: TransitionInput): TransitionSnapshot;
  apply(snapshot: TransitionSnapshot, ctx: TransitionCtx): void;
}
