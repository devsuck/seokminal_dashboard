"use client";
// 클라우드 배포 대비 단일 유저 로그인. lib/api.ts의 401 리다이렉트가 여기로 보냄.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, ApiError } from "@/lib/api";
import { ApButton } from "@/components/ui/ApPrimitives";

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
    <div className="rail-ap min-h-screen bg-ap-bg-page flex items-center justify-center p-5">
      <form onSubmit={submit} className="bg-ap-surface border border-ap-line rounded-ap-lg shadow-ap-sm p-6 w-full max-w-xs flex flex-col gap-4">
        <h1 className="text-ap-title tracking-wider text-ap-ink-1 uppercase">SEOKMINAL 로그인</h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="bg-ap-bg-page border border-ap-line rounded-ap-md px-3 py-2 text-ap-title text-ap-ink-1 outline-none focus:border-ap-brand"
        />
        {err && <p className="text-ap-label text-ap-down">{err}</p>}
        <ApButton type="submit" variant="primary" size="md" loading={loading} disabled={!password}>
          로그인
        </ApButton>
      </form>
    </div>
  );
}
