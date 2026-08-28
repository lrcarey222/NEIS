"use client";

import type { ReactNode } from "react";

import type { Category } from "@/lib/derive";
import { CONFIDENCE_META, type Confidence } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Category badge — a finding type, or a strategic objective, depending on how
 * the breakouts are framed. The glyph and the word are always rendered; colour
 * is the third signal, never the only one.
 */
export function CategoryChip({
  category,
  size = "sm",
  full = false,
}: {
  category: Category;
  size?: "sm" | "md" | "lg";
  /** Use the long label. Objective names are long, so chips default to short. */
  full?: boolean;
}) {
  const sizing =
    size === "lg"
      ? "text-[0.8125em] px-2.5 py-1"
      : size === "md"
        ? "text-[0.6875em] px-2 py-0.5"
        : "text-[0.625em] px-1.5 py-0.5";

  return (
    <span
      data-accent={category.accent}
      title={full ? undefined : category.label}
      className={cx(
        "type-chip inline-flex items-center gap-1.5 rounded-sm font-mono font-semibold uppercase tracking-[0.1em] whitespace-nowrap",
        sizing,
      )}
    >
      <span aria-hidden="true">{category.glyph}</span>
      {full ? category.label : category.shortName}
    </span>
  );
}

/** Compact bar-graph confidence indicator plus its text label. */
export function ConfidenceTag({ level }: { level: Confidence }) {
  const meta = CONFIDENCE_META[level];
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[0.625em] font-semibold tracking-[0.1em] text-paper-mute uppercase"
      title={meta.label}
    >
      <span aria-hidden="true" className="tracking-tighter">
        {meta.bars}
      </span>
      {meta.short}
    </span>
  );
}

export function RankTag({ rank }: { rank: number }) {
  return (
    <span
      className="tabular inline-flex items-center gap-1 font-mono text-[0.625em] font-semibold tracking-[0.1em] text-paper-mute uppercase"
      title={`Ranked ${rank} by its breakout`}
    >
      <span className="text-paper-faint">RANK</span>
      {rank}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("eyebrow", className)}>{children}</div>;
}

/**
 * Sync indicator. Quiet when healthy, loud when this browser is only talking
 * to its own tabs — that distinction is the difference between five breakout
 * rooms sharing a board and five rooms each editing their own private copy,
 * so LOCAL ONLY is deliberately alarming rather than subtle.
 */
export function StatusDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string; text?: string; title?: string }> = {
    live: { color: "bg-momentum", label: "Live" },
    connecting: { color: "bg-signal", label: "Connecting" },
    local: {
      color: "bg-fragility",
      label: "Local only",
      text: "text-fragility",
      title:
        "Firebase is not configured (or ?local=1 is set). Changes stay in this browser and will NOT reach other devices.",
    },
    empty: { color: "bg-paper-faint", label: "No event" },
  };
  const entry = map[status] ?? map.empty;

  return (
    <span
      title={entry.title}
      className={cx(
        "inline-flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-[0.12em] uppercase",
        entry.text ?? "text-paper-mute",
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", entry.color)} aria-hidden="true" />
      {entry.label}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="hairline rounded-sm border border-dashed p-8 text-center">
      <p className="text-paper-mute text-sm font-medium">{title}</p>
      {hint ? <p className="text-paper-faint mt-1.5 text-xs">{hint}</p> : null}
    </div>
  );
}

/** Inline error/notice strip used across the operator forms. */
export function Notice({
  tone = "error",
  children,
}: {
  tone?: "error" | "warn" | "info" | "success";
  children: ReactNode;
}) {
  const tones = {
    error: "border-fragility/45 text-fragility",
    warn: "border-signal/45 text-signal",
    info: "border-ink-400 text-paper-dim",
    success: "border-momentum/45 text-momentum",
  } as const;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-sm border px-3 py-2 text-sm leading-snug",
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}

/** Renders "• bullet" lines from a textarea as a real list. */
export function EvidenceBlock({ text, className }: { text: string; className?: string }) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const allBulleted = lines.every((line) => /^[•\-*]/.test(line));
  if (!allBulleted) {
    return <p className={cx("whitespace-pre-line", className)}>{text}</p>;
  }

  return (
    <ul className={cx("space-y-1.5", className)}>
      {lines.map((line, index) => (
        <li key={index} className="flex gap-2">
          <span aria-hidden="true" className="text-paper-faint select-none">
            —
          </span>
          <span>{line.replace(/^[•\-*]\s*/, "")}</span>
        </li>
      ))}
    </ul>
  );
}
