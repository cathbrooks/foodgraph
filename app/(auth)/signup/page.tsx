"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    // #region agent log
    console.log('[DEBUG-0dbf01] signUp result:', JSON.stringify({hasSession:!!data?.session,hasUser:!!data?.user,userId:data?.user?.id,emailConfirmedAt:data?.user?.email_confirmed_at,errorMsg:error?.message??null}));
    fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0dbf01'},body:JSON.stringify({sessionId:'0dbf01',location:'signup/page.tsx:signUp',message:'signUp result',data:{hasSession:!!data?.session,hasUser:!!data?.user,userId:data?.user?.id,emailConfirmedAt:data?.user?.email_confirmed_at,errorMsg:error?.message??null},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError("Check your email for a confirmation link, then sign in.");
      setLoading(false);
      return;
    }

    router.push("/onboarding/preferences");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-gray-500">
            Get personalized restaurant recommendations
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            id="confirm-password"
            label="Confirm password"
            type="password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creating account\u2026" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-black hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
