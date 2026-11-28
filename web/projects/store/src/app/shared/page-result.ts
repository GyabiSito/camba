export type PageResult<T> =
  | { kind: 'ready'; data: T }
  | { kind: 'missing' }
  | { kind: 'unavailable' };
