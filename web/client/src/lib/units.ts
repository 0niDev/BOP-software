/**
 * Pack-size arithmetic for the packing form.
 *
 * Stock is held in the unpacked item's unit (KG, LIT, UNIT, …). The packer
 * enters the size of one item and how many items the run makes, and the bulk
 * drawn from stock is derived. The unit picker offers two metric pairs — g/ml
 * and kg/lit — so an item added to inventory at the wrong scale (a 500 g item
 * typed in as kg) still converts: the pair only sets the scale, the item's own
 * dimension decides whether it is grams or millilitres. Counted items use
 * `unit`.
 */

export const PACK_UNITS = ["G_ML", "KG_LIT", "UNIT"] as const;
export type PackUnit = (typeof PACK_UNITS)[number];

export const PACK_UNIT_LABELS: Record<PackUnit, string> = {
  G_ML: "g/ml",
  KG_LIT: "kg/lit",
  UNIT: "unit",
};

type Dimension = "mass" | "volume" | "count";

/** Item units mapped to a dimension and a base factor (g / ml / each). */
const MEASURES: Record<string, { dimension: Dimension; toBase: number }> = {
  G: { dimension: "mass", toBase: 1 },
  GRAM: { dimension: "mass", toBase: 1 },
  KG: { dimension: "mass", toBase: 1000 },
  ML: { dimension: "volume", toBase: 1 },
  L: { dimension: "volume", toBase: 1000 },
  LIT: { dimension: "volume", toBase: 1000 },
  UNIT: { dimension: "count", toBase: 1 },
  TABLET: { dimension: "count", toBase: 1 },
  CAPSULE: { dimension: "count", toBase: 1 },
  VIAL: { dimension: "count", toBase: 1 },
  AMPOULE: { dimension: "count", toBase: 1 },
};

/** Base factor for a pack pair (g/ml = 1, kg/lit = 1000). */
const PACK_FACTORS: Record<PackUnit, number> = { G_ML: 1, KG_LIT: 1000, UNIT: 1 };

/** The pack-unit choice for an item's stock unit. */
export function defaultPackUnit(itemUnit: string): PackUnit {
  const measure = MEASURES[itemUnit];
  if (!measure || measure.dimension === "count") return "UNIT";
  return measure.toBase >= 1000 ? "KG_LIT" : "G_ML";
}

export type PacksBulkResult =
  | { bulk: number; error?: undefined }
  | { bulk: 0; error: string };

/**
 * Bulk (in `itemUnit`) drawn from stock for `packs` items of `packSize` in the
 * chosen pair. The pair is dimension-agnostic for mass/volume items, so
 * `500 g/ml` on a kg item consumes 0.5 kg and on a litre item consumes 0.5 lit.
 */
export function packsToBulk(
  packs: number,
  itemUnit: string,
  packSize: number,
  packUnit: string,
): PacksBulkResult {
  const item = MEASURES[itemUnit];
  if (!item) return { bulk: 0, error: `Unknown item unit '${itemUnit}'.` };
  const factor = PACK_FACTORS[packUnit as PackUnit];
  if (!factor) return { bulk: 0, error: `Unknown pack unit '${packUnit}'.` };
  if (packUnit === "UNIT" && item.dimension !== "count") {
    return { bulk: 0, error: `Pick g/ml or kg/lit for a ${item.dimension} item.` };
  }
  if (packUnit !== "UNIT" && item.dimension === "count") {
    return { bulk: 0, error: "Pick unit for a counted item." };
  }
  if (!(packs > 0) || !(packSize > 0)) {
    return { bulk: 0, error: "Size per item and items generated must be greater than 0." };
  }
  return { bulk: (packs * packSize * factor) / item.toBase };
}
