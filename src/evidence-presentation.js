import { isEvidenceRequestFailure } from './eval.js';

export function evidenceRequestFailed(...values) {
  return values.some((value) => isEvidenceRequestFailure(value));
}

export function engineUnavailableLabel(values, {
  failed = 'eval request failed',
  missing = 'eval unavailable',
} = {}) {
  return evidenceRequestFailed(...values) ? failed : missing;
}

export function humanFailureIndicator(value, population) {
  if (!isEvidenceRequestFailure(value)) return null;
  return {
    text: '!',
    title: `${population} evidence request failed`,
  };
}
