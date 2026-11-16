export type ChoiceId = 'website' | 'mobile' | 'marketing' | 'other';

export const CHOICE_IDS: readonly ChoiceId[] = ['website', 'mobile', 'marketing', 'other'] as const;

export const TRANSITION_DURATION = 0.9; // 0.9 seconds as specified

export interface ChoiceState {
  currentChoice: ChoiceId | null;
  /** Shape currently forming or formed */
  targetChoice: ChoiceId | null;
  /** Shape transitioning from (e.g. 'core' or previous choice) */
  baseChoice: ChoiceId | 'core';
  /** Start time in seconds */
  startTime: number;
  /** Duration of transition in seconds */
  duration: number;
  /** Base progress when rebased [0..1] */
  baseProgress: number;
}

export function createChoiceStateMachine() {
  let state: ChoiceState = {
    currentChoice: null,
    targetChoice: null,
    baseChoice: 'core',
    startTime: 0,
    duration: TRANSITION_DURATION,
    baseProgress: 0,
  };

  return {
    getState(): Readonly<ChoiceState> {
      return state;
    },

    select(choice: ChoiceId, now: number): ChoiceState {
      // If already transitioning, cancel previous and rebase from current interpolation (no queue)
      if (state.targetChoice && state.targetChoice !== choice) {
        state = {
          currentChoice: choice,
          targetChoice: choice,
          baseChoice: state.targetChoice,
          startTime: now,
          duration: TRANSITION_DURATION,
          baseProgress: 0, // starts a fresh 0.9s transition to the new target
        };
        return state;
      }

      state = {
        currentChoice: choice,
        targetChoice: choice,
        baseChoice: state.currentChoice ?? 'core',
        startTime: now,
        duration: TRANSITION_DURATION,
        baseProgress: 0,
      };
      return state;
    },

    reset(): ChoiceState {
      state = {
        currentChoice: null,
        targetChoice: null,
        baseChoice: 'core',
        startTime: 0,
        duration: TRANSITION_DURATION,
        baseProgress: 0,
      };
      return state;
    },

    sample(now: number): {
      coreOpacity: number;
      coreScale: number;
      shapeOpacity: number;
      shapeScale: number;
      phase: 'dissolve' | 'assemble' | 'idle' | 'assembled';
      progress: number;
    } {
      if (!state.targetChoice) {
        return {
          coreOpacity: 1,
          coreScale: 1,
          shapeOpacity: 0,
          shapeScale: 0,
          phase: 'idle',
          progress: 0,
        };
      }

      const elapsed = Math.max(0, now - state.startTime);
      const totalProgress = Math.min(1, elapsed / state.duration);

      // First half (0..0.45s / 0..0.5 progress): dissolve core
      // Second half (0.45..0.9s / 0.5..1.0 progress): assemble shape
      if (totalProgress < 0.5) {
        const dissolve = totalProgress * 2; // 0..1
        return {
          coreOpacity: 1 - dissolve,
          coreScale: 1 + dissolve * 0.4,
          shapeOpacity: 0,
          shapeScale: 0,
          phase: 'dissolve',
          progress: totalProgress,
        };
      }

      const assemble = (totalProgress - 0.5) * 2; // 0..1
      return {
        coreOpacity: 0,
        coreScale: 0,
        shapeOpacity: assemble,
        shapeScale: 0.5 + assemble * 0.5,
        phase: totalProgress >= 1 ? 'assembled' : 'assemble',
        progress: totalProgress,
      };
    },
  };
}

export type ChoiceStateMachine = ReturnType<typeof createChoiceStateMachine>;
