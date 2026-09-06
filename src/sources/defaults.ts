import type { ParseResult } from "@nirelc/microtype";
import type { SchemaMeta, Source } from "../types";

export class DefaultsSource implements Source {
  name = "defaults";

  load(meta: SchemaMeta): ParseResult<unknown> {
    return meta.schema._parse(undefined);
  }
}

export function defaults(): DefaultsSource {
  return new DefaultsSource();
}
