import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchSurveyToOpenChannel, inspectChatStatus } from "../b24-send";

describe("inspectChatStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("correctly parses active session and bound deal from Open Lines dialog", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        result: {
          entity_type: "LINES",
          entity_data_1: "Y|DEAL|476489|N|N|127385|1789591314|0|0|0",
          entity_data_2: "LEAD|0|COMPANY|0|CONTACT|248081|DEAL|476489",
        },
      }),
    } as unknown as Response);

    const status = await inspectChatStatus("https://test.bitrix24.ru", "203019");
    expect(status.isLines).toBe(true);
    expect(status.boundEntityType).toBe("deal");
    expect(status.boundEntityId).toBe("476489");
    expect(status.sessionActive).toBe(true);
    expect(status.sessionId).toBe(127385);
  });

  it("identifies closed session when session_id is 0", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        result: {
          entity_type: "LINES",
          entity_data_1: "Y|DEAL|476337|N|N|0|1789536123|0|0|0",
          entity_data_2: "LEAD|0|COMPANY|0|CONTACT|245681|DEAL|476337",
        },
      }),
    } as unknown as Response);

    const status = await inspectChatStatus("https://test.bitrix24.ru", "197789");
    expect(status.isLines).toBe(true);
    expect(status.boundEntityType).toBe("deal");
    expect(status.boundEntityId).toBe("476337");
    expect(status.sessionActive).toBe(false);
    expect(status.sessionId).toBe(0);
  });

  it("handles non-LINES chats gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        result: {
          entity_type: "CHAT",
        },
      }),
    } as unknown as Response);

    const status = await inspectChatStatus("https://test.bitrix24.ru", "999");
    expect(status.isLines).toBe(false);
    expect(status.sessionActive).toBe(false);
  });

  it("handles fetch errors gracefully without throwing", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network offline"));

    const status = await inspectChatStatus("https://test.bitrix24.ru", "123");
    expect(status.isLines).toBe(false);
    expect(status.sessionActive).toBe(false);
  });
});

describe("dispatchSurveyToOpenChannel requireClosedSession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("skips active Open Lines sessions without sending or falling back to contacts", async () => {
    const calledUrls: string[] = [];
    global.fetch = vi.fn().mockImplementation(async (input: string | URL) => {
      const url = String(input);
      calledUrls.push(url);
      if (url.includes("imopenlines.crm.chat.get.json")) {
        return { json: async () => ({ result: [{ CHAT_ID: "211145" }] }) } as unknown as Response;
      }
      if (url.includes("im.dialog.get.json")) {
        return {
          json: async () => ({
            result: {
              entity_type: "LINES",
              entity_data_1: "Y|LEAD|627009|N|N|133263|1789591314|0|0|0",
            },
          }),
        } as unknown as Response;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const result = await dispatchSurveyToOpenChannel({
      baseUrl: "https://test.bitrix24.ru/rest/1/sec",
      sendCandidates: ["https://test.bitrix24.ru/rest/1/sec"],
      entityType: "lead",
      entityId: "627009",
      message: "Survey",
      dealData: { CONTACT_ID: "999" },
      requireClosedSession: true,
    });

    expect(result).toEqual({ ok: false, reason: "active_session" });
    expect(calledUrls.some((u) => u.includes("im.message.add"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("CRM_ENTITY_TYPE=contact"))).toBe(false);
  });

  it("delivers when requireClosedSession is true and session is closed", async () => {
    global.fetch = vi.fn().mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("imopenlines.crm.chat.get.json")) {
        return { json: async () => ({ result: [{ CHAT_ID: "211145" }] }) } as unknown as Response;
      }
      if (url.includes("im.dialog.get.json")) {
        return {
          json: async () => ({
            result: {
              entity_type: "LINES",
              entity_data_1: "Y|LEAD|627009|N|N|0|1789591314|0|0|0",
            },
          }),
        } as unknown as Response;
      }
      if (url.includes("im.message.add.json")) {
        return { json: async () => ({ result: 9001 }) } as unknown as Response;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const result = await dispatchSurveyToOpenChannel({
      baseUrl: "https://test.bitrix24.ru/rest/1/sec",
      sendCandidates: ["https://test.bitrix24.ru/rest/1/sec"],
      entityType: "lead",
      entityId: "627009",
      message: "Survey",
      dealData: {},
      requireClosedSession: true,
    });

    expect(result).toEqual({
      ok: true,
      usedWebhookUrl: "https://test.bitrix24.ru/rest/1/sec",
    });
  });
});
