import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../services/api.js";

export default function Computers() {
  const [computers, setComputers] = useState([]);
  const [computerId, setComputerId] = useState("PC-02");
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get("/computers");
      setComputers(response.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function register(event) {
    event.preventDefault();
    setError("");
    setGenerated(null);
    setCopied(false);
    setSaving(true);

    try {
      const response = await api.post("/computers", {
        computerId: computerId.trim().toUpperCase(),
      });

      setGenerated(response.data);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function copyToken() {
    if (!generated?.deviceToken) return;

    try {
      await navigator.clipboard.writeText(generated.deviceToken);
      setCopied(true);
    } catch {
      setError("Copy failed. Select the token and copy it manually.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Computers</h1>
        <p className="text-slate-400 mt-1">
          Register and monitor your PisoNet computers.
        </p>
      </div>

      <form onSubmit={register} className="panel space-y-4">
        <h2 className="font-semibold">Register Computer</h2>

        <div>
          <label
            htmlFor="computer-id"
            className="block text-sm text-slate-300 mb-2"
          >
            Computer ID
          </label>

          <input
            id="computer-id"
            value={computerId}
            onChange={(event) =>
              setComputerId(event.target.value.toUpperCase())
            }
            placeholder="PC-02"
            maxLength={32}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white"
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-sky-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          {saving ? "Registering..." : "Generate Device Token"}
        </button>

        {error && (
          <p role="alert" className="text-red-400 text-sm">
            {error}
          </p>
        )}
      </form>

      {generated && (
        <div className="panel space-y-3">
          <h2 className="font-semibold text-emerald-400">
            {generated.computerId} registered successfully
          </h2>

          <p className="text-sm text-amber-300">
            Save this token now. It will not be displayed again.
          </p>

          <textarea
            value={generated.deviceToken}
            readOnly
            rows={3}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-white"
            onFocus={(event) => event.target.select()}
          />

          <button
            type="button"
            onClick={copyToken}
            className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white"
          >
            {copied ? "Copied!" : "Copy Device Token"}
          </button>
        </div>
      )}

      <div className="panel space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Registered Computers</h2>

          <button type="button" onClick={load} className="text-sm text-sky-400">
            Refresh
          </button>
        </div>

        {loading && (
          <p className="text-sm text-slate-400">Loading computers...</p>
        )}

        {!loading && computers.length === 0 && (
          <p className="text-sm text-slate-400">No computer records yet.</p>
        )}

        <div className="space-y-3">
          {computers.map((computer) => {
            const active = Boolean(computer.session);
            const admin = Boolean(computer.adminMode);

            return (
              <div
                key={computer.computerId}
                className="rounded-lg border border-slate-700 p-4"
              >
                <div className="flex justify-between gap-3">
                  <h3 className="font-semibold">{computer.computerId}</h3>

                  <span
                    className={
                      active || admin
                        ? "text-sm text-emerald-400"
                        : "text-sm text-slate-400"
                    }
                  >
                    {admin
                      ? "Admin access"
                      : active
                        ? "Paid session"
                        : "No active session"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  Last seen:{" "}
                  {computer.lastSeenAt
                    ? new Date(computer.lastSeenAt).toLocaleString()
                    : "Never"}
                </p>

                {active && (
                  <p className="mt-1 text-xs text-sky-400">
                    Expires:{" "}
                    {new Date(computer.session.expiresAt).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
