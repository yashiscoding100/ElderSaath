export type ElderUiStyle = "MODERN" | "CLASSIC"

export function parseElderUiStyle(notes?: string | null): ElderUiStyle {
  if (!notes) return "MODERN"
  if (notes.includes("[UI_STYLE:CLASSIC]")) return "CLASSIC"
  return "MODERN"
}

export function encodeElderUiStyle(currentNotes: string | null | undefined, style: ElderUiStyle): string {
  const cleaned = (currentNotes || "")
    .replace(/\[UI_STYLE:(MODERN|CLASSIC)\]/g, "")
    .trim()
  
  if (style === "CLASSIC") {
    return cleaned ? `[UI_STYLE:CLASSIC] ${cleaned}` : "[UI_STYLE:CLASSIC]"
  } else {
    return cleaned ? `[UI_STYLE:MODERN] ${cleaned}` : "[UI_STYLE:MODERN]"
  }
}
