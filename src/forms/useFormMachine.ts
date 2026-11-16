'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { z } from 'zod';
import type { SubmitResult } from './adapters';

export type FormStatus =
  | 'idle'
  | 'validating'
  | 'submitting'
  | 'success'
  | 'error'
  | 'unavailable';

export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  status: FormStatus;
  statusMessage: string | null;
  isSubmitting: boolean;
}

export interface FormMachineOptions<T extends Record<string, unknown>> {
  initialValues: T;
  schema?: z.ZodType<T>;
  submitFn: (values: T) => Promise<SubmitResult>;
  storageKey?: string;
  storage?: Storage | null;
  onSuccess?: (result: SubmitResult) => void;
}

export interface FormMachine<T extends Record<string, unknown>> {
  getState: () => FormState<T>;
  subscribe: (listener: () => void) => () => void;
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (updater: Partial<T> | ((prev: T) => T)) => void;
  handleSubmit: (e?: { preventDefault?: () => void }) => Promise<SubmitResult | undefined>;
  retry: () => Promise<SubmitResult | undefined>;
  reset: () => void;
  clearErrors: () => void;
  updateOptions: (newOptions: Partial<FormMachineOptions<T>>) => void;
}

function resolveStorage(customStorage?: Storage | null): Storage | null {
  if (customStorage !== undefined) return customStorage;
  if (typeof window !== 'undefined') {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Pure state machine managing form status transitions, duplicate submit prevention,
 * validation, and sessionStorage persistence with try/catch guards.
 */
export function createFormMachine<T extends Record<string, unknown>>(
  options: FormMachineOptions<T>
): FormMachine<T> {
  let opts = { ...options };
  const storage = resolveStorage(opts.storage);

  let initialValues = { ...opts.initialValues };
  if (opts.storageKey && storage) {
    try {
      const stored = storage.getItem(opts.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          initialValues = { ...initialValues, ...parsed };
        }
      }
    } catch {
      // sessionStorage unavailable or access blocked
    }
  }

  let state: FormState<T> = {
    values: initialValues,
    errors: {},
    status: 'idle',
    statusMessage: null,
    isSubmitting: false,
  };

  const listeners = new Set<() => void>();
  let isSubmittingGuard = false;

  function notify() {
    for (const listener of listeners) {
      listener();
    }
  }

  function persist(nextValues: T) {
    if (!opts.storageKey || !storage) return;
    try {
      storage.setItem(opts.storageKey, JSON.stringify(nextValues));
    } catch {
      // ignore storage quota / sandbox failures
    }
  }

  function clearPersisted() {
    if (!opts.storageKey || !storage) return;
    try {
      storage.removeItem(opts.storageKey);
    } catch {
      // ignore
    }
  }

  const machine: FormMachine<T> = {
    getState: () => state,

    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    updateOptions: (newOptions: Partial<FormMachineOptions<T>>) => {
      opts = { ...opts, ...newOptions };
    },

    setFieldValue: <K extends keyof T>(field: K, value: T[K]) => {
      const nextValues = { ...state.values, [field]: value };
      const nextErrors = { ...state.errors };
      if (nextErrors[field]) {
        delete nextErrors[field];
      }
      state = {
        ...state,
        values: nextValues,
        errors: nextErrors,
      };
      persist(nextValues);
      notify();
    },

    setValues: (updater: Partial<T> | ((prev: T) => T)) => {
      const nextValues =
        typeof updater === 'function'
          ? (updater as (prev: T) => T)(state.values)
          : { ...state.values, ...updater };
      state = {
        ...state,
        values: nextValues,
      };
      persist(nextValues);
      notify();
    },

    clearErrors: () => {
      state = { ...state, errors: {} };
      notify();
    },

    handleSubmit: async (e?: { preventDefault?: () => void }) => {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }

      // Duplicate-submit guard
      if (isSubmittingGuard || state.isSubmitting) {
        return undefined;
      }
      isSubmittingGuard = true;

      // Transition: idle -> validating
      state = {
        ...state,
        status: 'validating',
        statusMessage: null,
        isSubmitting: true,
      };
      notify();

      let validatedData = state.values;
      if (opts.schema) {
        const parsed = opts.schema.safeParse(state.values);
        if (!parsed.success) {
          const fieldErrors: Partial<Record<keyof T, string>> = {};
          for (const issue of parsed.error.issues) {
            const field = issue.path[0] as keyof T;
            if (field && !fieldErrors[field]) {
              fieldErrors[field] = issue.message;
            }
          }
          isSubmittingGuard = false;
          state = {
            ...state,
            status: 'idle',
            errors: fieldErrors,
            isSubmitting: false,
          };
          notify();
          return undefined;
        }
        validatedData = parsed.data;
      }

      // Transition: validating -> submitting
      state = {
        ...state,
        errors: {},
        status: 'submitting',
        isSubmitting: true,
      };
      notify();

      try {
        const result = await opts.submitFn(validatedData);

        if (result.status === 'success') {
          // Success: clear persisted sessionStorage
          clearPersisted();
          state = {
            ...state,
            status: 'success',
            statusMessage: result.message ?? null,
            isSubmitting: false,
          };
          isSubmittingGuard = false;
          notify();
          opts.onSuccess?.(result);
          return result;
        }

        if (result.status === 'unavailable') {
          // Unavailable: keep persisted input in sessionStorage
          state = {
            ...state,
            status: 'unavailable',
            statusMessage: result.message ?? null,
            isSubmitting: false,
          };
          isSubmittingGuard = false;
          notify();
          return result;
        }

        // Error: keep persisted input in sessionStorage
        state = {
          ...state,
          status: 'error',
          statusMessage: result.message ?? 'An error occurred during submission.',
          isSubmitting: false,
        };
        isSubmittingGuard = false;
        notify();
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Submission failed';
        state = {
          ...state,
          status: 'error',
          statusMessage: msg,
          isSubmitting: false,
        };
        isSubmittingGuard = false;
        notify();
        return { status: 'error', message: msg };
      }
    },

    retry: async () => {
      return machine.handleSubmit();
    },

    reset: () => {
      clearPersisted();
      state = {
        values: opts.initialValues,
        errors: {},
        status: 'idle',
        statusMessage: null,
        isSubmitting: false,
      };
      isSubmittingGuard = false;
      notify();
    },
  };

  return machine;
}

/**
 * useForm-free React hook wrapper around createFormMachine.
 */
export function useFormMachine<T extends Record<string, unknown>>(
  options: FormMachineOptions<T>
) {
  const [machine] = useState(() => createFormMachine(options));

  // Keep options updated if props change
  useEffect(() => {
    machine.updateOptions(options);
  });

  const state = useSyncExternalStore(
    machine.subscribe,
    machine.getState,
    machine.getState
  );

  return {
    ...state,
    setFieldValue: machine.setFieldValue,
    setValues: machine.setValues,
    handleSubmit: machine.handleSubmit,
    retry: machine.retry,
    reset: machine.reset,
    clearErrors: machine.clearErrors,
  };
}
