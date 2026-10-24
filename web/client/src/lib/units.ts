/**
 * Pack-size arithmetic for the manufacturing pack dialog.
 *
 * Stock is held in the finished item's unit (KG, L, UNIT, …). The packer picks
 * the size of one pack in a compatible unit; the dialog derives how many whole
 * packs that makes and what is left over.
 */

export const PACK_UNITS = ["G", "KG", "ML", "L", "UNIT"] as const;
export type PackUnit = (typeof PACK_UNITS)[number];

type Dimension = "mass" | "volume" | "count";

/** Item units (and the pack units) mapped to a dimension and a base factor. */
const MEASURES: Record<string, { dimension: Dimension; toBase: number }> = {
  G: { dimension: "mass", toBase: 1 },
  GRAM: { dimension: "mass", toBase: 1 },
  KG: { dimension: "mass", toBase: 1000 },
  ML: { dimension: "volume", toBase: 1 },
  L: { dimension: "volume", toBase: 1000 },
  UNIT: { dimension: "count", toBase: 1 },
  TABLET: { dimension: "count", toBase: 1 },
  CAPSULE: { dimension: "count", toBase: 1 },
  VIAL: { dimension: "count", toBase: 1 },
  AMPOULE: { dimension: "count", toBase: 1 },
};

export type PackCountResult =
  | { packs: number; packedBulk: number; remainder: number; error?: undefined }
  | { packs: 0; packedBulk: 0; remainder: number; error: string };

/** The pack-unit dropdown value for a finished item's stock unit. */
export function defaultPackUnit(itemUnit: string): PackUnit {
  const measure = MEASURES[itemUnit];
  if (!measure || measure.dimension === "count") return "UNIT";
  return itemUnit === "GRAM" ? "G" : (itemUnit as PackUnit);
}

/**
 * Divide `bulk` (in `itemUnit`) into whole packs of `packSize` `packUnit`.
 * `packedBulk` and `remainder` are returned in `itemUnit`.
 */
export function packCount(
  bulk: number,
  itemUnit: string,
  packSize: number,
  packUnit: string,
): PackCountResult {
  const item = MEASURES[itemUnit];
  const pack = MEASURES[packUnit];
  if (!item) {
    return { packs: 0, packedBulk: 0, remainder: 0, error: `Unknown item unit '${itemUnit}'.` };
  }
  if (!pack) {
    return { packs: 0, packedBulk: 0, remainder: 0, error: `Unknown pack unit '${packUnit}'.` };
  }
  if (item.dimension !== pack.dimension) {
    return {
      packs: 0,
      packedBulk: 0,
      remainder: 0,
      error: `${itemUnit} and ${packUnit} can't be divided — pick a matching unit.`,
    };
  }
  if (!(bulk > 0) || !(packSize > 0)) {
    return {
      packs: 0,
      packedBulk: 0,
      remainder: 0,
      error: "Quantity and pack size must be greater than 0.",
    };
  }

  const bulkBase = bulk * item.toBase;
  const packBase = packSize * pack.toBase;
  // Epsilon absorbs floating point dust (e.g. 0.1 + 0.2) so an exact fit
  // is not knocked down to one pack fewer.
  const packs = Math.floor(bulkBase / packBase + 1e-9);
  if (packs === 0) {
    return {
      packs: 0,
      packedBulk: 0,
      remainder: bulk,
      error: "Pack size is larger than the quantity being packed.",
    };
  }
  const packedBase = packs * packBase;
  return {
    packs,
    packedBulk: packedBase / item.toBase,
    remainder: Math.max(0, (bulkBase - packedBase) / item.toBase),
  };
}

export type PacksBulkResult =
  | { bulk: number; error?: undefined }
  | { bulk: 0; error: string };

/**
 * Bulk (in `itemUnit`) drawn from stock for `packs` packs of `packSize`
 * `packUnit` — the inverse of packCount. The packer knows the pack size and
 * how many packs the run outputs; the quantity consumed is derived.
 */
export function packsToBulk(
  packs: number,
  itemUnit: string,
  packSize: number,
  packUnit: string,
): PacksBulkResult {
  const item = MEASURES[itemUnit];
  const pack = MEASURES[packUnit];
  if (!item) {
    return { bulk: 0, error: `Unknown item unit '${itemUnit}'.` };
  }
  if (!pack) {
    return { bulk: 0, error: `Unknown pack unit '${packUnit}'.` };
  }
  if (item.dimension !== pack.dimension) {
    return {
      bulk: 0,
      error: `${itemUnit} and ${packUnit} can't be divided — pick a matching unit.`,
    };
  }
  if (!(packs > 0) || !(packSize > 0)) {
    return { bulk: 0, error: "Pack size and number of packs must be greater than 0." };
  }
  return { bulk: (packs * packSize * pack.toBase) / item.toBase };
}
