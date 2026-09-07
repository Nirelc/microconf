import { afterEach, test, describe, expect } from "bun:test";

import { defineConfig, type Schema, t } from "../src";
import { env } from "../src/sources/env";
import { ParseConfigError, parseSchema, ParseSchemaError } from "../src/parse";

const PortSchema = t.number().min(0).max(65535).default(8080);

afterEach(() => {
  delete process.env.REUSED_PORT;
  delete process.env.WRAPPED_PORT;
});

const invalidSchema: Schema = {
  port: PortSchema,
  nested: {
    enabled: t.boolean().default(true),
    optional: t.boolean().optional(),
    // @ts-expect-error
    FALSE: false,
    // @ts-expect-error
    0: 0,
  },
  // @ts-expect-error
  test1: ["test"],
};

const validSchema = {
  port: PortSchema,
  serviceToken: t.string(),
  nested: {
    enabled: t.boolean().default(true),
    super: {
      nested: t.number().min(0).max(100),
    },
  },
} satisfies Schema;

describe("parseSchema", () => {
  test("should return a valid schema meta", () => {
    const data = parseSchema(validSchema);
    if (!data.success) {
      throw new Error("Failed to parse schema");
    }

    expect(data.data[0]?.schema).toBe(PortSchema);
  });
  test("should return an issues on invalid schema", () => {
    expect(parseSchema(invalidSchema)).toEqual({
      success: false,
      issues: [
        {
          message: "Field 'nested[\"0\"]' must be a 'TSchema | Schema' object",
        },
        {
          message: "Field 'nested.FALSE' must be a 'TSchema | Schema' object",
        },
        {
          message: "Field 'test1' must be a 'TSchema | Schema' object",
        },
      ],
    });
  });
});

describe("sources", () => {
  test("should load schema by env", () => {
    const result = parseSchema({
      hello: t.string().default("world"),
      opt: t.string().optional(),
      und: t.string(),
    });
    if (!result.success || result.data.length === 0) {
      throw new Error("Failed to parse schema");
    }

    const schemaMeta = result.data[0];
    if (!schemaMeta) {
      throw new Error("Failed to get schema meta");
    }

    process.env.HELLO = "world1";
    const envData = env().load(schemaMeta);
    if (!envData?.success) {
      throw new Error("Failed to load env data");
    }

    expect(envData.data).toBe("world1");
  });
});

describe("defineConfig", () => {
  test("defaults source", () => {
    const result = defineConfig({
      schema: {
        port: PortSchema,
        serviceToken: t.string().optional(),
        nested: {
          key: t.string().default("value"),
        },
      },
    });
    expect(result).toEqual({
      port: 8080,
      serviceToken: undefined,
      nested: {
        key: "value",
      },
    });
  });
  describe("env source", () => {
    process.env.SERVICE_TOKEN = "my-service-token";
    process.env.NESTED__SUPER__NESTED = "50";
    test("should load config from env source", () => {
      expect(
        defineConfig({ schema: validSchema, sources: [env()] }),
      ).toBeDefined();
    });

    // should throw an error on nested.super.nested without forceCoerce (because it's string instead of number)
    test("should throw an error on parse number without forceCoerce", () => {
      expect(() =>
        defineConfig({
          schema: validSchema,
          sources: [env({ forceCoerce: false })],
        }),
      ).toThrowError(ParseConfigError);
    });

    test("should override default value", () => {
      process.env.PORT = "3000";
      expect(
        defineConfig({
          schema: {
            port: t.number().min(0).max(65535).default(8080),
          },
          sources: [env()],
        }),
      ).toEqual({
        port: 3000,
      });
    });

    test("should use prefix", () => {
      process.env.APP_PORT2 = "3000";
      expect(
        defineConfig({
          schema: {
            port2: t.number().min(0).max(65535).default(8080),
          },
          sources: [
            env({
              prefix: "APP_",
            }),
          ],
        }),
      ).toEqual({
        port2: 3000,
      });
    });

    test("should not mutate reused schemas", () => {
      process.env.REUSED_PORT = "3000";
      const schema = t.number().default(8080);

      expect(
        defineConfig({
          schema: { reusedPort: schema },
          sources: [env()],
        }),
      ).toEqual({ reusedPort: 3000 });

      expect(() =>
        defineConfig({
          schema: { reusedPort: schema },
          sources: [env({ forceCoerce: false })],
        }),
      ).toThrowError(ParseConfigError);
    });

    test("should coerce through nested wrappers", () => {
      process.env.WRAPPED_PORT = "3000";

      for (const schema of [
        t.number().default(8080).optional(),
        t.number().optional().default(8080),
      ]) {
        expect(
          defineConfig({
            schema: { wrappedPort: schema },
            sources: [env()],
          }),
        ).toEqual({ wrappedPort: 3000 });
      }
    });
  });
  test("should throw a parse error on invalid schema", () => {
    expect(() => defineConfig({ schema: invalidSchema })).toThrowError(
      ParseSchemaError,
    );
    // biome-ignore lint/suspicious/noExplicitAny: any
    expect(() => defineConfig({} as any)).toThrowError(ParseSchemaError);
  });
});
