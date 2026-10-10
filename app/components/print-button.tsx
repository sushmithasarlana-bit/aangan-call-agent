"use client";

import { Icon } from "./icons";

export function PrintButton() {
  return (
    <button type="button" className="btn primary" onClick={() => window.print()}>
      <Icon name="file" size={16} /> Print or save as PDF
    </button>
  );
}
