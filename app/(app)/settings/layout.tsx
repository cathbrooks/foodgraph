"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Preferences", href: "/settings/preferences" },
  { label: "Budget Slots", href: "/settings/budget-slots" },
] as const;

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-lg px-6 py-10 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <nav className="flex border-b border-gray-200" role="tablist">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
                active
                  ? "border-b-2 border-black text-black"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
