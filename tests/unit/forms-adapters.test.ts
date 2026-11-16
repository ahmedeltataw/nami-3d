import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestAdapter,
  submitApplication,
  submitLead,
} from '../../src/forms/adapters';
import type { ApplicationInput, LeadInput } from '../../src/forms/schemas';

const sampleLead: LeadInput = {
  name: 'Salem Omar',
  email: 'salem@example.com',
  phone: '+966551234567',
  projectType: 'web',
  message: 'Need a custom platform.',
};

const sampleApplication: ApplicationInput = {
  name: 'Mona Ali',
  email: 'mona@example.com',
  phone: '+201012345678',
  role: 'PHP Developer',
  message: 'Senior backend engineer applying.',
  cv: {
    name: 'mona_resume.pdf',
    size: 150000,
    type: 'application/pdf',
  },
};

describe('submitLead Adapter', () => {
  const originalEnv = process.env.NEXT_PUBLIC_LEAD_ENDPOINT;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_LEAD_ENDPOINT;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_LEAD_ENDPOINT = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_LEAD_ENDPOINT;
    }
  });

  it('honestly returns unavailable when no endpoint is configured', async () => {
    const result = await submitLead(sampleLead);
    expect(result.status).toBe('unavailable');
  });

  it('returns success when endpoint is provided and fetch returns 200', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'lead_123' }),
    });

    const result = await submitLead(sampleLead, {
      endpoint: 'https://api.nami-tec.com/leads',
      fetcher: mockFetcher as unknown as typeof fetch,
    });

    expect(result.status).toBe('success');
    expect(mockFetcher).toHaveBeenCalledWith(
      'https://api.nami-tec.com/leads',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleLead),
      })
    );
  });

  it('reads NEXT_PUBLIC_LEAD_ENDPOINT from environment when present', async () => {
    process.env.NEXT_PUBLIC_LEAD_ENDPOINT = 'https://env.nami-tec.com/leads';
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    const result = await submitLead(sampleLead, {
      fetcher: mockFetcher as unknown as typeof fetch,
    });

    expect(result.status).toBe('success');
    expect(mockFetcher).toHaveBeenCalledWith(
      'https://env.nami-tec.com/leads',
      expect.anything()
    );
  });

  it('returns error when endpoint returns 400/500 with message', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Database connection failed' }),
    });

    const result = await submitLead(sampleLead, {
      endpoint: 'https://api.nami-tec.com/leads',
      fetcher: mockFetcher as unknown as typeof fetch,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('Database connection failed');
    }
  });

  it('returns error when fetch throws a network exception', async () => {
    const mockFetcher = vi.fn().mockRejectedValue(new Error('DNS resolution failed'));

    const result = await submitLead(sampleLead, {
      endpoint: 'https://api.nami-tec.com/leads',
      fetcher: mockFetcher as unknown as typeof fetch,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('DNS resolution failed');
    }
  });

  it('supports injecting a test adapter (for test isolation)', async () => {
    const testAdapter = createTestAdapter<LeadInput>({
      status: 'success',
      message: 'Test adapter invoked',
    });

    const result = await submitLead(sampleLead, { adapter: testAdapter });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.message).toBe('Test adapter invoked');
    }
  });
});

describe('submitApplication Adapter', () => {
  it('honestly returns unavailable by default with no endpoint', async () => {
    const result = await submitApplication(sampleApplication);
    expect(result.status).toBe('unavailable');
  });

  it('returns success when endpoint is provided and fetch succeeds', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const result = await submitApplication(sampleApplication, {
      endpoint: 'https://api.nami-tec.com/careers',
      fetcher: mockFetcher as unknown as typeof fetch,
    });

    expect(result.status).toBe('success');
  });

  it('supports injectable test adapter for careers', async () => {
    const testAdapter = createTestAdapter<ApplicationInput>(() => ({
      status: 'unavailable',
      message: 'Mocked careers unavailable',
    }));

    const result = await submitApplication(sampleApplication, { adapter: testAdapter });
    expect(result.status).toBe('unavailable');
  });
});
