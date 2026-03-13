"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/Button";

const tips = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    title: "Chat naturally",
    description:
      "Just type what you're craving — \"I want spicy noodles\" or \"somewhere nice for a date night.\" The more you share, the better the picks.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    title: "Tap Quick Find",
    description:
      "Short on time? Hit the Quick Find button at the top for instant recommendations based on your budget and location.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Stay on budget",
    description:
      "Your budget slots keep spending in check. Every recommendation shows how it fits your budget for that time of day.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    title: "Roll the dice",
    description:
      "Feeling adventurous? Tap 🎲 for a wildcard pick outside your usual preferences. You might discover a new favourite.",
  },
];

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exiting, setExiting] = useState(false);

  const isReturning = searchParams.get("from") === "login";

  function handleStart() {
    setExiting(true);
    setTimeout(() => router.push("/chat"), 400);
  }

  return (
    <div
      className={`flex flex-col min-h-screen bg-gradient-to-b from-white via-gray-50/60 to-white transition-opacity duration-400 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black text-white mb-2">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">
            {isReturning ? "Welcome" : "You\u2019re all set"}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {isReturning
              ? "A quick guide on what Foodclaw can do."
              : "Here\u2019s how to get the most out of Foodclaw."}
          </p>
        </div>

        <div className="w-full space-y-4 mb-10">
          {tips.map((tip, i) => (
            <div
              key={i}
              className="flex gap-4 items-start rounded-xl bg-white border border-gray-100 shadow-sm p-4"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-lg bg-gray-50 text-gray-700">
                {tip.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">{tip.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                  {tip.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={handleStart} className="w-full text-base py-3">
          {isReturning ? "Let\u2019s go" : "Start exploring"}
        </Button>

        <p className="text-xs text-gray-400 mt-4 text-center">
          You can update your preferences anytime in Settings.
        </p>
      </div>
    </div>
  );
}

export default function OnboardingWelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeContent />
    </Suspense>
  );
}
