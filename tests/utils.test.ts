import { describe, expect, test } from "bun:test";
import { insertWordSep } from "../src/utils";

describe("insertWordSep", () => {
  test("should insert underscore between camelCase words", () => {
    const input = "camelCaseWord";
    const expectedOutput = "camel_Case_Word";
    const actualOutput = insertWordSep(input);
    expect(actualOutput).toBe(expectedOutput);
  });

  test("should not modify words without camelCase", () => {
    const input = "word";
    const expectedOutput = "word";
    const actualOutput = insertWordSep(input);
    expect(actualOutput).toBe(expectedOutput);
  });

  test("should handle multiple camelCase words", () => {
    const input = "thisIsCamelCase";
    const expectedOutput = "this_Is_Camel_Case";
    const actualOutput = insertWordSep(input);
    expect(actualOutput).toBe(expectedOutput);
  });

  test("should handle numbers in camelCase words", () => {
    const input = "camelCase1Word2";
    const expectedOutput = "camel_Case1_Word2";
    const actualOutput = insertWordSep(input);
    expect(actualOutput).toBe(expectedOutput);
  });
});
