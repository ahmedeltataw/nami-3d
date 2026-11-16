import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analytics,
  createAdapter,
  noopAdapter,
  page,
  registerProvider,
  resetAnalytics,
  setConsent,
  track,
} from '../../src/analytics';
import {
  CTA_CLICK,
  EVENTS,
  FORM_SUBMIT_ATTEMPT,
  INTERACTION_EXIT,
  INTERACTION_START,
  PROJECT_OPEN,
  ROUTE_CHANGE,
  SCENE_ENTER,
  STATION_OPEN,
  createEvent,
} from '../../src/analytics/events';

describe('analytics adapter', () => {
  const originalEnv = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;

  beforeEach(() => {
    resetAnalytics();
    delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetAnalytics();
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
    }
    vi.restoreAllMocks();
  });

  it('default is noop & enabled=false', () => {
    expect(noopAdapter.enabled).toBe(false);
    expect(createAdapter()).toBe(noopAdapter);
    expect(createAdapter().enabled).toBe(false);
    expect(analytics.enabled).toBe(false);

    expect(() => noopAdapter.track({ name: 'test' })).not.toThrow();
    expect(() => noopAdapter.page('/test')).not.toThrow();
    expect(() => track({ name: 'test' })).not.toThrow();
    expect(() => page('/test')).not.toThrow();
  });

  it('enabling env without provider stays noop', () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true';

    const adapter = createAdapter();
    expect(adapter).toBe(noopAdapter);
    expect(adapter.enabled).toBe(false);
    expect(analytics.enabled).toBe(false);

    expect(() => track({ name: 'scene_enter', props: { sceneId: 'intro' } })).not.toThrow();
    expect(() => page('/home')).not.toThrow();
  });

  it('with provider+consent sends', () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true';

    const mockTrack = vi.fn();
    const mockPage = vi.fn();

    registerProvider(() => ({
      enabled: true,
      track: mockTrack,
      page: mockPage,
    }));

    setConsent(true);

    expect(analytics.enabled).toBe(true);

    const adapter = createAdapter();
    expect(adapter.enabled).toBe(true);
    expect(adapter).not.toBe(noopAdapter);

    const event = { name: EVENTS.SCENE_ENTER, props: { sceneId: 'hero' } };
    track(event);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(event);

    page('/projects');
    expect(mockPage).toHaveBeenCalledTimes(1);
    expect(mockPage).toHaveBeenCalledWith('/projects');

    const clickEvent = { name: EVENTS.CTA_CLICK, props: { id: 'btn_hero' } };
    adapter.track(clickEvent);
    expect(mockTrack).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenCalledWith(clickEvent);

    adapter.page('/contact');
    expect(mockPage).toHaveBeenCalledTimes(2);
    expect(mockPage).toHaveBeenCalledWith('/contact');
  });

  it('consent false blocks', () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true';

    const mockTrack = vi.fn();
    const mockPage = vi.fn();

    registerProvider(() => ({
      enabled: true,
      track: mockTrack,
      page: mockPage,
    }));

    setConsent(false);

    expect(analytics.enabled).toBe(true);

    track({ name: EVENTS.SCENE_ENTER, props: { sceneId: 'hero' } });
    page('/projects');

    const adapter = createAdapter();
    adapter.track({ name: EVENTS.CTA_CLICK, props: { id: 'btn_hero' } });
    adapter.page('/contact');

    expect(mockTrack).not.toHaveBeenCalled();
    expect(mockPage).not.toHaveBeenCalled();

    setConsent(true);
    track({ name: EVENTS.SCENE_ENTER, props: { sceneId: 'hero' } });
    expect(mockTrack).toHaveBeenCalledTimes(1);

    setConsent(false);
    track({ name: EVENTS.SCENE_ENTER, props: { sceneId: 'hero' } });
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('no fetch/navigator.sendBeacon called by default (spy)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const beaconMock = vi.fn();
    type NavigatorWithBeacon = Navigator & { sendBeacon?: (url: string | URL, data?: BodyInit | null) => boolean };
    const nav = globalThis.navigator as NavigatorWithBeacon | undefined;
    const originalBeacon = nav?.sendBeacon;

    if (nav) {
      Object.defineProperty(nav, 'sendBeacon', {
        value: beaconMock,
        writable: true,
        configurable: true,
      });
    }

    try {
      track({ name: 'scene_enter', props: { sceneId: 'hero' } });
      page('/landing');
      noopAdapter.track({ name: 'cta_click', props: { id: 'cta_1' } });
      noopAdapter.page('/landing');

      expect(fetchSpy).not.toHaveBeenCalled();
      if (nav) {
        expect(beaconMock).not.toHaveBeenCalled();
      }
    } finally {
      if (nav) {
        if (originalBeacon !== undefined) {
          nav.sendBeacon = originalBeacon;
        } else {
          Reflect.deleteProperty(nav, 'sendBeacon');
        }
      }
    }
  });

  it('exports event name constants and payload helpers', () => {
    expect(SCENE_ENTER).toBe('scene_enter');
    expect(CTA_CLICK).toBe('cta_click');
    expect(STATION_OPEN).toBe('station_open');
    expect(PROJECT_OPEN).toBe('project_open');
    expect(FORM_SUBMIT_ATTEMPT).toBe('form_submit_attempt');
    expect(INTERACTION_START).toBe('interaction_start');
    expect(INTERACTION_EXIT).toBe('interaction_exit');
    expect(ROUTE_CHANGE).toBe('route_change');

    expect(EVENTS.SCENE_ENTER).toBe('scene_enter');
    expect(EVENTS.CTA_CLICK).toBe('cta_click');
    expect(EVENTS.STATION_OPEN).toBe('station_open');
    expect(EVENTS.PROJECT_OPEN).toBe('project_open');
    expect(EVENTS.FORM_SUBMIT_ATTEMPT).toBe('form_submit_attempt');
    expect(EVENTS.INTERACTION_START).toBe('interaction_start');
    expect(EVENTS.INTERACTION_EXIT).toBe('interaction_exit');
    expect(EVENTS.ROUTE_CHANGE).toBe('route_change');

    expect(createEvent.scene_enter('scene_1')).toEqual({
      name: 'scene_enter',
      props: { sceneId: 'scene_1' },
    });
    expect(createEvent.cta_click('cta_primary')).toEqual({
      name: 'cta_click',
      props: { id: 'cta_primary' },
    });
    expect(createEvent.station_open('station_alpha')).toEqual({
      name: 'station_open',
      props: { id: 'station_alpha' },
    });
    expect(createEvent.project_open('proj_rover')).toEqual({
      name: 'project_open',
      props: { slug: 'proj_rover' },
    });
    expect(createEvent.form_submit_attempt('contact_form')).toEqual({
      name: 'form_submit_attempt',
      props: { kind: 'contact_form' },
    });
    expect(createEvent.interaction_start('orbit_controls')).toEqual({
      name: 'interaction_start',
      props: { name: 'orbit_controls' },
    });
    expect(createEvent.interaction_exit('orbit_controls')).toEqual({
      name: 'interaction_exit',
      props: { name: 'orbit_controls' },
    });
    expect(createEvent.route_change('/en/about')).toEqual({
      name: 'route_change',
      props: { path: '/en/about' },
    });
    expect(createEvent.route_change()).toEqual({
      name: 'route_change',
    });
  });

  it('respects config.enabled=false even when env is true and provider registered', () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true';
    registerProvider(() => ({
      enabled: true,
      track: vi.fn(),
      page: vi.fn(),
    }));
    setConsent(true);

    const adapter = createAdapter({ enabled: false });
    expect(adapter).toBe(noopAdapter);
    expect(adapter.enabled).toBe(false);
  });
});
