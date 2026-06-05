// Shared Open Channel delivery for Bitrix24.
//
// Used both by the initial dispatch (/api/b24/webhook) and the follow-up
// reminder job (/api/admin/followups). Given a message and the ordered list
// of operator webhooks to try, it locates the OL chat bound to the deal/lead
// (and its contacts) and sends the message via the first operator allowed to
// write into that chat.

import { verbose } from "@/lib/log";

type EntityType = "deal" | "lead";

interface DealLike {
  LEAD_ID?: string;
  CONTACT_ID?: string;
}

interface DispatchOpts {
  /** Default webhook base (used for CRM reads like contact lookups). */
  baseUrl: string;
  /** Ordered operator-webhook bases to try for im.message.add. */
  sendCandidates: string[];
  entityType: EntityType;
  entityId: string;
  message: string;
  /** Optional pre-fetched deal/lead record (saves a round-trip). */
  dealData?: DealLike | null;
}

/** Outcome of an Open Channel send attempt. `usedWebhookUrl` is set when at
 *  least one Bitrix24 webhook actually accepted the message — the caller can
 *  resolve it to a B24Webhook row to fill SentSurvey.responsibleName with the
 *  operator who *actually* talked to the customer. */
export interface DispatchResult {
  ok: boolean;
  usedWebhookUrl?: string;
}

async function sendToChatViaCandidates(
  sendCandidates: string[],
  type: string,
  id: string,
  message: string
): Promise<DispatchResult> {
  const entityType = type.toLowerCase();
  verbose(`Searching for chat bound to ${entityType} ${id}...`);
  try {
    const chatUrl =
      `${sendCandidates[sendCandidates.length - 1]}/imopenlines.crm.chat.get.json` +
      `?CRM_ENTITY_TYPE=${encodeURIComponent(entityType)}` +
      `&CRM_ENTITY=${encodeURIComponent(id)}` +
      `&ACTIVE_ONLY=N`;
    const chatRes = await fetch(chatUrl);
    const chatData = await chatRes.json();
    if (chatData.error) {
      verbose(
        `imopenlines.crm.chat.get error for ${entityType} ${id}: ${chatData.error_description || chatData.error}`
      );
      return { ok: false };
    }

    let chats = chatData.result;
    if (!Array.isArray(chats)) chats = chats ? [chats] : [];

    for (const chat of chats) {
      const chatId = chat?.CHAT_ID ?? chat;
      const chatIdNum = parseInt(String(chatId), 10);
      if (!chatId || Number.isNaN(chatIdNum)) continue;

      for (const sendBase of sendCandidates) {
        const sendWebhookUserId = sendBase.match(/\/rest\/(\d+)\//)?.[1] || "1";

        verbose(
          `Attempting im.message.add via user ${sendWebhookUserId} to Chat ${chatId}...`
        );
        const imRes = await fetch(`${sendBase}/im.message.add.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ DIALOG_ID: `chat${chatId}`, MESSAGE: message }),
        });
        const imData = await imRes.json();
        if (imData.result) {
          verbose(
            `im.message.add OK (msg id ${imData.result}) — user ${sendWebhookUserId} → chat ${chatId}`
          );
          return { ok: true, usedWebhookUrl: sendBase };
        }
        if (imData.error === "CANCELED") {
          verbose(
            `im.message.add denied — user ${sendWebhookUserId} is not a member of chat ${chatId}'s Open Line`
          );
        } else {
          verbose(
            `im.message.add error: ${imData.error_description || imData.error || "unknown"}`
          );
        }

        const entityIdNum = parseInt(id, 10);
        if (Number.isNaN(entityIdNum)) continue;
        const crmRes = await fetch(`${sendBase}/imopenlines.crm.message.add.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            CRM_ENTITY_TYPE: entityType,
            CRM_ENTITY: entityIdNum,
            CHAT_ID: chatIdNum,
            USER_ID: parseInt(sendWebhookUserId, 10) || 1,
            MESSAGE: message,
          }),
        });
        const crmData = await crmRes.json();
        if (crmData.result) {
          verbose(
            `imopenlines.crm.message.add OK — user ${sendWebhookUserId} → chat ${chatId}`
          );
          return { ok: true, usedWebhookUrl: sendBase };
        }
        verbose(
          `imopenlines.crm.message.add error: ${crmData.error_description || crmData.error || "unknown"}`
        );
      }
    }
  } catch (e) {
    console.error("Error in sendToChatViaCandidates:", e);
  }
  return { ok: false };
}

/**
 * Resolve the OL chat for the entity (and its lead/contacts) and deliver the
 * message. Returns whether the message was accepted, and which operator
 * webhook ended up accepting it — that's the operator actually handling the
 * dialog right now and the best signal of "who's responsible for this chat".
 */
export async function dispatchSurveyToOpenChannel(opts: DispatchOpts): Promise<DispatchResult> {
  const { baseUrl, sendCandidates, entityType, entityId, message } = opts;
  let dealData = opts.dealData ?? null;

  verbose(`Open Channel Delivery attempt for ${entityType} ${entityId}`);

  // Lazily fetch the entity if not provided (follow-up path).
  if (!dealData) {
    try {
      const m = entityType === "lead" ? "crm.lead.get.json" : "crm.deal.get.json";
      const r = await fetch(`${baseUrl}/${m}?id=${encodeURIComponent(entityId)}`);
      const j = await r.json();
      dealData = (j.result as DealLike) ?? null;
    } catch (e) {
      console.error("dispatchSurveyToOpenChannel: entity fetch failed", e);
    }
  }

  const dealLeadId =
    entityType === "deal" && dealData?.LEAD_ID ? String(dealData.LEAD_ID) : null;

  type DealContactItem = { CONTACT_ID?: string; IS_PRIMARY?: string };
  const dealContactIds: string[] = [];
  if (entityType === "deal") {
    try {
      const contactsRes = await fetch(
        `${baseUrl}/crm.deal.contact.items.get.json?id=${encodeURIComponent(entityId)}`
      );
      const contactsRaw = await contactsRes.json();
      const items: DealContactItem[] = Array.isArray(contactsRaw.result)
        ? contactsRaw.result
        : [];
      items
        .sort(
          (a, b) =>
            (a.IS_PRIMARY === "Y" ? -1 : 0) - (b.IS_PRIMARY === "Y" ? -1 : 0)
        )
        .forEach((c) => {
          if (c?.CONTACT_ID) dealContactIds.push(String(c.CONTACT_ID));
        });
    } catch (e) {
      console.error("crm.deal.contact.items.get failed", e);
    }
  }
  if (dealContactIds.length === 0 && dealData?.CONTACT_ID) {
    dealContactIds.push(String(dealData.CONTACT_ID));
  }

  let leadContactId: string | null = null;
  if (dealLeadId) {
    try {
      const leadRes = await fetch(
        `${baseUrl}/crm.lead.get.json?id=${encodeURIComponent(dealLeadId)}`
      );
      const leadData = await leadRes.json();
      leadContactId = leadData.result?.CONTACT_ID
        ? String(leadData.result.CONTACT_ID)
        : null;
    } catch (e) {
      console.error("crm.lead.get failed", e);
    }
  }

  // Try order: root entity → deal's lead → deal contacts → lead's contact.
  let result = await sendToChatViaCandidates(sendCandidates, entityType, entityId, message);
  if (!result.ok && dealLeadId)
    result = await sendToChatViaCandidates(sendCandidates, "lead", dealLeadId, message);
  if (!result.ok) {
    for (const cid of dealContactIds) {
      result = await sendToChatViaCandidates(sendCandidates, "contact", cid, message);
      if (result.ok) break;
    }
  }
  if (!result.ok && leadContactId && !dealContactIds.includes(leadContactId)) {
    result = await sendToChatViaCandidates(sendCandidates, "contact", leadContactId, message);
  }

  if (result.ok) verbose("SUCCESS: Message delivered to Open Channel.");
  else verbose("No Open Channel session accepted the message via any registered webhook.");
  return result;
}
