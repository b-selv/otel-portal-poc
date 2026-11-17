"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession, signInWithRedirect, signOut, getCurrentUser } from "aws-amplify/auth";

type ApiItem = {
  apiId: string;
  name: string;
  basePath: string;
  backendUrl: string;
  method: string;
  status: "DRAFT" | "PUBLISHED";
  createdAt: string;
};

export default function HomePage() {
  const [user, setUser] = useState<string | null>(null);
  const [items, setItems] = useState<ApiItem[]>([]);
  const [form, setForm] = useState({ name: "", description: "", basePath: "/orders", backendUrl: "https://httpbin.org/anything", method: "GET" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function token() {
    const session = await fetchAuthSession();
    const value = session.tokens?.accessToken?.toString();
    if (!value) throw new Error("No access token. Sign in again.");
    return value;
  }

  async function refresh() {
    const accessToken = await token();
    const response = await fetch("/api/apis", { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load APIs");
    setItems(body.items);
  }

  useEffect(() => {
    getCurrentUser()
      .then(async (current) => {
        setUser(current.username);
        try { await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not load APIs"); }
      })
      .catch(() => setUser(null));
  }, []);

  async function createApi(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/apis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(form)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Create failed");
      setMessage(`Created draft ${body.item.apiId}`);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Create failed"); }
    finally { setBusy(false); }
  }

  async function publish(apiId: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const accessToken = await token();
      const response = await fetch(`/api/apis/${apiId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Publish failed");
      setMessage(`Published ${apiId}`);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Publish failed"); }
    finally { setBusy(false); }
  }

  async function logout() {
    await signOut({ global: false });
    setUser(null); setItems([]);
  }

  return (
    <main>
      <h1>API Developer Portal</h1>
      <p className="subtle">OpenTelemetry POC · create and publish API configuration</p>
      <section className="panel">
        {user ? (
          <div className="row">
            <span>Signed in as <strong>{user}</strong></span>
            <button className="secondary" onClick={logout}>Sign out</button>
          </div>
        ) : (
          <>
            <p>Sign in with your Cognito Hosted UI to create and publish APIs.</p>
            <button onClick={() => signInWithRedirect()}>Sign in with SSO</button>
          </>
        )}
      </section>

      {user && <>
        <section className="panel">
          <h2>Create API draft</h2>
          <form onSubmit={createApi}>
            <label>API name<input required minLength={3} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <label>Base path<input required value={form.basePath} onChange={e => setForm({ ...form, basePath: e.target.value })} /></label>
            <label>Backend URL<input required type="url" value={form.backendUrl} onChange={e => setForm({ ...form, backendUrl: e.target.value })} /></label>
            <label>Method<select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => <option key={m}>{m}</option>)}
            </select></label>
            <button disabled={busy} type="submit">Create draft</button>
          </form>
        </section>

        <section className="panel">
          <h2>API configurations</h2>
          {items.length === 0 ? <p className="subtle">No APIs yet.</p> : (
            <table><thead><tr><th>Name</th><th>Base path</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{items.map(item => <tr key={item.apiId}>
                <td>{item.name}</td><td>{item.basePath}</td><td>{item.status}</td>
                <td>{item.status === "DRAFT" ? <button disabled={busy} onClick={() => publish(item.apiId)}>Publish</button> : "—"}</td>
              </tr>)}</tbody>
            </table>
          )}
        </section>
      </>}
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
