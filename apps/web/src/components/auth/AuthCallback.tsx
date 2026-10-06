import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export function AuthCallback() {
  const { completeLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    completeLogin()
      .then(() => navigate("/", { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Login failed.");
      });
  }, [completeLogin, navigate]);

  if (error) {
    return (
      <div role="alert" className="p-8 text-center text-red-400">
        {error}
      </div>
    );
  }

  return <div className="p-8 text-center text-gray-300">Finishing login...</div>;
}
