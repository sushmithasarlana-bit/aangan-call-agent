"use client";

import { useRef, useState } from "react";

/**
 * Picks a photo, crops it to a centred square and shrinks it to 256 px in the browser,
 * so only a small JPEG (tens of KB) is saved with the profile.
 */
export function AvatarPicker({ name, current }: { name: string; current: string | null }) {
  const [preview, setPreview] = useState<string | null>(current);
  const [data, setData] = useState("");
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError("");
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const side = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
      const url = canvas.toDataURL("image/jpeg", 0.86);
      setPreview(url);
      setData(url);
      setRemoved(false);
    } catch {
      setError("That image couldn't be read. Try a JPEG or PNG.");
    }
  }

  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "N";

  return (
    <div className="picker">
      {preview && !removed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar" src={preview} alt="Display picture preview" width={96} height={96} style={{ width: 96, height: 96 }} />
      ) : (
        <span className="avatar avatar-initials" style={{ width: 96, height: 96, fontSize: 34 }}>{initials}</span>
      )}
      <div className="picker-actions">
        <input ref={input} id="photo-file" type="file" accept="image/*" onChange={onPick} hidden />
        <button type="button" className="btn" onClick={() => input.current?.click()}>
          {preview && !removed ? "Change photo" : "Upload photo"}
        </button>
        {preview && !removed ? (
          <button type="button" className="btn ghost" onClick={() => { setRemoved(true); setData(""); }}>Remove</button>
        ) : null}
        <p className="hint">Square crop, saved at 256 px. JPEG, PNG or WebP.</p>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
      <input type="hidden" name="photo" value={data} />
      <input type="hidden" name="remove_photo" value={removed ? "1" : ""} />
    </div>
  );
}
