import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  wide?: boolean;
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="13,2 22,7 22,19 13,24 4,19 4,7" stroke="#3B82F6" strokeWidth="2" />
        <path d="M9 13H17M14 10L17 13L14 16" stroke="#3B82F6" strokeWidth="2" />
      </svg>
      <span className="font-heading text-xl font-semibold">ENSPay</span>
    </div>
  );
}

export default function Layout({ title, children, wide }: Props) {
  return (
    <main className="min-h-screen bg-[#0F0F0F] px-4 pt-20 text-white">
      <header className="fixed left-4 right-4 top-4 z-[100] mx-auto flex max-w-5xl items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-xl">
        <Logo />
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/" className="text-[#71717A] transition-all duration-200 hover:text-white">
              Pay/Swap
            </Link>
            <Link href="/setup" className="text-[#71717A] transition-all duration-200 hover:text-white">
              Setup
            </Link>
            <Link href="/dashboard" className="text-[#71717A] transition-all duration-200 hover:text-white">
              Dashboard
            </Link>
          </nav>
          <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
            <ConnectButton />
          </div>
        </div>
      </header>

      <section className={`page-enter mx-auto w-full ${wide ? "max-w-[960px]" : "max-w-[640px]"} pb-10`}>
        <h1 className="page-title mb-6">{title}</h1>
        {children}
      </section>
    </main>
  );
}
