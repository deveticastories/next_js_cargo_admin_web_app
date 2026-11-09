"use client";

/**
 * Locations and countries with a coloured dot in front, as in the mobile app. Every place has its
 * own colour, no two alike, and the same one on every screen; the names keep the line's colour.
 */

import { useMemo } from "react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { canonicalPlace } from "@/services/PricingServices";

/** The countries shipped between most keep fixed colours. */
const FIXED: Record<string, string> = { india: "#F28C28", uae: "#1F9D55" };

/** A place's colour key: "Dubai", "U.A.E" and "UAE" are one place; case and spacing don't matter. */
const keyOf = (name: string) => canonicalPlace(name).toLowerCase();

/** HSL → "#rrggbb" — hex works both in CSS and as a jsPDF text colour. */
function hslHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

/**
 * Hue n of a sequence spread round the colour wheel (golden angle), so any number of places get
 * distinct colours; it steps past the hues India and UAE use.
 */
function hueColor(n: number): string {
  let hue = 0;
  for (let i = 0, found = -1; found < n; i++) {
    hue = (210 + i * 137.508) % 360;
    // Leave room round saffron (≈30°) and green (≈145°).
    if (Math.abs(hue - 30) < 12 || Math.abs(hue - 145) < 12) continue;
    found++;
  }
  return hslHex(Math.round(hue), 68, 48);
}

/** Places not in the data yet get the next free colours, in the order they're seen. */
const extra = new Map<string, string>();

/** A place's colour (the one its dot uses), for colouring it outside the page too — e.g. in PDFs. */
export function usePlaceColor() {
  const { countries, senders, receivers, bookings } = useCargoData();
  const colors = useMemo(() => {
    const names = new Set<string>();
    const add = (v: unknown) => {
      const k = keyOf(typeof v === "string" ? v.trim() : "");
      if (k && !FIXED[k]) names.add(k);
    };
    for (const c of countries.items) add(c.name);
    for (const c of senders.items) add(c.location);
    for (const c of receivers.items) {
      add(c.location);
      add(c.country);
    }
    for (const b of bookings.items) {
      add(b.senderLocation);
      add(b.receiverLocation);
      add(b.receiverCountry);
    }
    const map = new Map<string, string>();
    [...names].sort().forEach((k, i) => map.set(k, hueColor(i)));
    return map;
  }, [countries.items, senders.items, receivers.items, bookings.items]);

  return (name: string): string => {
    const k = keyOf(name);
    if (FIXED[k]) return FIXED[k];
    const known = colors.get(k);
    if (known) return known;
    let c = extra.get(k);
    if (!c) {
      c = hueColor(colors.size + extra.size);
      extra.set(k, c);
    }
    return c;
  };
}

const Dot = ({ color }: { color: string }) => <span style={{ color }}>● </span>;

/** "Kochi, India" with a dot each. `single`: one dot for the whole place (the country's, else the location's). */
export function Place({ location, country, single }: { location?: string; country?: string; single?: boolean }) {
  const dotColor = usePlaceColor();
  if (single) {
    const text = [location, country].filter(Boolean).join(", ");
    if (!text) return null;
    return (
      <>
        <Dot color={dotColor(country || location || "")} />
        {text}
      </>
    );
  }
  return (
    <>
      {location && (
        <>
          <Dot color={dotColor(location)} />
          {location}
        </>
      )}
      {location && country && ", "}
      {country && (
        <>
          <Dot color={dotColor(country)} />
          {country}
        </>
      )}
    </>
  );
}
