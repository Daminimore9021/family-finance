/**
 * GOOGLE_PRIVATE_KEY must work however it was pasted into .env.local or a hosting dashboard.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSign, createVerify, generateKeyPairSync } from "node:crypto";
import { normalizePrivateKey } from "../lib/server/env";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const escaped = privateKey.replace(/\n/g, "\\n");

const variants: Record<string, string> = {
  "real newlines": privateKey,
  "literal \\n (as in the JSON file)": escaped,
  "wrapped in double quotes": `"${escaped}"`,
  "only a leading quote": `"${escaped}`,
  "trailing quote and comma": `${escaped}",`,
  "newlines turned into spaces": privateKey.replace(/\n/g, " "),
  "single line, no separators": privateKey.replace(/\n/g, ""),
  "double-escaped \\\\n": privateKey.replace(/\n/g, "\\\\n"),
  "Windows CRLF": privateKey.replace(/\n/g, "\r\n"),
  "whole JSON line pasted": `"private_key": "${escaped}",`,
  "surrounding whitespace": `  \n${privateKey}\n  `,
};

for (const [name, value] of Object.entries(variants)) {
  test(`private key: ${name}`, () => {
    const pem = normalizePrivateKey(value);
    const sig = createSign("RSA-SHA256").update("hello").sign(pem);
    assert.ok(createVerify("RSA-SHA256").update("hello").verify(publicKey, sig));
  });
}

test("private key: clear errors for missing header or truncated key", () => {
  assert.throws(() => normalizePrivateKey("abc"), /BEGIN PRIVATE KEY/);
  const lines = privateKey.split("\n");
  const truncated = [lines[0], lines[1], lines[2], lines.at(-2)].join("\n");
  assert.throws(() => normalizePrivateKey(truncated), /incomplete/);
});
