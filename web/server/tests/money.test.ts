import { describe, expect, it } from "vitest";
import { Decimal, dec, round2, sum, toStorage } from "../src/domain/money.js";

describe("money", () => {
  it("avoids binary floating point drift", () => {
    // The canonical float bug: 0.1 + 0.2 !== 0.3 in IEEE-754.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sum([0.1, 0.2]).toNumber()).toBe(0.3);
    expect(toStorage(sum([0.1, 0.2]))).toBe(0.3);
  });

  it("rounds half-up to two decimal places", () => {
    expect(round2("1234.565").toString()).toBe("1234.57");
    expect(round2("2.675").toString()).toBe("2.68");
    expect(round2("0.004").toString()).toBe("0");
    expect(round2("-1.005").toString()).toBe("-1.01");
  });

  it("sums thousands of cents exactly", () => {
    const values = Array.from({ length: 1000 }, () => "0.01");
    expect(sum(values).toNumber()).toBe(10);
  });

  it("treats null/undefined as zero", () => {
    expect(dec(null).toNumber()).toBe(0);
    expect(dec(undefined).toNumber()).toBe(0);
    expect(toStorage(undefined)).toBe(0);
  });

  it("multiplies quantity by price exactly", () => {
    const qty = new Decimal("3");
    const price = new Decimal("19.99");
    expect(toStorage(qty.times(price))).toBe(59.97);
  });
});
