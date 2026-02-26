const API_BASE = process.env.NEXT_PUBLIC_ORACLE_API || "http://localhost:3001";

export async function startVerification(stacksAddress: string, providerIds: string[]) {
  const res = await fetch(`${API_BASE}/api/start-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stacksAddress, providerIds }),
  });
  return res.json();
}

export async function submitProof(stacksAddress: string, proofs: any[]) {
  const res = await fetch(`${API_BASE}/api/submit-proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stacksAddress, proofs }),
  });
  return res.json();
}

export async function checkScore(address: string) {
  const res = await fetch(`${API_BASE}/api/check-score/${address}`);
  return res.json();
}

export async function demoSubmitScore(stacksAddress: string, signals: Record<string, any>) {
  const res = await fetch(`${API_BASE}/api/demo/submit-score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stacksAddress, signals }),
  });
  return res.json();
}
