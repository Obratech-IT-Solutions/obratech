import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { db } from "../firebase";
import type { CrmAccount, CrmActivity, CrmConfig, CrmDeal, DealStage, LeadSource, Niche } from "./crmModel";
import { DEAL_STAGES } from "./crmModel";

export type PromoteInquiryInput = {
  id: string;
  name: string;
  email: string;
  address: string;
  projectCategory: string;
  description: string;
};

const CONFIG_ID = "config";

function tsToStr(t: unknown): string {
  if (t instanceof Timestamp) return t.toDate().toLocaleString();
  return "—";
}

function parseAccount(id: string, d: Record<string, unknown>): CrmAccount {
  const rawNiche = d.niche;
  const niche: Niche =
    rawNiche === "dentist" ||
    rawNiche === "aesthetics" ||
    rawNiche === "private_clinic" ||
    rawNiche === "other"
      ? rawNiche
      : "other";
  return {
    id,
    clinicName: String(d.clinicName ?? ""),
    contactName: String(d.contactName ?? ""),
    email: String(d.email ?? ""),
    phone: String(d.phone ?? ""),
    address: String(d.address ?? ""),
    niche,
    city: String(d.city ?? ""),
    source: String(d.source ?? "website"),
    inquiryId: String(d.inquiryId ?? ""),
    leadScore: typeof d.leadScore === "number" ? d.leadScore : 0,
    ownerUid: String(d.ownerUid ?? ""),
    createdAt: tsToStr(d.createdAt),
    updatedAt: tsToStr(d.updatedAt),
    notes: String(d.notes ?? ""),
    referralDetail: String(d.referralDetail ?? ""),
    extraDetails: String(d.extraDetails ?? ""),
  };
}

function parseDeal(id: string, d: Record<string, unknown>): CrmDeal {
  const st = d.stage;
  const stage: DealStage =
    typeof st === "string" && (DEAL_STAGES as readonly string[]).includes(st) ? (st as DealStage) : "new_lead";
  return {
    id,
    accountId: String(d.accountId ?? ""),
    title: String(d.title ?? ""),
    stage,
    value: typeof d.value === "number" && !Number.isNaN(d.value) ? d.value : 0,
    currency: String(d.currency ?? "PHP"),
    sourceInquiryId: String(d.sourceInquiryId ?? ""),
    ownerUid: String(d.ownerUid ?? ""),
    createdAt: tsToStr(d.createdAt),
    updatedAt: tsToStr(d.updatedAt),
    probability: typeof d.probability === "number" ? Math.max(0, Math.min(100, d.probability)) : 0,
  };
}

function parseActivity(id: string, d: Record<string, unknown>): CrmActivity {
  let dueAt = "—";
  if (d.dueAt instanceof Timestamp) dueAt = d.dueAt.toDate().toISOString();
  let completedAt = "";
  if (d.completedAt instanceof Timestamp) completedAt = d.completedAt.toDate().toISOString();
  return {
    id,
    dealId: String(d.dealId ?? ""),
    accountId: String(d.accountId ?? ""),
    type: String(d.type ?? "task"),
    title: String(d.title ?? ""),
    dueAt,
    completedAt,
    ownerUid: String(d.ownerUid ?? ""),
    createdAt: tsToStr(d.createdAt),
  };
}

function mapNicheFromInquiry(c: PromoteInquiryInput): Niche {
  const p = c.projectCategory;
  if (p === "business") return "private_clinic";
  if (p === "capstone") return "other";
  if (p === "model3d") return "other";
  return "other";
}

export async function fetchCrmAccounts(firestore: Firestore = db): Promise<CrmAccount[]> {
  const snap = await getDocs(collection(firestore, "crm_accounts"));
  return snap.docs.map((x) => parseAccount(x.id, x.data() as Record<string, unknown>));
}

export async function fetchCrmDeals(firestore: Firestore = db): Promise<CrmDeal[]> {
  const snap = await getDocs(collection(firestore, "crm_deals"));
  return snap.docs.map((x) => parseDeal(x.id, x.data() as Record<string, unknown>));
}

export async function fetchCrmActivities(firestore: Firestore = db): Promise<CrmActivity[]> {
  const snap = await getDocs(collection(firestore, "crm_activities"));
  return snap.docs.map((x) => parseActivity(x.id, x.data() as Record<string, unknown>));
}

export async function fetchCrmConfig(firestore: Firestore = db): Promise<CrmConfig> {
  const ref = doc(firestore, "crm_settings", CONFIG_ID);
  const s = await getDoc(ref);
  if (!s.exists()) {
    return { monthlyRevenueTarget: 0, updatedAt: "—" };
  }
  const d = s.data() as Record<string, unknown>;
  return {
    monthlyRevenueTarget: typeof d.monthlyRevenueTarget === "number" ? d.monthlyRevenueTarget : 0,
    updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toDate().toLocaleString() : "—",
  };
}

export async function saveCrmConfig(target: number, user: User, firestore: Firestore = db): Promise<void> {
  const ref = doc(firestore, "crm_settings", CONFIG_ID);
  await setDoc(
    ref,
    {
      monthlyRevenueTarget: Math.max(0, target),
      updatedAt: serverTimestamp(),
      ownerUid: user.uid,
    },
    { merge: true },
  );
}

export async function promoteInquiryToPipeline(user: User, c: PromoteInquiryInput, firestore: Firestore = db): Promise<void> {
  const batch = writeBatch(firestore);
  const accRef = doc(collection(firestore, "crm_accounts"));
  const dealRef = doc(collection(firestore, "crm_deals"));
  const clinicName = c.name.trim() || "Clinic lead";
  batch.set(accRef, {
    clinicName,
    contactName: c.name.trim() || c.email,
    email: c.email,
    address: c.address,
    phone: "",
    niche: mapNicheFromInquiry(c),
    city: "",
    source: "website",
    inquiryId: c.id,
    leadScore: 0,
    referralDetail: "",
    extraDetails: "",
    notes: c.description ? String(c.description).slice(0, 2000) : "",
    ownerUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(dealRef, {
    accountId: accRef.id,
    title: `Opportunity · ${clinicName}`,
    stage: "new_lead",
    value: 0,
    currency: "PHP",
    sourceInquiryId: c.id,
    probability: 10,
    ownerUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const due = new Date();
  due.setDate(due.getDate() + 1);
  due.setHours(17, 0, 0, 0);
  const actRef = doc(collection(firestore, "crm_activities"));
  batch.set(actRef, {
    dealId: dealRef.id,
    accountId: accRef.id,
    type: "follow_up",
    title: "First follow-up — contact lead",
    dueAt: Timestamp.fromDate(due),
    ownerUid: user.uid,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function updateDealStage(dealId: string, stage: DealStage, user: User, firestore: Firestore = db): Promise<void> {
  await updateDoc(doc(firestore, "crm_deals", dealId), {
    stage,
    updatedAt: serverTimestamp(),
    ownerUid: user.uid,
  });
}

export function dealExistsForInquiry(deals: CrmDeal[], inquiryId: string): boolean {
  return deals.some((d) => d.sourceInquiryId === inquiryId);
}

export type ManualLeadInput = {
  clinicName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  niche: Niche;
  source: LeadSource;
  referralDetail: string;
  extraDetails: string;
};

function clip(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : t.slice(0, n);
}

export async function createManualLead(user: User, input: ManualLeadInput, firestore: Firestore = db): Promise<void> {
  const batch = writeBatch(firestore);
  const accRef = doc(collection(firestore, "crm_accounts"));
  const dealRef = doc(collection(firestore, "crm_deals"));
  const clinic = clip(input.clinicName, 300) || "Clinic";
  const contact = clip(input.contactName, 200) || clinic;
  const email = clip(input.email, 320);
  if (email && !email.includes("@")) {
    throw new Error("If provided, email should include an @ (e.g. name@clinic.com).");
  }
  const refDetail = input.source === "referral" ? clip(input.referralDetail, 500) : "";
  const extra = clip(input.extraDetails, 4000);
  const notesLine = [refDetail ? `Referral: ${refDetail}` : "", extra].filter(Boolean).join("\n\n");
  batch.set(accRef, {
    clinicName: clinic,
    contactName: contact,
    email,
    phone: clip(input.phone, 50),
    address: clip(input.address, 1000),
    city: clip(input.city, 200),
    niche: input.niche,
    source: input.source,
    inquiryId: "",
    referralDetail: refDetail,
    extraDetails: extra,
    leadScore: 0,
    notes: notesLine,
    ownerUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(dealRef, {
    accountId: accRef.id,
    title: `Opportunity · ${clinic}`,
    stage: "new_lead" as const,
    value: 0,
    currency: "PHP",
    sourceInquiryId: "",
    probability: 10,
    ownerUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const due = new Date();
  due.setDate(due.getDate() + 1);
  due.setHours(17, 0, 0, 0);
  const actRef = doc(collection(firestore, "crm_activities"));
  batch.set(actRef, {
    dealId: dealRef.id,
    accountId: accRef.id,
    type: "follow_up",
    title: "First follow-up — contact lead",
    dueAt: Timestamp.fromDate(due),
    ownerUid: user.uid,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}
