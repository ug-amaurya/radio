import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export function LoginButton() {
  const { login } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleClick = async () => {
    setIsRedirecting(true);
    try {
      await login();
    } catch {
      setIsRedirecting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isRedirecting}
      className="rounded-full bg-fuchsia-600 px-6 py-3 font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isRedirecting ? "Redirecting to Audius..." : "Log in with Audius"}
    </button>
  );
}
