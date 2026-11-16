import type { SceneSnapshot } from '../contracts';

export type RobotState = 'sleep' | 'waking' | 'interacting' | 'performing' | 'transitioning' | 'guiding' | 'idle' | 'watching';
export type Reaction = { name: 'nod' | 'tilt' | 'React'; startedAt: number; duration: number; priority: number };
export type RobotEvent = { type: 'narrative'; snapshot: SceneSnapshot } | { type: 'reaction'; name: Reaction['name']; now: number; duration: number; priority?: number } | { type: 'cancel' } | { type: 'reset' };

export function narrativeState(snapshot: SceneSnapshot): RobotState {
  if (snapshot.robot.kind === 'clip') {
    if (snapshot.robot.name === 'Sleep') return 'sleep';
    if (snapshot.robot.name === 'WakeUp') return 'waking';
    if (snapshot.robot.name === 'Wave') return 'performing';
    if (snapshot.robot.name === 'Draw') return 'performing';
  }
  return (snapshot.visual.robotState as RobotState | undefined) ?? 'idle';
}

export class RobotFSM {
  state: RobotState = 'sleep';
  reaction: Reaction | null = null;
  private overlay: Reaction = { name: 'nod', startedAt: 0, duration: 0, priority: 1 };
  private snapshot: SceneSnapshot | null = null;

  seek(snapshot: SceneSnapshot) {
    this.snapshot = snapshot;
    this.state = narrativeState(snapshot);
    this.reaction = null;
  }

  observe(snapshot: SceneSnapshot) { if (snapshot !== this.snapshot) this.seek(snapshot); }

  setState(state: RobotState) { if (state !== this.state) { this.state = state; this.reaction = null; } }

  react(name: Reaction['name'], now: number, duration: number, priority = 1) {
    if (!this.canLook) return;
    if (this.reaction && now - this.reaction.startedAt < this.reaction.duration && this.reaction.priority > priority) return;
    this.overlay.name = name;
    this.overlay.startedAt = now;
    this.overlay.duration = Math.max(0, Math.min(1.2, duration));
    this.overlay.priority = priority;
    this.reaction = this.overlay.duration > 0 ? this.overlay : null;
  }

  send(event: RobotEvent) {
    switch (event.type) {
      case 'reset': this.snapshot = null; this.state = 'sleep'; this.reaction = null; break;
      case 'cancel': this.reaction = null; break;
      case 'narrative':
        this.observe(event.snapshot);
        break;
      case 'reaction': this.react(event.name, event.now, event.duration, event.priority); break;
    }
  }

  tick(now: number) {
    if (this.reaction && (now < this.reaction.startedAt || now - this.reaction.startedAt >= this.reaction.duration)) this.reaction = null;
  }

  get canLook() { return this.state === 'idle' || this.state === 'watching' || this.state === 'interacting' || this.state === 'guiding'; }
}
