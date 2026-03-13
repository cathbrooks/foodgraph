import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Foodclaw</h1>
        <p className="text-lg text-gray-600">
          AI-powered restaurant recommendations based on your budget, time, and
          preferences.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-black px-6 py-3 text-white font-medium hover:bg-gray-800 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50 transition-colors"
          >
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
