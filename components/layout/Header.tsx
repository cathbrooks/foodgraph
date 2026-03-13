import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

export function Header() {
  return (
    <header className="border-b border-gray-200 px-6 py-4">
      <nav className="flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/chat" className="text-lg font-bold">
          Foodclaw
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/chat"
            className="text-sm font-medium text-gray-700 hover:text-black transition-colors"
          >
            Find Food
          </Link>
          <Link
            href="/settings/budget-slots"
            className="text-sm font-medium text-gray-700 hover:text-black transition-colors"
          >
            Profile
          </Link>
          <SignOutButton />
        </div>
      </nav>
    </header>
  );
}
