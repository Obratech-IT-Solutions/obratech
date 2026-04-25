import { useId, useRef, useState } from "react";
import type { ChangeEventHandler, FormEvent } from "react";
import type { User } from "firebase/auth";
import { FileUp, X } from "lucide-react";
import { track } from "./analytics";
import { importInquiriesFromMapCsv } from "./crm/crmApi";
import { parseMapScraperCsv } from "./crm/mapScraperCsv";

type Props = {
  user: User;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

const SAMPLE_CSV = "/imports/tuguegarao-maps-dental.csv";

export default function CrmImportCsvModal({ user, open, onClose, onImported }: Props) {
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [textSnapshot, setTextSnapshot] = useState<string | null>(null);

  if (!open) return null;

  const loadText = (text: string, name: string) => {
    setErr(null);
    setResultMsg(null);
    setFileName(name);
    setTextSnapshot(text);
    const { rows, parseErrors } = parseMapScraperCsv(text);
    setPreviewCount(rows.length);
    setParseWarnings(parseErrors);
  };

  const onPickFile: ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") loadText(reader.result, f.name);
    };
    reader.readAsText(f, "UTF-8");
  };

  const loadSample = () => {
    setErr(null);
    setResultMsg(null);
    void fetch(SAMPLE_CSV)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load sample file.");
        return r.text();
      })
      .then((t) => loadText(t, "tuguegarao-maps-dental.csv (sample)"))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };

  const runImport = async (e: FormEvent) => {
    e.preventDefault();
    if (!textSnapshot) {
      setErr("Choose a CSV file first.");
      return;
    }
    setErr(null);
    setResultMsg(null);
    setImporting(true);
    try {
      const { rows, parseErrors } = parseMapScraperCsv(textSnapshot);
      if (rows.length === 0) {
        setErr(parseErrors.join(" ") || "No rows to import.");
        return;
      }
      const { ok, failed } = await importInquiriesFromMapCsv(user, rows);
      if (failed.length === 0) {
        setResultMsg(
          `Imported ${ok} row(s) into Leads inbox. Open “Add to pipeline” on each card when you want it in the sales pipeline.`,
        );
        onImported();
        setTextSnapshot(null);
        setFileName(null);
        setPreviewCount(0);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        const detail = failed.map((f) => `#${f.index} ${f.name}: ${f.error}`).join(" · ");
        if (ok > 0) track.crmImportCsvRowCount(ok);
        setResultMsg(`Imported ${ok} of ${rows.length}. Failed: ${detail}`);
        if (
          ok === 0 &&
          failed.some((f) => /permission|insufficient/i.test(f.error))
        ) {
          setErr(
            "Every row was blocked (often missing Firestore rules). From the repo root run: npm run deploy:rules — then import again.",
          );
        }
        if (ok > 0) onImported();
      }
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="crm-modal-root" role="dialog" aria-modal="true" aria-labelledby="crm-import-csv-title">
      <button type="button" className="crm-modal-backdrop" aria-label="Close" onClick={onClose} />
      <form className="crm-modal-dialog crm-modal-dialog-wide" onSubmit={(ev) => void runImport(ev)}>
        <button type="button" className="crm-modal-x" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2 id="crm-import-csv-title" className="crm-modal-title">
          Import leads from CSV
        </h2>
        <p className="crm-modal-sub">
          Map-scraper columns such as <code>Place_name</code>, <code>Address1</code>, <code>Phone</code>,{" "}
          <code>Category</code>, <code>Location</code>, <code>Place_id</code>. Each row becomes an <strong>inbox lead</strong>
          — use <strong>Add to pipeline</strong> on the card when you are ready (nothing is added to pipeline automatically).
        </p>

        {err ? (
          <div className="crm-modal-error" role="alert">
            {err}
          </div>
        ) : null}
        {resultMsg ? (
          <div className="crm-modal-success" role="status">
            {resultMsg}
          </div>
        ) : null}

        <div className="crm-field">
          <span className="crm-field-label" id={`${fileId}-label`}>
            CSV file
          </span>
          <div className="crm-import-csv-row">
            <input
              ref={fileRef}
              id={`${fileId}-file`}
              className="crm-input-file"
              type="file"
              accept=".csv,text/csv"
              onChange={onPickFile}
              aria-labelledby={`${fileId}-label`}
            />
            <button type="button" className="crm-btn-text crm-import-sample" onClick={loadSample}>
              <FileUp size={16} strokeWidth={2} aria-hidden />
              Use Tuguegarao sample
            </button>
          </div>
        </div>

        {fileName ? (
          <p className="crm-import-preview">
            <strong>{fileName}</strong> — <strong>{previewCount}</strong> lead(s) ready
          </p>
        ) : null}
        {parseWarnings.length > 0 ? (
          <ul className="crm-import-warnings" role="note">
            {parseWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        <div className="crm-modal-actions">
          <button type="button" className="crm-btn-ghost" onClick={onClose} disabled={importing}>
            Close
          </button>
          <button type="submit" className="crm-btn-primary" disabled={importing || previewCount === 0}>
            {importing ? "Importing…" : "Import to CRM"}
          </button>
        </div>
      </form>
    </div>
  );
}
