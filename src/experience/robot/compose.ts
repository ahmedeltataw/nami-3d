import { AnimationMixer, Euler, LoopOnce, LoopRepeat, Quaternion, Vector3, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import type { ClipName, RobotDirective } from '../contracts';
import type { Reaction } from './fsm';
import { floatRoll, floatY, lookAt, type Gaze } from './procedural';

type Transform = { node: Object3D; position: Vector3; quaternion: Quaternion; scale: Vector3 };
export type PoseLayers = { time: number; delta: number; reduced: boolean; canLook: boolean; target: Vector3 | null; reaction: Reaction | null };

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
  object: Object3D | null = null;

  bind(object: Object3D, clips: readonly AnimationClip[]) {
    const previous = new Map<string, Transform>();
    for (const [name, node] of this.nodes) previous.set(name, { node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() });
    this.disposeMixer();
    this.object = object;
    this.nodes = new Map();
    this.rest = [];
    object.traverse(node => {
      this.nodes.set(node.name, node);
      this.rest.push({ node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() });
      const old = previous.get(node.name);
      if (old) { node.position.copy(old.position); node.quaternion.copy(old.quaternion); node.scale.copy(old.scale); }
    });
    this.mixer = new AnimationMixer(object);
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(clip.name === 'Idle' || clip.name === 'Sleep' ? LoopRepeat : LoopOnce, Infinity);
      action.clampWhenFinished = true;
      this.actions.set(clip.name as ClipName, action);
    }
  }

  resetGaze() { this.gaze.yaw = this.gaze.pitch = this.gaze.eyeYaw = this.gaze.eyePitch = 0; }

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

  compose(directive: RobotDirective, layers: PoseLayers) {
    if (!this.object || !this.mixer) return;
    // Deactivation restores mixer originals. Restore imported rest AFTER deactivation.
    this.mixer.stopAllAction();
    this.restore();
    if (!layers.reduced && directive.kind === 'clip') {
      const action = this.actions.get(directive.name);
      if (action) {
        action.reset().play();
        const duration = action.getClip().duration;
        action.time = directive.name === 'Idle' || directive.name === 'Sleep'
          ? ((directive.timeSeconds % duration) + duration) % duration
          : Math.max(0, Math.min(duration, directive.timeSeconds));
        action.setEffectiveWeight(Math.max(0, Math.min(1, directive.weight)));
        this.mixer.update(0);
      }
    }
    if (layers.reduced) { this.resetGaze(); this.object.updateMatrixWorld(true); return; }
    if (directive.kind === 'point') this.rotate('Shoulder_R', -0.8, 0, -0.45);
    const root = this.nodes.get('Root');
    if (root && layers.canLook) {
      root.position.y += floatY(layers.time);
      this.rotate('Root', 0, 0, floatRoll(layers.time));
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
    this.rotate('Head', this.gaze.pitch, this.gaze.yaw);
    this.rotate('Eye_L', this.gaze.eyePitch, this.gaze.eyeYaw);
    this.rotate('Eye_R', this.gaze.eyePitch, this.gaze.eyeYaw);
    const reaction = layers.reaction;
    if (reaction) {
      const phase = (layers.time - reaction.startedAt) / reaction.duration;
      if (phase >= 0 && phase < 1) {
        const angle = Math.sin(phase * Math.PI) * 8 * Math.PI / 180;
        this.rotate('Head', reaction.name === 'nod' ? angle : 0, 0, reaction.name === 'tilt' ? angle : 0);
      }
    }
    this.object.updateMatrixWorld(true);
  }

  private disposeMixer() {
    this.mixer?.stopAllAction();
    if (this.object) this.mixer?.uncacheRoot(this.object);
    this.actions.clear();
    this.mixer = null;
  }
  dispose() { this.disposeMixer(); this.nodes.clear(); this.rest = []; this.object = null; }
}
