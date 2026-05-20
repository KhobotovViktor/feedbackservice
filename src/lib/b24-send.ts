// Shared Open Channel delivery for Bitrix24.
//
// Used both by the initial dispatch (/api/b24/webhook) and the follow-up
// reminder job (/api/admin/followups). Given a message and the ordered list
// of operator webhooks to try, it locates the OL chat bound to the deal/lead
// (and its contacts) and sends the message via the first operator allowed to
// write into that chat.

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

async function sendToChatViaCandidates(
  sendCandidates: string[],
  type: string,
  id: string,
  message: string
): Promise<boolean> {
  const entityType = type.toLowerCase();
  console.log(`Searching for chat bound to ${entityType} ${id}...`);
  try {
    const chatUrl =
      `${sendCandidates[sendCandidates.length - 1]}/imopenlines.crm.chat.get.json` +
      `?CRM_ENTITY_TYPE=${encodeURIComponent(entityType)}` +
      `&CRM_ENTITY=${encodeURIComponent(id)}` +
      `&ACTIVE_ONLY=N`;
    const chatRes = await fetch(chatUrl);
    const chatData = await chatRes.json();
    if (chatData.error) {
      console.log(
        `imopenlines.crm.chat.get error for ${entityType} ${id}: ${chatData.error_description || chatData.error}`
      );
      return false;
    }

    let chats = chatData.result;
    if (!Array.isArray(chats)) chats = chats ? [chats] : [];

    for (const chat of chats) {
      const chatId = chat?.CHAT_ID ?? chat;
      const chatIdNum = parseInt(String(chatId), 10);
      if (!chatId || Number.isNaN(chatIdNum)) continue;

      for (const sendBase of sendCandidates) {
        const sendWebhookUserId = sendBase.match(/\/rest\/(\d+)\//)?.[1] || "1";

        console.log(
          `Attempting im.message.add via user ${sendWebhookUserId} to Chat ${chatId}...`
        );
        const imRes = await fetch(`${sendBase}/im.message.add.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ DIALOG_ID: `chat${chatId}`, MESSAGE: message }),
        });
        const imData = await imRes.json();
        if (imData.result) {
          console.log(
            `im.message.add OK (msg id ${imData.result}) — user ${sendWebhookUserId} → chat ${chatId}`
          );
          return true;
        }
        if (imData.error === "CANCELED") {
          console.log(
            `im.message.add denied — user ${sendWebhookUserId} is not a member of chat ${chatId}'s Open Line`
          );
        } else {
          console.log(
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
          console.log(
            `imopenlines.crm.message.add OK — user ${sendWebhookUserId} → chat ${chatId}`
          );
          return true;
        }
        console.log(
          `imopenlines.crm.message.add error: ${crmData.error_description || crmData.error || "unknown"}`
        );
      }
    }
  } catch (e) {
    console.error("Error in sendToChatViaCandidates:", e);
  }
  return false;
}

/**
 * Resolve the OL chat for the entity (and its lead/contacts) and deliver the
 * message. Returns true if any candidate webhook accepted it.
 */
export async function dispatchSurveyToOpenChannel(opts: DispatchOpts): Promise<boolean> {
  const { baseUrl, sendCandidates, entityType, entityId, message } = opts;
  let dealData = opts.dealData ?? null;

  console.log(`Open Channel Delivery attempt for ${entityType} ${entityId}`);

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
  let sent = await sendToChatViaCandidates(sendCandidates, entityType, entityId, message);
  if (!sent && dealLeadId)
    sent = await sendToChatViaCandidates(sendCandidates, "lead", dealLeadId, message);
  if (!sent) {
    for (const cid of dealContactIds) {
      sent = await sendToChatViaCandidates(sendCandidates, "contact", cid, message);
      if (sent) break;
    }
  }
  if (!sent && leadContactId && !dealContactIds.includes(leadContactId)) {
    sent = await sendToChatViaCandidates(sendCandidates, "contact", leadContactId, message);
  }

  if (sent) console.log("SUCCESS: Message delivered to Open Channel.");
  else console.log("No Open Channel session accepted the message via any registered webhook.");
  return sent;
}
