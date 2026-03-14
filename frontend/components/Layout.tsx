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
      <span className="font-heading text-xl font-semibold text-[#F0EBE1]">ENSPay</span>
    </div>
  );
}

export default function Layout({ title, children, wide }: Props) {
  return (
    <main className="min-h-screen bg-[#1C1A17] px-4 pt-24 text-[#F0EBE1]">
      <header className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-center border-b border-[#2E2B27] bg-[#1C1A17] px-6 py-4">
        <div className="flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-4">
            <Link href="/" className="label-text !text-[#7A7570] transition-all duration-200 hover:!text-[#F0EBE1]">
              Pay/Swap
            </Link>
            <Link href="/setup" className="label-text !text-[#7A7570] transition-all duration-200 hover:!text-[#F0EBE1]">
              Setup
            </Link>
            <Link href="/dashboard" className="label-text !text-[#7A7570] transition-all duration-200 hover:!text-[#F0EBE1]">
              Dashboard
            </Link>
          </nav>
          <div className="rounded-md border border-[#2E2B27] bg-transparent px-2 py-1">
            <ConnectButton />
          </div>
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
