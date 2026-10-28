import { describe, expect, it } from "vitest";
import { assignDisplayCodes, type DisplayCodeNode } from "../src/services/displayCodes.js";

const node = (
  id: number,
  accountCode: string,
  parentAccountId: number | null = null,
  isActive = true,
): DisplayCodeNode => ({ id, accountCode, parentAccountId, isActive });

describe("assignDisplayCodes", () => {
  it("numbers the tree 1 / 11 / 111 / 1111, one digit per level", () => {
    const codes = assignDisplayCodes([
      node(1, "1"),
      node(2, "2"),
      node(3, "11", 1),
      node(4, "12", 1),
      node(5, "111", 3),
      node(6, "112", 3),
      node(7, "1111", 5),
    ]);
    expect(codes.get(1)).toBe("1");
    expect(codes.get(2)).toBe("2");
    expect(codes.get(3)).toBe("11");
    expect(codes.get(4)).toBe("12");
    expect(codes.get(5)).toBe("111");
    expect(codes.get(6)).toBe("112");
    expect(codes.get(7)).toBe("1111");
  });

  it("continues past the ninth sibling with a1..a9, b1..", () => {
    const children = Array.from({ length: 19 }, (_, i) => node(10 + i, `52${i + 1}`, 1));
    const codes = assignDisplayCodes([node(1, "5"), ...children]);
    expect(codes.get(10)).toBe("11");
    expect(codes.get(18)).toBe("19");
    expect(codes.get(19)).toBe("1a1"); // 10th child
    expect(codes.get(27)).toBe("1a9"); // 18th child
    expect(codes.get(28)).toBe("1b1"); // 19th child
  });

  it("numbers active siblings first so the default view is contiguous", () => {
    const codes = assignDisplayCodes([
      node(1, "1"),
      node(2, "110", 1, false),
      node(3, "111", 1),
      node(4, "112", 1),
    ]);
    expect(codes.get(3)).toBe("11");
    expect(codes.get(4)).toBe("12");
    expect(codes.get(2)).toBe("13");
  });

  it("treats an account whose parent is missing as a root", () => {
    const codes = assignDisplayCodes([node(1, "11", 99)]);
    expect(codes.get(1)).toBe("1");
  });
});
