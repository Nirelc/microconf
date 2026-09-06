# microconf

Lightweight and simple type-safety config library over [microtype](https://github.com/Nirelc/microtype)

## Install

NPM

```bash
npm install @nirelc/microconf
```

Bun

```bash
bun install @nirelc/microconf
```

## Usage

Microconf can be imported with wildcard or with only required types

```ts
import { defineConfig, t, env } from "@nirelc/microconf";

const config = defineConfig({
  schema: {
    port: t.number().min(0).max(65535).default(8080),
  },
  // optional. by default, load only from schema defaults
  // ! `sources: []` skips all loads, even defaults !
  sources: [env()],
});
```

## Sources

Available sources:

### `defaults()`

`defaults()` loads from schema `.default()` values

**Enabled by default**, included in all other sources like `env()`. Can be skipped only with `sources: []`

### `env()`

`env()` loads from env variables. We doesn't load `.env` files!

Schema keys are converted to env variable names by:

- add prefix if provided. e.g., with prefix `APP_`, `token` becomes `APP_TOKEN`
- camelCase -> camel_Case
- all chars -> UPPERCASE
- nested keys are converted to flat env variable names by delimiter (default: `__`)

e.g.:

```js
// index.ts
const config = defineConfig({
  schema: {
    nested: {
      key: t.string(),
    },
  },
  sources: [env()],
});

// .env
NESTED__KEY = hello;
```

this source can be configured with options:

```ts
env({
  prefix: "APP_", // optional, default: undefined
  delimiter: "__", // optional, default: "__"
  forceCoerce: true, // optional, default: true
});
```

`prefix` - prefix for env variable names. e.g., with prefix `APP_`, `token` becomes `APP_TOKEN`
`delimiter` - delimiter for nested keys. default: `__`
`forceCoerce` - boolean to force type coercion. default: `true`. e.g. if set to `false`, `t.boolean()` willn't coerce `"true"` to `true` and will return a parse error instead
