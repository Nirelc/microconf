import {
  DefaultSchema,
  OptionalSchema,
  type ParseResult,
  type Schema,
} from "@nirelc/microtype";
import type { ConfigIssue, SchemaMeta, Source } from "../types";
import { insertWordSep } from "../utils";

export type RenameMap = Record<string, string>;

export type EnvSourceOptions = {
  prefix?: string;
  delimiter?: string;
  /**
   * force set the coerce option to true for all schemas
   * useful, because env variables are always strings, and we want to coerce them to the correct type
   */
  forceCoerce?: boolean;
  renames?: RenameMap;
};

function enableCoercion(schema: Schema): Schema {
  if (schema instanceof DefaultSchema || schema instanceof OptionalSchema) {
    return enableCoercion(
      (schema as unknown as { readonly inner: Schema }).inner,
    );
  }

  if ("coerce" in schema && typeof schema.coerce === "function") {
    return (schema.coerce as (value: boolean) => Schema)(true);
  }

  return schema;
}

export class EnvSource implements Source {
  prefix: string;
  delimiter: string;
  forceCoerce: boolean;
  renames: RenameMap;

  name = "env";

  constructor({
    prefix = "",
    delimiter = "__",
    forceCoerce = true,
    renames = {},
  }: EnvSourceOptions = {}) {
    this.prefix = prefix.trim();
    this.delimiter = delimiter;
    this.forceCoerce = forceCoerce;
    this.renames = renames;
  }

  getKeyByPath(path: PropertyKey[]): string {
    return `${this.prefix}${path
      .map((p) => {
        if (typeof p === "string") {
          return insertWordSep(p);
        }

        return p;
      })
      .join(this.delimiter)}`.toUpperCase();
  }

  getKeyWithRenames(path: PropertyKey[]): string {
    const key = this.getKeyByPath(path);
    return this.renames[key] ?? key;
  }

  getValueByPath(path: PropertyKey[]): string | undefined {
    return process.env[this.getKeyWithRenames(path)];
  }

  load(meta: SchemaMeta): ParseResult<unknown> | undefined {
    const value = this.getValueByPath(meta.path);
    if (value === undefined) {
      return undefined;
    }

    const schema = this.forceCoerce ? enableCoercion(meta.schema) : meta.schema;

    const result = schema._parse(value);
    if (result.success) {
      return result;
    }

    const key = this.getKeyWithRenames(meta.path);
    const issues: ConfigIssue[] = result.issues.map((issue) => ({
      ...issue,
      key,
    }));
    return { success: false, issues };
  }
}

export function env(opts?: EnvSourceOptions): EnvSource {
  return new EnvSource(opts);
}
