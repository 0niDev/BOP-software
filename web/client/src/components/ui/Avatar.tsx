import { initials, tint } from "../../lib/format";

/**
 * Avatar / product thumbnail. The ERP stores no product photography, so the
 * tile is a deterministic gradient plus the initials of the party or item —
 * the same name always produces the same tile.
 */
export default function Avatar({
  name,
  size = 40,
  rounded = 12,
  title,
}: {
  name: string;
  size?: number;
  rounded?: number;
  title?: string;
}) {
  return (
    <span
      className="thumb"
      title={title ?? name}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        backgroundImage: tint(name),
        fontSize: Math.max(11, Math.round(size * 0.36)),
      }}
    >
      {initials(name)}
    </span>
  );
}
