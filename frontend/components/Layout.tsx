import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="13,2 22,7 22,19 13,24 4,19 4,7" stroke="#3B82F6" strokeWidth="2" />
        <path d="M9 13H17M14 10L17 13L14 16" stroke="#3B82F6" strokeWidth="2" />
      </svg>
      <span className="text-xl font-semibold">ENSPay</span>
    </div>
  );
}

export default function Layout({ title, children }: Props) {
  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between p-6">
        <Logo />
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/">Pay/Swap</Link>
            <Link href="/setup">Setup</Link>
            <Link href="/dashboard">Dashboard</Link>
          </nav>
          <ConnectButton />
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-6 pb-10">
        <h1 className="mb-5 text-3xl font-semibold">{title}</h1>
        {children}
      </section>
    </main>
  );
}
