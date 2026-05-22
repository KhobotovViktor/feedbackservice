// Shared extraction of the editable survey-slide texts + retake frequency
// from a request body, used by both the create and update template routes.

export const TEMPLATE_TEXT_FIELDS = [
  "startTitle",
  "startSubtitle",
  "lowTitle",
  "lowSubtitle",
  "commentPlaceholder",
  "successTitle",
  "successPositive",
  "successNegative",
  "reviewPrompt",
] as const;

export interface TemplateExtras {
  startTitle?: string | null;
  startSubtitle?: string | null;
  lowTitle?: string | null;
  lowSubtitle?: string | null;
  commentPlaceholder?: string | null;
  successTitle?: string | null;
  successPositive?: string | null;
  successNegative?: string | null;
  reviewPrompt?: string | null;
  surveyFrequencyHours?: number;
}

/**
 * Pull the slide-text fields (string → trimmed or null) and the retake
 * frequency (non-negative int hours) out of an untyped body. Only keys
 * present in the body are returned, so PATCH stays partial.
 */
export function extractTemplateExtras(body: Record<string, unknown>): TemplateExtras {
  const data: Record<string, string | number | null> = {};
  for (const f of TEMPLATE_TEXT_FIELDS) {
    const v = body[f];
    if (typeof v === "string") data[f] = v.trim() || null;
  }
  if (body.surveyFrequencyHours !== undefined) {
    const h = parseInt(String(body.surveyFrequencyHours), 10);
    data.surveyFrequencyHours = Number.isFinite(h) && h >= 0 ? h : 0;
  }
  return data as TemplateExtras;
}
