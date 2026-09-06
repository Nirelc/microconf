import {
  DefaultSchema,
  OptionalSchema,
  type ParseResult,
  type Schema,
} from "@nirelc/microtype";
import type { SchemaMeta, Source } from "../types";
import { insertWordSep } from "../utils";

export type EnvSourceOptions = {
  prefix?: string;
  delimiter?: string;
  /**
   * force set the coerce option to true for all schemas
   * useful, because env variables are always strings, and we want to coerce them to the correct type
   */
  forceCoerce?: boolean;
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

  name = "env";

  constructor({
    prefix = "",
    delimiter = "__",
    forceCoerce = true,
  }: EnvSourceOptions = {}) {
    this.prefix = prefix.trim();
    this.delimiter = delimiter;
    this.forceCoerce = forceCoerce;
  }

  getValueByPath(path: PropertyKey[]): string | undefined {
    const envKey = `${this.prefix}${path
      .map((p) => {
        if (typeof p === "string") {
          return insertWordSep(p);
        }

        return p;
      })
      .join(this.delimiter)}`.toUpperCase();
    return process.env[envKey];
  }

  load(meta: SchemaMeta): ParseResult<unknown> {
    const value = this.getValueByPath(meta.path);
    const schema =
      this.forceCoerce && value !== undefined
        ? enableCoercion(meta.schema)
        : meta.schema;

    return schema._parse(value);
  }
}

export function env(opts?: EnvSourceOptions): EnvSource {
  return new EnvSource(opts);
}
