import type { Group } from 'three';
import type { Profile } from './profile';
import type { InteractionState } from './interaction';
import type { AssetKey } from './assets/manifest';

export type { Profile, InteractionState, AssetKey };
export type SceneId = 's01' | 's02' | 's03' | 's04' | 's05' | 's06' | 's07';
export type ClipName = 'Idle' | 'Sleep' | 'WakeUp' | 'LookAround' | 'Wave' | 'Draw' | 'Point' | 'Present' | 'ChargeEnergy' | 'React';
export type PoseName = 'rest';
export type EffectSpec = { id: string; from: number; to: number };
export type Ctx = { root: Group; ambient: number; reducedMotion: boolean };
export type SampleInput = { local:number; viewport:{w:number;h:number;dpr:number}; profile:Profile; interaction:InteractionState; seed:number; ambient:number; introSeconds?:number };
export type SceneSnapshot = { camera: CameraPose; robot: RobotDirective; visual: Record<string, unknown> };
export interface SceneDef { id:'s01'|'s02'|'s03'|'s04'|'s05'|'s06'|'s07'; assets:AssetKey[]; sample(i:SampleInput):SceneSnapshot; apply(s:SceneSnapshot, ctx:Ctx):void; effects?:EffectSpec[]; poster:string }
export type RobotDirective = {kind:'clip';name:ClipName;timeSeconds:number;weight:number} | {kind:'pose';name:PoseName} | {kind:'point';target:string} | {kind:'rest'};
export type CameraPose = { position:[number,number,number]; quaternion:[number,number,number,number]; fov:number; near:number; far:number };
