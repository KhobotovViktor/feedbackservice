import { describe, it, expect } from "vitest";
import { isSafeB24Url, normalizeB24Url } from "../b24-url";

describe("isSafeB24Url", () => {
  it("accepts https bitrix24 portals (localized TLDs)", () => {
    expect(isSafeB24Url("https://am35.bitrix24.ru/rest/1/abc/")).toBe(true);
    expect(isSafeB24Url("https://company.bitrix24.com/rest/9/xyz/")).toBe(true);
    expect(isSafeB24Url("https://x.bitrix24.by/rest/1/k/")).toBe(true);
    expect(isSafeB24Url("https://x.bitrix24.kz/rest/1/k/")).toBe(true);
  });

  it("rejects non-https", () => {
    expect(isSafeB24Url("http://am35.bitrix24.ru/rest/1/abc/")).toBe(false);
  });

  it("rejects non-bitrix24 hosts", () => {
    expect(isSafeB24Url("https://evil.example.com/rest/1/abc/")).toBe(false);
    expect(isSafeB24Url("https://bitrix24.fake.com.attacker.io/")).toBe(false);
  });

  it("blocks SSRF pivots (loopback / private / link-local)", () => {
    expect(isSafeB24Url("https://localhost/rest/1/")).toBe(false);
    expect(isSafeB24Url("https://127.0.0.1/rest/1/")).toBe(false);
    expect(isSafeB24Url("https://10.0.0.5/rest/1/")).toBe(false);
    expect(isSafeB24Url("https://192.168.1.1/rest/1/")).toBe(false);
    expect(isSafeB24Url("https://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isSafeB24Url("https://172.16.0.1/rest/1/")).toBe(false);
    expect(isSafeB24Url("https://172.31.255.255/rest/1/")).toBe(false);
    expect(isSafeB24Url("https://0.0.0.0/rest/1/")).toBe(false);
  });

  it("allows public 172.x outside the private 16-31 block", () => {
    expect(isSafeB24Url("https://172.15.0.1.bitrix24.ru/")).toBe(true);
    expect(isSafeB24Url("https://172.32.0.1.bitrix24.ru/")).toBe(true);
  });

  it("rejects garbage input", () => {
    expect(isSafeB24Url("not a url")).toBe(false);
    expect(isSafeB24Url("")).toBe(false);
  });
});

describe("normalizeB24Url", () => {
  it("strips a trailing slash", () => {
    expect(normalizeB24Url("https://x.bitrix24.ru/rest/1/abc/")).toBe(
      "https://x.bitrix24.ru/rest/1/abc"
    );
  });

  it("strips a sample profile method", () => {
    expect(normalizeB24Url("https://x.bitrix24.ru/rest/1/abc/profile.json")).toBe(
      "https://x.bitrix24.ru/rest/1/abc"
    );
    expect(normalizeB24Url("https://x.bitrix24.ru/rest/1/abc/profile")).toBe(
      "https://x.bitrix24.ru/rest/1/abc"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeB24Url("  https://x.bitrix24.ru/rest/1/abc/  ")).toBe(
      "https://x.bitrix24.ru/rest/1/abc"
    );
  });
});
