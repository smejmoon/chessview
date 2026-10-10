// Caller participation and coalesced-producer lifetime are application work,
// not HTTP request options. Urgency is read when queued transport is selected.
export type WorkUrgency = 'foreground' | 'background';
export type WorkUrgencyInput = WorkUrgency | (() => WorkUrgency);
export type WorkDemand = Readonly<{
  signal?: AbortSignal;
  urgency?: WorkUrgencyInput;
}>;
export type ProducerWork = Readonly<{
  signal: AbortSignal;
  urgency: () => WorkUrgency;
}>;
export function workUrgency(value: WorkUrgencyInput = 'foreground'): WorkUrgency {
  return (typeof value === 'function' ? value() : value) === 'background' ? 'background' : 'foreground';
}
