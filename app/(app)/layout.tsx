import { Header } from "@/components/layout";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
