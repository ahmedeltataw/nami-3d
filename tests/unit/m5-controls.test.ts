import { describe, expect, it } from 'vitest';
import { createRouteTransition } from '../../src/experience/route-transition';
import { directorReducer, nextDirectorScene } from '../../src/experience/director';
import { createFactory } from '../../src/experience/factory';

describe('route transition', () => {
  it('covers, switches and reveals', () => {
    const phases: string[] = [];
    const machine = createRouteTransition(phase => phases.push(phase));
    const id = machine.start();
    expect(machine.covered(id)).toBe(true);
    machine.reveal(id); machine.finish(id);
    expect(phases).toEqual(['cover', 'switch', 'reveal', 'idle']);
  });
  it('invalidates cancelled and superseded navigation, including history changes', () => {
    const machine = createRouteTransition(() => {});
    const first = machine.start();
    const second = machine.start();
    expect(machine.covered(first)).toBe(false);
    machine.cancel();
    machine.reveal(second);
    expect(machine.phase).toBe('idle');
    const history = machine.start();
    machine.reveal(history); machine.finish(history);
    expect(machine.phase).toBe('idle');
  });
});

it('restores the saved factory scene and local progress once', () => {
  const factory = createFactory();
  const position = { scene: 's03' as const, local: .4, scrollY: 600 };
  factory.open(position);
  factory.open({ scene: 's01', local: 0, scrollY: 0 });
  expect(factory.close()).toEqual(position);
  expect(factory.close()).toBeNull();
});

describe('director', () => {
  it('starts, pauses, resumes and exits on manual input', () => {
    let state = directorReducer('idle', 'start');
    expect(state).toBe('playing');
    state = directorReducer(state, 'pause');
    expect(state).toBe('paused');
    state = directorReducer(state, 'resume');
    expect(state).toBe('playing');
    expect(directorReducer(state, 'manual')).toBe('idle');
    expect(directorReducer('idle', 'start', true)).toBe('step');
    expect(directorReducer('step', 'exit')).toBe('idle');
    expect(nextDirectorScene('s03')).toBe('s04');
    expect(nextDirectorScene('s07')).toBeNull();
  });
});
