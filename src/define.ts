import { formatPath, type Issue } from "@nirelc/microtype";
import { isRecord } from "./guards/object";
import type { Config, InferSchema, Schema } from "./types";
import { defaults } from "./sources/defaults";
import { setObjValueByPath } from "./utils";
import { ParseConfigError, parseSchema, ParseSchemaError } from "./parse";

export function defineConfig<const S extends Schema>({
  schema,
  sources = [defaults()],
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
  const unparsedIssues = new Map<string, Issue[]>();
  const result: Record<string, unknown> = {};

  for (const source of sources) {
    for (const [key, meta] of unparsedFields.entries()) {
      const data = source.load(meta);
      if (!data.success) {
        unparsedIssues.set(key, data.issues);
        continue;
      }

      setObjValueByPath(result, meta.path, data.data);
      unparsedFields.delete(key);
    }
  }

  if (!unparsedFields.size) {
    return result as InferSchema<S>;
  }

  const issues: Issue[] = [];
  for (const key of unparsedFields.keys()) {
    const keyIssues = unparsedIssues.get(key);
    if (!keyIssues) {
      continue;
    }

    issues.push(
      ...keyIssues.map((issue) => ({
        message: `${issue.message} at '${key}'`,
      })),
    );
  }

  throw new ParseConfigError(issues);
}
