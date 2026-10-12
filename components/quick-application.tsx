"use client";
import { useState, type FormEvent } from "react";
import { applicationStages, type Job } from "@/lib/model";
import { todayKey } from "@/lib/planner";
import { Field, Modal } from "./ui";
export default function QuickApplication({
  job,
  busy,
  error,
  onClose,
  onSave,
  initialStage = "已投递",
}: {
  job?: Job;
  initialStage?: Job["stage"];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (draft: {
    company: string;
    title: string;
    appliedDate: string;
    stage: Job["stage"];
  }) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState({
    company: job?.company ?? "",
    title: job?.title ?? "",
    appliedDate: job?.appliedDate ?? todayKey(),
    stage: job?.stage ?? initialStage,
  });
  const choices = applicationStages.includes(
    (job?.stage ?? initialStage) as (typeof applicationStages)[number],
  )
    ? applicationStages
    : [job?.stage ?? initialStage, ...applicationStages];
  return (
    <Modal
      title={job ? "编辑投递" : "新增投递"}
      error={error}
      onClose={onClose}
    >
      <form
        onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          if (await onSave(draft)) onClose();
        }}
      >
        <div className="form-grid">
          <Field label="公司 *">
            <input
              autoFocus
              required
              maxLength={200}
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            />
          </Field>
          <Field label="岗位名称 *">
            <input
              required
              maxLength={200}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field label="投递日期">
            <input
              type="date"
              value={draft.appliedDate}
              onChange={(e) =>
                setDraft({ ...draft, appliedDate: e.target.value })
              }
            />
          </Field>
          <Field label="当前流程">
            <select
              value={draft.stage}
              onChange={(e) =>
                setDraft({ ...draft, stage: e.target.value as Job["stage"] })
              }
            >
              {choices.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-footer">
          <button type="button" className="button" onClick={onClose}>
            取消
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "保存中…" : "保存投递"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
