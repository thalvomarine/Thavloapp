export type ChartPinKind = "marina" | "anchorage" | "fuel" | "hazard" | "lighthouse" | "restaurant" | "own";

const FILL: Record<ChartPinKind, string> = {
  marina: "#22d3ee",
  anchorage: "#34d399",
  fuel: "#fbbf24",
  hazard: "#fb7185",
  lighthouse: "#fde68a",
  restaurant: "#c4b5fd",
  own: "#67e8f9",
};

const GLYPH: Record<ChartPinKind, string> = {
  marina:
    '<path d="M12 3v2.2M8.2 20h7.6M12 5.2l6.2 4.2H5.8L12 5.2zM7 11.2h10v2.2H7z" fill="none" stroke="#041018" stroke-width="1.7" stroke-linejoin="round"/>',
  anchorage:
    '<path d="M12 4v11M8 8.5h8M12 15c-3.2 0-5 1.8-5 4h10c0-2.2-1.8-4-5-4z" fill="none" stroke="#041018" stroke-width="1.7" stroke-linecap="round"/>',
  fuel:
    '<path d="M8 19V6.5A1.5 1.5 0 0 1 9.5 5h4A1.5 1.5 0 0 1 15 6.5V19M8 10h7M15 8.5h1.4a2 2 0 0 1 2 2V14a1.6 1.6 0 1 1-3.2 0" fill="none" stroke="#041018" stroke-width="1.7" stroke-linecap="round"/>',
  hazard:
    '<path d="M12 4.5 20 19H4L12 4.5zM12 10v4M12 16.2v.6" fill="none" stroke="#041018" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>',
  lighthouse:
    '<path d="M12 4v2M9.5 20h5M10 18V9.5h4V18M9 9.5h6M8 7.2 10 9.5M16 7.2 14 9.5" fill="none" stroke="#041018" stroke-width="1.7" stroke-linecap="round"/>',
  restaurant:
    '<path d="M8 4.5v6a2 2 0 0 0 2 2V20M14 4.5v15M17 4.5v6" fill="none" stroke="#041018" stroke-width="1.7" stroke-linecap="round"/>',
  own: '<circle cx="12" cy="12" r="3.2" fill="#041018"/>',
};

/** Map pin markup. Anchor sits on the tip. */
export function chartPinHtml(kind: ChartPinKind): string {
  const fill = FILL[kind];
  return `<div style="width:36px;height:46px;filter:drop-shadow(0 6px 8px rgba(0,0,0,.45))">
    <div style="width:36px;height:36px;border-radius:18px;background:${fill};border:2px solid #fff;box-shadow:0 0 0 4px ${fill}55;display:grid;place-items:center">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">${GLYPH[kind]}</svg>
    </div>
    <div style="width:0;height:0;margin:-3px auto 0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:11px solid ${fill}"></div>
  </div>`;
}

export const CHART_PIN_SIZE: [number, number] = [36, 46];
export const CHART_PIN_ANCHOR: [number, number] = [18, 46];
