import { MARKER_BG, initials, markerFor } from "@/lib/color";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  /** The person's ID; decides the colour. */
  id: string;
  name: string;
  size?: AvatarSize;
  /**
   * Set when the name is already written next to the avatar. The avatar is
   * then hidden from screen readers so the name is not read twice.
   */
  decorative?: boolean;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[0.625rem]",
  md: "h-8 w-8 text-xs",
  lg: "h-16 w-16 text-xl",
};

/**
 * A person as their initials on their own marker colour (REQ-33.4). The name
 * is never lost: it is either beside the avatar or the avatar's accessible name.
 */
export function Avatar({ id, name, size = "md", decorative = false }: AvatarProps) {
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      title={decorative ? undefined : name}
      data-marker={markerFor(id)}
      className={
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white " +
        `${SIZE_CLASSES[size]} ${MARKER_BG[markerFor(id)]}`
      }
    >
      {initials(name)}
    </span>
  );
}
