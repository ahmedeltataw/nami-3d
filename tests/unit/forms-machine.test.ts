import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createFormMachine } from '../../src/forms/useFormMachine';

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const testSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Email invalid'),
});

describe('createFormMachine state machine', () => {
  it('initializes in idle state with provided values', () => {
    const machine = createFormMachine({
      initialValues: { name: 'Initial', email: 'init@test.com' },
      submitFn: async () => ({ status: 'unavailable' }),
    });

    const state = machine.getState();
    expect(state.status).toBe('idle');
    expect(state.values.name).toBe('Initial');
    expect(state.isSubmitting).toBe(false);
    expect(state.errors).toEqual({});
  });

  it('restores persisted input from storage upon initialization', () => {
    const storage = new MockStorage();
    storage.setItem(
      'test.form',
      JSON.stringify({ name: 'Persisted Name', email: 'stored@test.com' })
    );

    const machine = createFormMachine({
      initialValues: { name: '', email: '' },
      storageKey: 'test.form',
      storage,
      submitFn: async () => ({ status: 'unavailable' }),
    });

    const state = machine.getState();
    expect(state.values.name).toBe('Persisted Name');
    expect(state.values.email).toBe('stored@test.com');
  });

  it('handles broken or throwing storage without crashing (try/catch guard)', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('Access denied (sandbox)');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('Access denied');
      },
    } as unknown as Storage;

    const machine = createFormMachine({
      initialValues: { name: 'Safe', email: 'safe@test.com' },
      storageKey: 'test.form',
      storage: throwingStorage,
      submitFn: async () => ({ status: 'unavailable' }),
    });

    expect(machine.getState().values.name).toBe('Safe');
    // Updating field does not throw despite throwing storage
    expect(() => machine.setFieldValue('name', 'Updated')).not.toThrow();
  });

  it('updates field value and persists to storage', () => {
    const storage = new MockStorage();
    const machine = createFormMachine({
      initialValues: { name: '', email: '' },
      storageKey: 'test.form',
      storage,
      submitFn: async () => ({ status: 'unavailable' }),
    });

    machine.setFieldValue('name', 'New Name');
    expect(machine.getState().values.name).toBe('New Name');
    expect(JSON.parse(storage.getItem('test.form')!).name).toBe('New Name');
  });

  it('transitions to idle with errors on failed schema validation', async () => {
    const machine = createFormMachine({
      initialValues: { name: '', email: 'not-an-email' },
      schema: testSchema,
      submitFn: async () => ({ status: 'success' }),
    });

    await machine.handleSubmit();
    const state = machine.getState();
    expect(state.status).toBe('idle');
    expect(state.isSubmitting).toBe(false);
    expect(state.errors.name).toBeDefined();
    expect(state.errors.email).toBeDefined();
  });

  it('enforces duplicate-submit guard', async () => {
    let callCount = 0;
    let resolveSubmit: (res: { status: 'unavailable' }) => void;
    const submitPromise = new Promise<{ status: 'unavailable' }>(resolve => {
      resolveSubmit = resolve;
    });

    const mockSubmit = vi.fn().mockImplementation(async () => {
      callCount++;
      return submitPromise;
    });

    const machine = createFormMachine({
      initialValues: { name: 'Valid', email: 'valid@example.com' },
      schema: testSchema,
      submitFn: mockSubmit,
    });

    // Fire two submissions simultaneously
    const p1 = machine.handleSubmit();
    const p2 = machine.handleSubmit();

    expect(machine.getState().status).toBe('submitting');
    expect(machine.getState().isSubmitting).toBe(true);

    // Resolve the async submission
    resolveSubmit!({ status: 'unavailable' });
    await Promise.all([p1, p2]);

    // Only one actual submit call should have been dispatched
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(1);
  });

  it('keeps persisted input in storage after unavailable status', async () => {
    const storage = new MockStorage();
    const machine = createFormMachine({
      initialValues: { name: 'Draft Name', email: 'draft@test.com' },
      storageKey: 'test.form',
      storage,
      schema: testSchema,
      submitFn: async () => ({ status: 'unavailable', message: 'No endpoint' }),
    });

    // Persist something
    machine.setFieldValue('name', 'Saved Input');
    expect(storage.getItem('test.form')).not.toBeNull();

    await machine.handleSubmit();

    expect(machine.getState().status).toBe('unavailable');
    // SessionStorage MUST be kept after unavailable
    expect(storage.getItem('test.form')).not.toBeNull();
    expect(JSON.parse(storage.getItem('test.form')!).name).toBe('Saved Input');
  });

  it('keeps persisted input in storage after error status', async () => {
    const storage = new MockStorage();
    const machine = createFormMachine({
      initialValues: { name: 'Input', email: 'user@test.com' },
      storageKey: 'test.form',
      storage,
      schema: testSchema,
      submitFn: async () => ({ status: 'error', message: 'Server 500' }),
    });

    machine.setFieldValue('name', 'Keep Me');
    await machine.handleSubmit();

    expect(machine.getState().status).toBe('error');
    // SessionStorage MUST be kept after error
    expect(storage.getItem('test.form')).not.toBeNull();
    expect(JSON.parse(storage.getItem('test.form')!).name).toBe('Keep Me');
  });

  it('clears persisted input from storage upon confirmed success', async () => {
    const storage = new MockStorage();
    const machine = createFormMachine({
      initialValues: { name: 'Success User', email: 'success@test.com' },
      storageKey: 'test.form',
      storage,
      schema: testSchema,
      submitFn: async () => ({ status: 'success' }),
    });

    machine.setFieldValue('name', 'Success User');
    expect(storage.getItem('test.form')).not.toBeNull();

    await machine.handleSubmit();

    expect(machine.getState().status).toBe('success');
    expect(storage.getItem('test.form')).toBeNull();
  });

  it('supports retry which re-submits with current values', async () => {
    let attempts = 0;
    const submitFn = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        return { status: 'unavailable', message: 'First attempt unavailable' };
      }
      return { status: 'success', message: 'Second attempt ok' };
    });

    const machine = createFormMachine({
      initialValues: { name: 'Retry User', email: 'retry@test.com' },
      schema: testSchema,
      submitFn,
    });

    await machine.handleSubmit();
    expect(machine.getState().status).toBe('unavailable');
    expect(attempts).toBe(1);

    // Call retry
    await machine.retry();
    expect(machine.getState().status).toBe('success');
    expect(attempts).toBe(2);
  });
});
