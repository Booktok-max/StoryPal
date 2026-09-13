import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, UploadCloud, FileText, BookText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { ImportJob } from "../types";
import { uploadImportFile, listImportJobs } from "../api/client";

interface ImportBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABEL: Record<ImportJob["status"], string> = {
  queued: "Queued",
  processing: "Processing",
  "pending-review": "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Failed",
};

const STATUS_STYLE: Record<ImportJob["status"], string> = {
  queued: "bg-stone-100 text-stone-600",
  processing: "bg-sky-100 text-sky-700",
  "pending-review": "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  failed: "bg-rose-100 text-rose-700",
};

export const ImportBookModal: React.FC<ImportBookModalProps> = ({ isOpen, onClose }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const { jobs } = await listImportJobs();
      setJobs(jobs);
    } catch {
      // Non-fatal: the upload panel still works even if history fails to load.
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) refreshJobs();
  }, [isOpen, refreshJobs]);

  if (!isOpen) return null;

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setError("");

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".epub") && !lower.endsWith(".pdf")) {
      setError("Only .epub and .pdf files are supported.");
      return;
    }

    setUploading(true);
    try {
      const { job } = await uploadImportFile(file);
      setJobs((prev) => [job, ...prev]);
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-amber-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold mb-2">
              <UploadCloud className="w-3.5 h-3.5" />
              Add Your Own Book
            </div>
            <h3 className="font-display font-extrabold text-stone-900 leading-tight">
              Upload an EPUB or PDF
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Private to your family — never shown in the public catalog.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Drop zone */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              dragging ? "border-amber-500 bg-amber-50" : "border-stone-200 hover:border-amber-300 hover:bg-amber-50/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub,.pdf,application/epub+zip,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {uploading ? (
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 text-amber-400" />
            )}
            <p className="text-sm font-bold text-stone-700">
              {uploading ? "Uploading…" : "Drop a file here, or click to choose"}
            </p>
            <p className="text-xs text-stone-400">.epub or .pdf, up to 50MB</p>
          </label>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Job history */}
          <div>
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
              Your uploads
            </h4>
            {loadingJobs && jobs.length === 0 ? (
              <p className="text-xs text-stone-400">Loading…</p>
            ) : jobs.length === 0 ? (
              <p className="text-xs text-stone-400">No uploads yet.</p>
            ) : (
              <ul className="space-y-2">
                {jobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-stone-100 bg-stone-50/60"
                  >
                    {job.format === "pdf" ? (
                      <FileText className="w-4 h-4 text-stone-400 shrink-0" />
                    ) : (
                      <BookText className="w-4 h-4 text-stone-400 shrink-0" />
                    )}
                    <span className="flex-1 text-xs font-medium text-stone-700 truncate">
                      {job.filename || "Untitled upload"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${STATUS_STYLE[job.status]}`}
                    >
                      {job.status === "approved" && <CheckCircle2 className="w-3 h-3" />}
                      {STATUS_LABEL[job.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-stone-400 leading-relaxed">
            Uploaded books are queued for processing and won&apos;t appear on the shelf until
            they&apos;ve finished being prepared for reading. This can take a little while.
          </p>
        </div>
      </div>
    </div>
  );
};
