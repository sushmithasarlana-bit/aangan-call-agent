import { initials } from "@/lib/dashboard";

/** Display picture, or initials on brick when no photo has been uploaded. */
export function Avatar({ name, photo, size = 36 }: { name: string; photo: string | null; size?: number }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="avatar" src={photo} alt={name} width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className="avatar avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-label={name} role="img">
      {initials(name)}
    </span>
  );
}
