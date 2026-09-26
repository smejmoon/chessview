import { createRequestGate } from './request-gate.js';

export function createLichessGateway(options = {}) {
  const gate = createRequestGate(options);

  return {
    request(input, init) {
      return gate.run(input, init);
    },
    get cooldownUntil() {
      return gate.cooldownUntil;
    },
  };
}

export const lichessGateway = createLichessGateway();
