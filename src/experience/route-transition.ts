export interface RouteTransition {
  start(from: string, to: string, signal?: AbortSignal): void;
  cancel(): void;
  complete(): void;
}

// Routing and history remain native until the liquid-transition card implements this contract.
export const routeTransition: RouteTransition = {
  start() {},
  cancel() {},
  complete() {},
};
