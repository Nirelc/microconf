import { isRecord } from "./guards/object";

export const insertWordSep = (word: string): string => {
  return word.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
};

export function setObjValueByPath(
  obj: Record<string, unknown>,
  path: PropertyKey[],
  value: unknown,
): undefined {
  if (!path.length) {
    return;
  }

  const key = path[0] as string;
  if (path.length === 1) {
    obj[key] = value;
    return;
  }

  if (!isRecord(obj[key])) {
    obj[key] = {};
  }

  return setObjValueByPath(
    obj[key] as Record<string, unknown>,
    path.slice(1),
    value,
  );
}
