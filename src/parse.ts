import {
  BaseSchema,
  formatPath,
  formatValidationMessage,
  type Issue,
  type ParseResult,
} from "@nirelc/microtype";
import { isRecord } from "./guards/object";
import type { Schema, SchemaMeta } from "./types";

export class ParseError extends Error {
  constructor(
    readonly issues: Issue[],
    readonly context: string,
  ) {
    super(
      `${context} failed with ${issues.length} issue(s):\n${issues
        .map((issue) => `- ${formatValidationMessage([issue])}`)
        .join("\n")}`,
    );
    this.name = "ParseError";
  }
}

export class ParseConfigError extends ParseError {
  constructor(override readonly issues: Issue[]) {
    super(issues, "Config parsing");
    this.name = "ParseConfigError";
  }
}

export class ParseSchemaError extends ParseError {
  constructor(override readonly issues: Issue[]) {
    super(issues, "Schema parsing");
    this.name = "ParseSchemaError";
  }
}

export function parseSchema(
  schema: Schema,
  path: PropertyKey[] = [],
): ParseResult<SchemaMeta[]> {
  if (!isRecord(schema)) {
    return {
      success: false,
      issues: [
        {
          message: `Field '${formatPath(path)}' must be a 'TSchema | Schema' object`,
        },
      ],
    };
  }

  const meta: SchemaMeta[] = [];
  const issues = [];
  for (const [key, value] of Object.entries(schema)) {
    if (value instanceof BaseSchema) {
      meta.push({
        key,
        path: [...path, key],
        schema: value,
      });
      continue;
    }

    const result = parseSchema(value as Schema, [...path, key]);
    if (!result.success) {
      issues.push(...result.issues);
      continue;
    }

    meta.push(...result.data);
  }

  return issues.length
    ? { success: false, issues }
    : { success: true, data: meta };
}
