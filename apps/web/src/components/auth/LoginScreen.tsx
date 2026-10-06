import { GuestButton } from "./GuestButton";
import { ThemePicker } from "../layout/ThemePicker";
import { LoginButton } from "./LoginButton";

export function LoginScreen() {
  return (
    <div className="relative grid min-h-screen place-items-center bg-ink-900 px-4">
      <div className="absolute right-4 top-4">
        <ThemePicker />
      </div>
      <div className="w-full max-w-sm rounded-3xl bg-ink-700 p-8 text-center shadow-card">
        <p className="text-sm font-bold uppercase tracking-widest text-lilac">Audius Radio</p>
        <h1 className="mt-3 text-4xl font-black leading-tight">Hi there,<br />welcome back</h1>
        <p className="mt-3 text-white/70">Endless stations, DJ crossfades, and fresh independent music.</p>
        <div className="mt-8 flex flex-col items-center gap-5">
          <LoginButton />
          <GuestButton />
        </div>
      </div>
    </div>
  );
}
