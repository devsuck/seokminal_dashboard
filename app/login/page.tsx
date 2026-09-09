"use client";
// 클라우드 배포 대비 단일 유저 로그인. lib/api.ts의 401 리다이렉트가 여기로 보냄.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await login(password);
      router.replace("/");
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 401 ? "비밀번호가 틀렸습니다" : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-5">
      <form onSubmit={submit} className="c-panel border border-border rounded-lg p-6 w-full max-w-xs flex flex-col gap-4">
        <h1 className="text-[13px] tracking-wider text-text-1 uppercase">SEOKMINAL 로그인</h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="bg-bg border border-border rounded px-3 py-2 text-[13px] text-text-1 outline-none focus:border-accent"
        />
        {err && <p className="text-[12px] text-neg">{err}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="bg-accent text-black rounded px-3 py-2 text-[13px] font-medium disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
