import type { AnalyticsEvent } from './index';

export const EVENTS = {
  SCENE_ENTER: 'scene_enter',
  CTA_CLICK: 'cta_click',
  STATION_OPEN: 'station_open',
  PROJECT_OPEN: 'project_open',
  FORM_SUBMIT_ATTEMPT: 'form_submit_attempt',
  INTERACTION_START: 'interaction_start',
  INTERACTION_EXIT: 'interaction_exit',
  ROUTE_CHANGE: 'route_change',
  scene_enter: 'scene_enter',
  cta_click: 'cta_click',
  station_open: 'station_open',
  project_open: 'project_open',
  form_submit_attempt: 'form_submit_attempt',
  interaction_start: 'interaction_start',
  interaction_exit: 'interaction_exit',
  route_change: 'route_change',
} as const;

export const ANALYTICS_EVENTS = EVENTS;

export const SCENE_ENTER = 'scene_enter';
export const CTA_CLICK = 'cta_click';
export const STATION_OPEN = 'station_open';
export const PROJECT_OPEN = 'project_open';
export const FORM_SUBMIT_ATTEMPT = 'form_submit_attempt';
export const INTERACTION_START = 'interaction_start';
export const INTERACTION_EXIT = 'interaction_exit';
export const ROUTE_CHANGE = 'route_change';

export const scene_enter = 'scene_enter';
export const cta_click = 'cta_click';
export const station_open = 'station_open';
export const project_open = 'project_open';
export const form_submit_attempt = 'form_submit_attempt';
export const interaction_start = 'interaction_start';
export const interaction_exit = 'interaction_exit';
export const route_change = 'route_change';

export type AnalyticsEventName =
  | 'scene_enter'
  | 'cta_click'
  | 'station_open'
  | 'project_open'
  | 'form_submit_attempt'
  | 'interaction_start'
  | 'interaction_exit'
  | 'route_change';

export type AnalyticsEventPayloads = {
  scene_enter: { sceneId: string };
  cta_click: { id: string };
  station_open: { id: string };
  project_open: { slug: string };
  form_submit_attempt: { kind: string };
  interaction_start: { name: string };
  interaction_exit: { name: string };
  route_change: { path?: string } | undefined;
};

export const createEvent = {
  scene_enter: (sceneId: string): AnalyticsEvent => ({
    name: EVENTS.scene_enter,
    props: { sceneId },
  }),
  cta_click: (id: string): AnalyticsEvent => ({
    name: EVENTS.cta_click,
    props: { id },
  }),
  station_open: (id: string): AnalyticsEvent => ({
    name: EVENTS.station_open,
    props: { id },
  }),
  project_open: (slug: string): AnalyticsEvent => ({
    name: EVENTS.project_open,
    props: { slug },
  }),
  form_submit_attempt: (kind: string): AnalyticsEvent => ({
    name: EVENTS.form_submit_attempt,
    props: { kind },
  }),
  interaction_start: (name: string): AnalyticsEvent => ({
    name: EVENTS.interaction_start,
    props: { name },
  }),
  interaction_exit: (name: string): AnalyticsEvent => ({
    name: EVENTS.interaction_exit,
    props: { name },
  }),
  route_change: (path?: string): AnalyticsEvent => ({
    name: EVENTS.route_change,
    ...(path ? { props: { path } } : {}),
  }),
};

export const eventCreators = createEvent;

export const createSceneEnterEvent = createEvent.scene_enter;
export const createCtaClickEvent = createEvent.cta_click;
export const createStationOpenEvent = createEvent.station_open;
export const createProjectOpenEvent = createEvent.project_open;
export const createFormSubmitAttemptEvent = createEvent.form_submit_attempt;
export const createInteractionStartEvent = createEvent.interaction_start;
export const createInteractionExitEvent = createEvent.interaction_exit;
export const createRouteChangeEvent = createEvent.route_change;
