import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { defaults, defineConfig, env, t, type Source } from "../src";
import { ParseConfigError } from "../src/parse";

const envKeys = [
  "MICROCONF_FIRST_VALUE",
  "MICROCONF_SECOND_VALUE",
  "APP_PORT",
  "APP_HTTP_LISTEN_PORT",
  "APP_AUTH_TOKEN",
  "APP_DATABASE_URL",
];
const previousValues = envKeys.map((key) => process.env[key]);

beforeEach(() => {
  for (const key of envKeys) delete process.env[key];
});

afterEach(() => {
  envKeys.forEach((key, index) => {
    const value = previousValues[index];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});

test("missing env values reach later sources before defaults or optional", () => {
  process.env.MICROCONF_SECOND_VALUE = "3000";
  for (const value of [
    t.number(),
    t.number().default(8080),
    t.number().optional(),
  ]) {
    expect(
      env({ prefix: "MICROCONF_FIRST_" }).load({
        key: "value",
        path: ["value"],
        schema: value,
      }),
    ).toBeUndefined();
    expect(
      defineConfig({
        schema: { value },
        sources: [
          defaults(),
          env({ prefix: "MICROCONF_FIRST_" }),
          env({ prefix: "MICROCONF_SECOND_" }),
        ],
      }),
    ).toEqual({ value: 3000 });
  }
});

test("the first valid source wins without calling later sources", () => {
  process.env.MICROCONF_FIRST_VALUE = "0";
  const load = mock(() => {
    throw new Error("Must not be called");
  });
  expect(
    defineConfig({
      schema: { value: t.number().default(8080) },
      sources: [env({ prefix: "MICROCONF_FIRST_" }), { name: "later", load }],
    }),
  ).toEqual({ value: 0 });
  expect(load).not.toHaveBeenCalled();
});

test("invalid values cannot fall back to another source or defaults", () => {
  process.env.MICROCONF_FIRST_VALUE = "invalid";
  process.env.MICROCONF_SECOND_VALUE = "3000";
  const load = mock((meta: Parameters<Source["load"]>[0]) =>
    env({ prefix: "MICROCONF_SECOND_" }).load(meta),
  );
  for (const sources of [
    [env({ prefix: "MICROCONF_FIRST_" })],
    [
      defaults(),
      env({ prefix: "MICROCONF_FIRST_" }),
      { name: "later", load },
      defaults(),
    ],
  ]) {
    expect(() =>
      defineConfig({ schema: { value: t.number().default(8080) }, sources }),
    ).toThrowError(ParseConfigError);
  }
  expect(load).not.toHaveBeenCalled();
});

test("defaults and optional apply only when all sources are missing", () => {
  for (const sources of [
    undefined,
    [],
    [env({ prefix: "MICROCONF_FIRST_" }), env({ prefix: "MICROCONF_SECOND_" })],
  ]) {
    for (const [value, expected] of [
      [t.number().default(8080), 8080],
      [t.number().optional(), undefined],
      [t.number().optional().default(8080), 8080],
      [t.number().default(8080).optional(), undefined],
    ] as const) {
      expect(defineConfig({ schema: { value }, sources })).toEqual({
        value: expected,
      });
    }
    expect(() =>
      defineConfig({ schema: { value: t.number() }, sources }),
    ).toThrowError("value from defaults: expected number");
  }
});

test("custom missing results fall through, but successful undefined does not", () => {
  const later = { name: "later", load: mock(() => t.number()._parse(3000)) };
  expect(
    defineConfig({
      schema: { value: t.number() },
      sources: [{ name: "missing", load: () => undefined }, later],
    }),
  ).toEqual({ value: 3000 });
  later.load.mockClear();
  expect(
    defineConfig({
      schema: { value: t.number().optional() },
      sources: [
        { name: "present", load: () => ({ success: true, data: undefined }) },
        later,
      ],
    }),
  ).toEqual({ value: undefined });
  expect(later.load).not.toHaveBeenCalled();
});

test("custom parse failures remain errors even without issue details", () => {
  expect(() =>
    defineConfig({
      schema: { value: t.number().default(8080) },
      sources: [{ name: "invalid", load: () => ({ success: false, issues: [] }) }],
    }),
  ).toThrowError("value from invalid: invalid value");
});

test("an empty env string is present and does not use a default", () => {
  process.env.MICROCONF_FIRST_VALUE = "";
  expect(
    defineConfig({
      schema: { value: t.string().default("fallback") },
      sources: [env({ prefix: "MICROCONF_FIRST_" })],
    }),
  ).toEqual({ value: "" });
});

test("env errors report the key and source without the input value", () => {
  process.env.APP_PORT = "abc";
  let error: unknown;
  try {
    defineConfig({
      schema: { port: t.number().default(8080) },
      sources: [env({ prefix: "APP_" })],
    });
  } catch (cause) {
    error = cause;
  }
  expect(error).toBeInstanceOf(ParseConfigError);
  if (!(error instanceof ParseConfigError)) throw error;
  expect(error.message).toBe(
    "Config parsing failed with 1 issue(s):\n- APP_PORT from env: expected number",
  );
  expect(error.issues).toEqual([{
    message: "Expected number",
    path: ["port"],
    source: "env",
    key: "APP_PORT",
  }]);
});

test("env diagnostics use the configured delimiter", () => {
  process.env.APP_HTTP_LISTEN_PORT = 'bad"\nvalue';
  expect(() => defineConfig({
    schema: { http: { listenPort: t.number() } },
    sources: [env({ prefix: "APP_", delimiter: "_" })],
  })).toThrowError(
    "APP_HTTP_LISTEN_PORT from env: expected number",
  );
});

test("env diagnostics omit values regardless of the key name", () => {
  const source = env({ prefix: "APP_" });
  for (const key of ["APP_AUTH_TOKEN", "APP_DATABASE_URL"]) {
    process.env[key] = "do-not-log-this";
    const field = key === "APP_AUTH_TOKEN" ? "authToken" : "databaseUrl";
    const result = source.load({ key: field, path: [field], schema: t.number() });
    expect(JSON.stringify(result)).not.toContain("do-not-log-this");
    expect(() => defineConfig({
      schema: { [field]: t.number() },
      sources: [source],
    })).toThrowError(`${key} from env: expected number`);
  }
});

test("custom source errors preserve nested issue paths", () => {
  let error: unknown;
  try {
    defineConfig({
      schema: { nested: { ports: t.array(t.number()) } },
      sources: [{
        name: "file",
        load: (meta) => meta.schema._parse([80, "invalid"]),
      }],
    });
  } catch (cause) {
    error = cause;
  }
  expect(error).toBeInstanceOf(ParseConfigError);
  if (!(error instanceof ParseConfigError)) throw error;
  expect(error.message).toBe(
    "Config parsing failed with 1 issue(s):\n- nested.ports[1] from file: expected number",
  );
  expect(error.issues).toEqual([{
    message: "Expected number",
    source: "file",
    path: ["nested", "ports", 1],
  }]);
});
