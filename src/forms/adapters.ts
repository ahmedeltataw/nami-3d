import type { ApplicationInput, LeadInput } from './schemas';

export type SubmitResult =
  | { status: 'unavailable'; message?: string }
  | { status: 'success'; message?: string; data?: unknown }
  | { status: 'error'; message: string; errors?: Record<string, string[]> };

export type FormAdapter<T> = (data: T) => Promise<SubmitResult>;

export interface AdapterOptions<T> {
  endpoint?: string;
  fetcher?: typeof fetch;
  adapter?: FormAdapter<T>;
}

/**
 * Creates an injectable adapter for testing purposes only.
 * Never used in the production code path.
 */
export function createTestAdapter<T>(
  resultOrHandler: SubmitResult | ((data: T) => SubmitResult | Promise<SubmitResult>)
): FormAdapter<T> {
  return async (data: T): Promise<SubmitResult> => {
    if (typeof resultOrHandler === 'function') {
      return resultOrHandler(data);
    }
    return resultOrHandler;
  };
}

async function postJson(
  endpoint: string,
  payload: unknown,
  customFetch?: typeof fetch
): Promise<SubmitResult> {
  try {
    const f = customFetch ?? fetch;
    const response = await f(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = undefined;
      }
      return { status: 'success', data };
    }

    let errorMessage = `Submission failed (${response.status})`;
    try {
      const errJson = (await response.json()) as { message?: string };
      if (errJson && typeof errJson.message === 'string') {
        errorMessage = errJson.message;
      }
    } catch {
      // keep fallback errorMessage
    }

    return { status: 'error', message: errorMessage };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Network request failed',
    };
  }
}

/**
 * Submits lead data.
 * Honest: if no endpoint is configured (NEXT_PUBLIC_LEAD_ENDPOINT), returns { status: 'unavailable' }.
 */
export async function submitLead(
  data: LeadInput,
  options?: AdapterOptions<LeadInput>
): Promise<SubmitResult> {
  if (options?.adapter) {
    return options.adapter(data);
  }

  const endpoint =
    options?.endpoint ??
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_LEAD_ENDPOINT
      : undefined);

  if (!endpoint || endpoint.trim() === '') {
    return { status: 'unavailable' };
  }

  return postJson(endpoint, data, options?.fetcher);
}

/**
 * Submits job application data.
 * Honest: if no endpoint is configured, returns { status: 'unavailable' }.
 */
export async function submitApplication(
  data: ApplicationInput,
  options?: AdapterOptions<ApplicationInput>
): Promise<SubmitResult> {
  if (options?.adapter) {
    return options.adapter(data);
  }

  const endpoint =
    options?.endpoint ??
    (typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_APPLICATION_ENDPOINT ?? process.env.NEXT_PUBLIC_LEAD_ENDPOINT)
      : undefined);

  if (!endpoint || endpoint.trim() === '') {
    return { status: 'unavailable' };
  }

  return postJson(endpoint, data, options?.fetcher);
}
