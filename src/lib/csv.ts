/** RFC 4180 escaping. Excel is the target consumer, so CRLF line endings. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  // Leading BOM so Excel opens UTF-8 accented characters correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
