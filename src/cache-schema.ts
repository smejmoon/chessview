export const METADATA_STORE = 'metadata';
export const METADATA_KEY_PATH = 'key';
export const CACHE_SCHEMA_KEY = 'store-schemas';

export const NODES_STORE = 'nodes';
export const NODES_KEY_PATH = 'key';

export const EDGES_STORE = 'edges';
export const EDGES_KEY_PATH = 'id';
export const EDGE_SOURCE_INDEX = 'source';
export const EDGE_TARGET_INDEX = 'target';

export const CACHE_SCHEMA_VERSIONS = {
  [NODES_STORE]: 1,
  [EDGES_STORE]: 2,
} as const;

export type CacheStoreName = keyof typeof CACHE_SCHEMA_VERSIONS;

export type CacheSchemaRecord = Readonly<{
  key: typeof CACHE_SCHEMA_KEY;
  versions?: Partial<Record<CacheStoreName, unknown>>;
}>;
