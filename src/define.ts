import { formatPath } from "@nirelc/microtype";
import { isRecord } from "./guards/object";
import type { Config, ConfigIssue, InferSchema, Schema } from "./types";
import { defaults, DefaultsSource } from "./sources/defaults";
import { setObjValueByPath } from "./utils";
import { ParseConfigError, parseSchema, ParseSchemaError } from "./parse";

export function defineConfig<const S extends Schema>({
  schema,
  sources = [],
}: Config<S>): InferSchema<S> {
  if (!isRecord(schema)) {
    throw new ParseSchemaError([
      {
        message: "Schema must be an object",
      },
    ]);
  }

  const metas = parseSchema(schema);
  if (!metas.success) {
    throw new ParseSchemaError(metas.issues);
  }

  const unparsedFields = new Map(
    metas.data.map((meta) => [formatPath(meta.path), meta]),
  );
  const issues: ConfigIssue[] = [];
  const result: Record<string, unknown> = {};

  // defaults are a final fallback
  for (const source of [
    ...sources.filter((source) => !(source instanceof DefaultsSource)),
    defaults(),
  ]) {
    for (const [key, meta] of unparsedFields.entries()) {
      const data = source.load(meta);
      if (data === undefined) {
        continue;
      }

      unparsedFields.delete(key);
      if (!data.success) {
        const sourceIssues: ConfigIssue[] = data.issues.length
          ? data.issues
          : [{ message: "Invalid value" }];
        issues.push(
          ...sourceIssues.map((issue) => ({
            ...issue,
            path: [...meta.path, ...(issue.path ?? [])],
            source: source.name,
          })),
        );
        continue;
      }

      setObjValueByPath(result, meta.path, data.data);
    }
  }

  if (issues.length) {
    throw new ParseConfigError(issues);
  }

  return result as InferSchema<S>;
}
