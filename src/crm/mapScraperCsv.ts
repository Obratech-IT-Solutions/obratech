/**
 * Parser for map-scraper style CSV → Firestore `inquiries` (Leads inbox).
 * No pipeline until the user clicks "Add to pipeline".
 */

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          f += '"';
          i++;
        } else {
          q = false;
        }
      } else {
        f += c;
      }
    } else if (c === '"') {
      q = true;
    } else if (c === ",") {
      out.push(f);
      f = "";
    } else {
      f += c;
    }
  }
  out.push(f);
  return out;
}

function clip(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : t.slice(0, n);
}

function stripOwnerSuffix(name: string): string {
  return name.replace(/\s*\(owner\)\s*$/i, "").trim();
}

function normalizeEmail(raw: string): string {
  const t = raw.trim();
  if (!t || !t.includes("@")) return "";
  const first = t.split(/[\s,;]+/).find((x) => x.includes("@"));
  return first && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first) ? first : "";
}

function formatWebNote(w: string): string {
  const t = w.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

function colIdx(header: string[], ...names: string[]): number {
  const low = header.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const i = low.indexOf(n.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function getCell(row: string[], header: string[], ...names: string[]): string {
  const i = colIdx(header, ...names);
  if (i < 0 || i >= row.length) return "";
  return row[i] ?? "";
}

/** Payload for `inquiries` collection (plus createdAt in API). */
export type MapInquiryWrite = {
  name: string;
  email: string;
  address: string;
  clientKind: string;
  services: string[];
  projectCategory: string;
  description: string;
  meetingDate: string;
  consent: boolean;
  importSource: "map_csv";
  importPlaceId: string;
  importCategory: string;
  importPhone: string;
};

export type ParseMapScraperResult = {
  rows: MapInquiryWrite[];
  parseErrors: string[];
};

export function parseMapScraperCsv(text: string): ParseMapScraperResult {
  const parseErrors: string[] = [];
  const norm = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = norm.split("\n").filter((ln) => ln.trim() !== "");
  if (lines.length < 2) {
    return { rows: [], parseErrors: ["CSV has no data rows."] };
  }

  const header = parseCsvLine(lines[0]!);
  const placeI = colIdx(header, "Place_name", "place_name");
  const addrI = colIdx(header, "Address1", "address1", "Address");
  if (placeI < 0 || addrI < 0) {
    return {
      rows: [],
      parseErrors: [
        'Missing required columns. Expected at least "Place_name" and "Address1" (map-scraper style export).',
      ],
    };
  }

  const rows: MapInquiryWrite[] = [];

  for (let r = 1; r < lines.length; r++) {
    const row = parseCsvLine(lines[r]!);
    if (row.length < 2) continue;
    const placeName = stripOwnerSuffix(getCell(row, header, "Place_name"));
    const address = getCell(row, header, "Address1", "Address").trim();
    if (!placeName && !address) {
      parseErrors.push(`Row ${r + 1}: empty name and address — skipped.`);
      continue;
    }
    const clinic = clip(placeName || address, 300) || "Clinic";
    const phone = clip(getCell(row, header, "Phone"), 50);
    const email = normalizeEmail(getCell(row, header, "emails", "email", "Email"));
    const category = getCell(row, header, "Category");
    const hours = getCell(row, header, "Hours");
    const loc = getCell(row, header, "Location");
    const reviews = getCell(row, header, "Reviewscount", "reviewscount");
    const score = getCell(row, header, "Total_score", "total_score");
    const site = getCell(row, header, "website", "Website");
    const placeId = getCell(row, header, "Place_id", "place_id");
    const lat = getCell(row, header, "Latitude", "latitude");
    const lon = getCell(row, header, "Longitude", "longitude");
    const claimed = getCell(row, header, "Claimed", "claimed");

    const siteLine = site ? `Web/social: ${formatWebNote(site)}` : "";
    const bodyParts = [
      "Imported from map CSV. Open Add to pipeline when ready.",
      phone ? `Phone: ${phone}` : "",
      placeId ? `Place ID: ${placeId}` : "",
      loc ? `Maps: ${loc}` : "",
      category ? `Category: ${category}` : "",
      hours ? `Hours: ${clip(hours, 500)}` : "",
      reviews || score ? `Reviews: ${reviews || "—"} · Rating: ${score || "—"}` : "",
      lat && lon ? `Lat/Lng: ${lat}, ${lon}` : "",
      claimed ? `GBP claimed: ${claimed}` : "",
      siteLine,
    ];
    const description = clip(bodyParts.filter(Boolean).join("\n"), 4000);

    rows.push({
      name: clinic,
      email,
      address: clip(address, 1000) || "—",
      clientKind: "business",
      services: [],
      projectCategory: "business",
      description,
      meetingDate: "",
      consent: true,
      importSource: "map_csv",
      importPlaceId: placeId || `row-${r}`,
      importCategory: clip(category, 500),
      importPhone: phone,
    });
  }

  if (rows.length === 0) parseErrors.push("No valid data rows were parsed.");
  return { rows, parseErrors };
}
