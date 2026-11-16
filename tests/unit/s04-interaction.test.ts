import { describe, expect, it } from 'vitest';
import { createExploration, createInteraction } from '../../src/experience/interaction';

describe('exploration arbitration', () => {
  it('enters and exits, blocks scroll and yields to director', () => {
    const interaction = createInteraction();
    const exploration = createExploration(interaction);
    expect(exploration.enter()).toBe(true);
    expect(exploration.active).toBe(true);
    expect(interaction.request('scroll')).toBeNull();
    expect(interaction.request('director')).not.toBeNull();
    expect(exploration.active).toBe(false);
    expect(exploration.enter()).toBe(false);
    interaction.release();
    expect(exploration.enter()).toBe(true);
    exploration.exit();
    expect(interaction.state.source).toBeNull();
    expect(exploration.active).toBe(false);
  });
});
