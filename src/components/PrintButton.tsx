"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-outline btn-sm no-print">
      🖨️ PDF (impression)
    </button>
  );
}
