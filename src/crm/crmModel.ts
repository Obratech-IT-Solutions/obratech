/** V1 Obratech sales CRM — Firestore document shapes (crm_* collections). */

export const DEAL_STAGES = [
  "new_lead",
  "attempting_contact",
  "contacted",
  "qualified",
  "discovery_scheduled",
  "needs_analysis_done",
  "demo_scheduled",
  "demo_completed",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
  "nurture_later",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const STAGE_LABELS: Record<DealStage, string> = {
  new_lead: "New lead",
  attempting_contact: "Attempting contact",
  contacted: "Contacted",
  qualified: "Qualified",
  discovery_scheduled: "Discovery scheduled",
  needs_analysis_done: "Needs analysis done",
  demo_scheduled: "Demo scheduled",
  demo_completed: "Demo completed",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
  nurture_later: "Nurture later",
};

export type Niche = "dentist" | "aesthetics" | "private_clinic" | "other";

export type CrmAccount = {
  id: string;
  clinicName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  niche: Niche;
  city: string;
  source: string;
  inquiryId: string;
  leadScore: number;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
};

export type CrmDeal = {
  id: string;
  accountId: string;
  title: string;
  stage: DealStage;
  value: number;
  currency: string;
  sourceInquiryId: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
  probability: number;
};

export type CrmActivity = {
  id: string;
  dealId: string;
  accountId: string;
  type: string;
  title: string;
  dueAt: string;
  completedAt: string;
  ownerUid: string;
  createdAt: string;
};

export type CrmConfig = {
  monthlyRevenueTarget: number;
  updatedAt: string;
};
