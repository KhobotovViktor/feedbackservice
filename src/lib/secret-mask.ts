// Settings keys whose values are secrets (a bot password / a webhook with an
// embedded token). GET /api/settings returns SECRET_MASK in their place so the
// plaintext never leaves the server in the bulk settings payload; POST treats
// an incoming SECRET_MASK as "keep the stored value" (so re-saving the form
// without re-typing a secret doesn't blank or leak it). Shared by the API
// route, the integration page and the "test" endpoints.

export const SECRET_SETTING_KEYS = ["telegram_bot_token", "b24_webhook_url"] as const;

export const SECRET_MASK = "__SECRET_SAVED__";

export function isSecretKey(key: string): boolean {
  return (SECRET_SETTING_KEYS as readonly string[]).includes(key);
}
