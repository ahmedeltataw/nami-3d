import type { ComponentType } from 'react';
import type { Ctx, SceneId, SceneSnapshot } from '../contracts';
import type { AssetResidency } from '../assets/residency';
import type { ExperienceStore } from '../store';
import { s01Registration } from './s01/registration';
import { s02Registration } from './s02/registration';
import { s03Registration } from './s03/registration';
import { s04Registration } from './s04/registration';
import { s05Registration } from './s05/registration';
import { s06Registration } from './s06/registration';
import { s07Registration } from './s07/registration';

export type SceneProps = {
  register: (id: SceneId, ctx: Ctx | null) => void;
  residency: AssetResidency | null;
  onError: () => void;
};
export type SceneRegistration = {
  id: SceneId;
  Component: ComponentType<SceneProps>;
  sample?: (snapshot: SceneSnapshot) => Partial<ExperienceStore>;
};

export const sceneRegistrations: readonly SceneRegistration[] = [
  s01Registration,
  s02Registration,
  s03Registration,
  s04Registration,
  s05Registration,
  s06Registration,
  s07Registration,
];
