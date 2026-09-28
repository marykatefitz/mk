/** Canonical cell value that every engine returns. */
export type Cell = string | number | boolean | null;

export interface ResultColumn {
  name: string;
  /** engine type name, e.g. INTEGER, VARCHAR, DATE, DECIMAL(10,2) */
  type: string;
}

export interface QueryResult {
  columns: ResultColumn[];
  rows: Cell[][];
  elapsedMs: number;
}

/** Minimal SQL engine contract shared by the browser (WASM) and test (Node) engines. */
export interface SqlEngine {
  readonly kind: 'duckdb-wasm' | 'duckdb-node';
  query(sql: string): Promise<QueryResult>;
  exec(sql: string): Promise<void>;
  /** Make a text file visible to SQL (read_json/read_csv). Returns the path to use in SQL. */
  registerFile(name: string, text: string): Promise<string>;
  close(): Promise<void>;
}
