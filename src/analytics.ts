/**
 * Firebase / GA4 events for Obratech — funnel, CRM usage, and conversions.
 * No PII in parameters. Safe to no-op when Analytics is blocked.
 */

import { logEvent, type Analytics } from "firebase/analytics";
import { getOrInitAnalytics } from "./firebase";

function logParams(a: Analytics | null, name: string, params?: Record<string, string | number | boolean>) {
  if (!a) return;
  try {
    logEvent(a, name, params);
  } catch {
    /* ignore: ad blockers, privacy mode */
  }
}

function withAnalytics(fn: (a: Analytics) => void) {
  const a = getOrInitAnalytics();
  if (a) fn(a);
}

export const track = {
  /** Public: inquiry form completed and stored in Firestore. */
  inquirySubmitted() {
    withAnalytics((a) => logParams(a, "inquiry_submit", { flow: "website_form" }));
  },

  /** Admin: email/password sign-in succeeded. */
  adminLogin() {
    withAnalytics((a) => logEvent(a, "login", { method: "email" }));
  },

  /** CRM: primary navigation. */
  crmView(view: "dashboard" | "analytics" | "leads" | "pipeline" | "settings") {
    withAnalytics((a) => logParams(a, "crm_view", { screen: view }));
  },

  crmInquiryToPipeline() {
    withAnalytics((a) => logParams(a, "crm_inquiry_to_pipeline", {}));
  },

  crmImportCsvRowCount(count: number) {
    withAnalytics((a) => logParams(a, "crm_import_csv", { row_count: count }));
  },

  crmManualLeadCreated() {
    withAnalytics((a) => logParams(a, "crm_manual_lead", {}));
  },

  crmInquiryDeleted() {
    withAnalytics((a) => logParams(a, "crm_inquiry_delete", {}));
  },

  crmDealDeleted() {
    withAnalytics((a) => logParams(a, "crm_deal_delete", {}));
  },

  /** Pipeline: deal moved to a new stage. */
  crmDealStageChange(stage: string) {
    withAnalytics((a) => logParams(a, "crm_deal_stage_change", { deal_stage: stage.slice(0, 80) }));
  },
};
