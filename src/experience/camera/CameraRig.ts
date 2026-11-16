import { Quaternion, Vector3, type PerspectiveCamera } from 'three';
import type { CameraPose } from '../contracts';

export type CameraIntent = { blend: number; snap: boolean };

export class CameraRig {
  private position = new Vector3();
  private quaternion = new Quaternion();
  private fromPosition = new Vector3();
  private fromQuaternion = new Quaternion();
  private fov = 50;
  private near = 0.1;
  private far = 100;
  private snap = true;

  setPoses(from: CameraPose, to: CameraPose, intent: CameraIntent) {
    const t = Math.max(0, Math.min(1, intent.blend));
    const eased = t * t * (3 - 2 * t);
    this.fromPosition.fromArray(from.position);
    this.fromQuaternion.fromArray(from.quaternion);
    this.position.fromArray(to.position).lerp(this.fromPosition, 1 - eased);
    this.quaternion.fromArray(to.quaternion).slerp(this.fromQuaternion, 1 - eased);
    this.fov = from.fov + (to.fov - from.fov) * eased;
    this.near = from.near + (to.near - from.near) * eased;
    this.far = from.far + (to.far - from.far) * eased;
    this.snap ||= intent.snap;
  }

  apply(camera: PerspectiveCamera, delta: number) {
    const weight = this.snap ? 1 : 1 - Math.exp(-20 * delta);
    camera.position.lerp(this.position, weight);
    camera.quaternion.slerp(this.quaternion, weight);
    camera.fov += (this.fov - camera.fov) * weight;
    camera.near = this.near;
    camera.far = this.far;
    camera.updateProjectionMatrix();
    this.snap = false;
  }
}
