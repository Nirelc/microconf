import type { Issue, ParseResult, Schema as TSchema } from "@nirelc/microtype";

export type Schema = {
  [key: string]: TSchema | Schema;
};

export type InferSchema<S extends Schema> = {
  -readonly [K in keyof S]: S[K] extends TSchema<infer T>
    ? T
    : S[K] extends Schema
      ? InferSchema<S[K]>
      : never;
};

export type Config<S extends Schema = Schema> = {
  schema: S;
  sources?: Source[];
};

export type SchemaMeta = {
  key: string;
  path: PropertyKey[];
  schema: TSchema;
};

export type ConfigIssue = Issue & {
  source?: string;
  key?: string;
};

export interface Source {
  name: string;
  load(meta: SchemaMeta): ParseResult<unknown> | undefined;
}
