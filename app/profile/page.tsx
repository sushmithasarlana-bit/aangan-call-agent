import Link from "next/link";
import { loadProfile, pickDays } from "@/lib/dashboard";
import { saveProfile } from "../actions";
import { AvatarPicker } from "../components/avatar-picker";
import { Shell } from "../components/shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile · Aangan call agent" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ days?: string; error?: string; saved?: string }> }) {
  const sp = await searchParams;
  const days = pickDays(sp.days);
  const profile = await loadProfile();

  return (
    <Shell active="profile" profile={profile} days={days}>
      <section className="hello">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Your profile</h1>
          <p className="lede">Shown in the sidebar, the top bar and on the meeting summary.</p>
        </div>
        <div className="hello-actions"><Link className="btn" href={`/?days=${days}`}>Back to dashboard</Link></div>
      </section>

      {sp.error ? <p className="flash bad" role="alert">{sp.error}</p> : null}
      {sp.saved ? <p className="flash good" role="status">Profile saved.</p> : null}

      <form action={saveProfile} className="card profile-form">
        <div className="f-photo">
          <span className="f-label">Display picture</span>
          <AvatarPicker name={profile.name} current={profile.photo} />
        </div>
        <label>Full name<input id="p-name" name="name" required maxLength={80} defaultValue={profile.name} autoComplete="name" /></label>
        <label>Role<input id="p-role" name="role" maxLength={80} defaultValue={profile.role} placeholder="Founder" autoComplete="organization-title" /></label>
        <label>Email <small>(optional)</small><input id="p-email" name="email" type="email" maxLength={120} defaultValue={profile.email ?? ""} autoComplete="email" /></label>
        <div className="form-actions"><button type="submit" className="btn primary">Save profile</button></div>
      </form>
    </Shell>
  );
}
