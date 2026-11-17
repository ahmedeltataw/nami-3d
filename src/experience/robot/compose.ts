import { AnimationMixer, Euler, LoopOnce, LoopRepeat, Quaternion, Vector3, type AnimationAction, type AnimationClip, type Material, type Object3D } from 'three';
import type { ClipName, RobotDirective } from '../contracts';
import type { Reaction } from './fsm';
import { floatRoll, floatY, lookAt, type Gaze } from './procedural';

type Transform = { node: Object3D; position: Vector3; quaternion: Quaternion; scale: Vector3 };
export type PoseLayers = { time: number; ambientTime?: number; ambientWeight?: number; transitionPose?: import('../contracts').RobotPoseIntent; delta: number; reduced: boolean; canLook: boolean; target: Vector3 | null; reaction: Reaction | null; headPitch?: number; eyeOpen?: number; headNear?: boolean; focus?: number };

// Owns every final joint transform, including mixer sampling and LOD pose transfer.
export class RobotComposer {
  private mixer: AnimationMixer | null = null;
  private actions = new Map<ClipName, AnimationAction>();
  private rest: Transform[] = [];
  private nodes = new Map<string, Object3D>();
  private offset = new Quaternion();
  private euler = new Euler(0, 0, 0, 'YXZ');
  private direction = new Vector3();
  private origin = new Vector3();
  private gaze: Gaze = { yaw: 0, pitch: 0, eyeYaw: 0, eyePitch: 0 };
  private materials = new Map<Material, { opacity: number; transparent: boolean }>();
  object: Object3D | null = null;

  bind(object: Object3D, clips: readonly AnimationClip[]) {
    const previous = new Map<string, Transform>();
    const baseline = new Map(this.rest.map(rest => [rest.node.name, rest]));
    for (const [name, node] of this.nodes) previous.set(name, { node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() });
    this.disposeMixer();
    this.object = object;
    this.nodes = new Map();
    this.rest = [];
    object.traverse(node => {
      this.nodes.set(node.name, node);
      // LOD exports can carry a different unkeyed hand pose. Keep the established
      // rig baseline so the next deterministic sample preserves the transferred pose.
      const rest = baseline.get(node.name) ?? node;
      this.rest.push({ node, position: rest.position.clone(), quaternion: rest.quaternion.clone(), scale: rest.scale.clone() });
      const old = previous.get(node.name);
      if (old) { node.position.copy(old.position); node.quaternion.copy(old.quaternion); node.scale.copy(old.scale); }
      if ('material' in node) {
        const materials = (Array.isArray(node.material) ? node.material : [node.material]) as Material[];
        for (const material of materials) this.materials.set(material, { opacity: material.opacity, transparent: material.transparent });
      }
    });
    this.mixer = new AnimationMixer(object);
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(['Idle', 'Sleep', 'Fly', 'Thinking'].includes(clip.name) ? LoopRepeat : LoopOnce, Infinity);
      action.clampWhenFinished = true;
      this.actions.set(clip.name as ClipName, action);
    }
  }

  resetGaze() { this.gaze.yaw = this.gaze.pitch = this.gaze.eyeYaw = this.gaze.eyePitch = 0; }

  worldPosition(name: string, out: Vector3) {
    const node = this.nodes.get(name);
    if (!node) return false;
    node.getWorldPosition(out);
    return true;
  }

  private restore() {
    for (let i = 0; i < this.rest.length; i++) {
      const rest = this.rest[i];
      rest.node.position.copy(rest.position);
      rest.node.quaternion.copy(rest.quaternion);
      rest.node.scale.copy(rest.scale);
    }
  }

  private rotate(name: string, pitch: number, yaw: number, roll = 0) {
    const node = this.nodes.get(name);
    if (!node) return;
    this.euler.set(pitch, yaw, roll, 'YXZ');
    node.quaternion.multiply(this.offset.setFromEuler(this.euler));
  }

  private sampleClip(directive: RobotDirective, weight: number) {
    if (directive.kind !== 'clip') return;
    const action = this.actions.get(directive.name) ?? this.actions.get('Idle');
    if (!action) return;
    action.reset().play();
    const duration = action.getClip().duration;
    action.time = ['Idle', 'Sleep', 'Fly', 'Thinking'].includes(action.getClip().name)
      ? ((directive.timeSeconds % duration) + duration) % duration
      : Math.max(0, Math.min(duration, directive.timeSeconds));
    action.setEffectiveWeight(Math.max(0, Math.min(1, directive.weight * weight)));
  }

  materialLayer(dissolve: number) {
    for (const [material, baseline] of this.materials) {
      material.opacity = baseline.opacity * (1 - Math.max(0, Math.min(1, dissolve)));
      const transparent = baseline.transparent || dissolve > 0;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
    }
  }

  compose(directive: RobotDirective, layers: PoseLayers) {
    if (!this.object || !this.mixer) return;
    // Deactivation restores mixer originals. Restore imported rest AFTER deactivation.
    this.mixer.stopAllAction();
    this.restore();
    const pose = layers.transitionPose;
    if (!layers.reduced) {
      const weight = pose?.clipB ? pose.weight : 0;
      this.sampleClip(pose?.clipA ?? directive, 1 - weight);
      if (pose?.clipB) this.sampleClip(pose.clipB, weight);
      this.mixer.update(0);
    }
    if (pose?.pose === 'rest' && pose.poseWeight > 0) {
      const weight = Math.max(0, Math.min(1, pose.poseWeight));
      for (const rest of this.rest) {
        rest.node.position.lerp(rest.position, weight);
        rest.node.quaternion.slerp(rest.quaternion, weight);
        rest.node.scale.lerp(rest.scale, weight);
      }
    }
    if (layers.reduced) { this.resetGaze(); this.object.updateMatrixWorld(true); return; }
    if (directive.kind === 'point') {
      const shoulder = this.nodes.get('Shoulder_R');
      if (shoulder && layers.target) {
        this.object.updateWorldMatrix(true, true);
        shoulder.getWorldPosition(this.origin);
        this.direction.copy(layers.target);
        this.object.worldToLocal(this.direction);
        this.object.worldToLocal(this.origin);
        this.direction.sub(this.origin);
        const pitch = -Math.atan2(this.direction.y, Math.hypot(this.direction.x, this.direction.z));
        const yaw = Math.atan2(this.direction.x, this.direction.z);
        this.rotate('Shoulder_R', Math.max(-1.3, Math.min(.3, pitch - .8)), Math.max(-.6, Math.min(.6, yaw)), -.45);
      } else this.rotate('Shoulder_R', -0.8, 0, -0.45);
    }
    const reaction = layers.reaction;
    const phase = reaction ? (layers.time - reaction.startedAt) / reaction.duration : -1;
    const reactAction = reaction?.name === 'React' && phase >= 0 && phase < 1 ? this.actions.get('React') : undefined;
    if (reactAction) {
      reactAction.reset().play();
      reactAction.time = phase * reactAction.getClip().duration;
      reactAction.setEffectiveWeight(Math.sin(phase * Math.PI));
      this.mixer.update(0);
    }
    const root = this.nodes.get('Root');
    if (root && !(directive.kind === 'clip' && directive.name === 'Idle')) {
      const weight = layers.ambientWeight ?? Number(layers.canLook);
      root.position.y += floatY(layers.ambientTime ?? layers.time) * weight;
      this.rotate('Root', 0, 0, floatRoll(layers.ambientTime ?? layers.time) * weight);
    }
    if (layers.canLook && layers.target) {
      this.object.updateWorldMatrix(true, true);
      const head = this.nodes.get('Head');
      if (head) {
        head.getWorldPosition(this.origin);
        this.direction.copy(layers.target);
        this.object.worldToLocal(this.direction);
        this.object.worldToLocal(this.origin);
        this.direction.sub(this.origin);
        lookAt(this.direction.x, this.direction.y, this.direction.z, this.gaze, layers.delta, this.gaze);
      }
    } else this.resetGaze();
    const head = this.nodes.get('Head');
    if (head && layers.headPitch !== undefined) {
      this.euler.setFromQuaternion(head.quaternion, 'YXZ');
      this.euler.x = layers.headPitch;
      head.quaternion.setFromEuler(this.euler);
    }
    this.rotate('Head', this.gaze.pitch, this.gaze.yaw, layers.canLook && layers.headNear ? Math.PI * 8 / 180 : 0);
    this.rotate('Eye_L', this.gaze.eyePitch, this.gaze.eyeYaw);
    this.rotate('Eye_R', this.gaze.eyePitch, this.gaze.eyeYaw);
    for (const name of ['Eye_L', 'Eye_R']) {
      const eye = this.nodes.get(name);
      if (eye && layers.eyeOpen !== undefined) eye.scale.y = Math.max(0, Math.min(1, layers.eyeOpen));
    }
    if (layers.focus) {
      this.rotate('Head', layers.focus * 3 * Math.PI / 180, 0);
    }
    if (reaction && !reactAction) {
      if (phase >= 0 && phase < 1) {
        const angle = Math.sin(phase * Math.PI) * 8 * Math.PI / 180;
        this.rotate('Head', reaction.name === 'nod' || reaction.name === 'React' ? angle : 0, 0, reaction.name === 'tilt' ? angle : 0);
      }
    }
    this.object.updateMatrixWorld(true);
  }

  private disposeMixer() {
    this.materialLayer(0);
    this.materials.clear();
    this.mixer?.stopAllAction();
    if (this.object) this.mixer?.uncacheRoot(this.object);
    this.actions.clear();
    this.mixer = null;
  }
  dispose() { this.disposeMixer(); this.nodes.clear(); this.rest = []; this.object = null; }
}
