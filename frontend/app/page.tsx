import Link from "next/link";
import { ArrowRight, BellRing, CalendarRange, Gauge, Plane, Tickets } from "lucide-react";
import { NightGlobeScene } from "./components/NightGlobeScene";

const signals = [
  { icon: CalendarRange, label: "Flexible windows", detail: "Search around your dates" },
  { icon: Gauge, label: "Whole-trip ranking", detail: "Price, time, stops, and layovers" },
  { icon: Tickets, label: "More ways to fly", detail: "Round trips and split tickets" }
];

export default function LandingPage() {
  return (
    <main className="fareping-cinematic min-h-screen overflow-x-hidden bg-[#050a0d] text-white">
      <NightGlobeScene />
      <div className="fareping-space-shade fixed inset-0" />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[#050a0d]/20" />

      <nav className="fareping-results-content relative z-10 mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <Link className="flex items-center gap-2.5" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#9ff3d0]/30 bg-[#9ff3d0]/10 text-[#9ff3d0]">
            <Plane size={21} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[10px] font-bold uppercase text-[#9ff3d0]">
              Flexible flight search
            </span>
            <span className="block text-lg font-semibold">Chord</span>
          </span>
        </Link>

        <div className="flex h-10 items-center rounded-md border border-white/10 bg-black/25 p-1 text-sm font-semibold backdrop-blur-xl">
          <Link className="inline-flex h-8 items-center rounded bg-[#9ff3d0] px-3 text-[#07110f]" href="/">
            Home
          </Link>
          <Link className="inline-flex h-8 items-center px-3 text-white/55 transition hover:text-white" href="/search">
            Search
          </Link>
          <Link className="inline-flex h-8 items-center px-3 text-white/55 transition hover:text-white" href="/alerts">
            Alerts
          </Link>
        </div>
      </nav>

      <section className="relative z-[2] mx-auto flex min-h-[72svh] w-full max-w-[1280px] items-center px-4 pb-16 pt-8 sm:px-6 sm:pb-20">
        <div className="fareping-results-content max-w-[620px]">
          <p className="text-xs font-bold uppercase text-[#9ff3d0]">Meet Luna</p>
          <h1 className="mt-4 text-6xl font-semibold leading-none sm:text-7xl">Chord</h1>
          <p className="mt-6 max-w-xl text-3xl font-semibold leading-tight text-white/94 sm:text-4xl">
            Find the trip, not just the fare.
          </p>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/55 sm:text-lg">
            Flexible dates, smarter comparisons, and alerts that wait for something worthwhile.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#9ff3d0] px-6 font-semibold text-[#07110f] shadow-[0_18px_55px_rgba(80,215,169,0.16)] transition hover:bg-white"
              href="/search"
            >
              Plan a trip
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 px-4 font-semibold text-white/60 transition hover:text-[#9ff3d0]"
              href="/alerts"
            >
              <BellRing size={17} aria-hidden="true" />
              Saved alerts
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-[2] border-y border-white/10 bg-[#07100f]/88 backdrop-blur-xl" aria-label="Search highlights">
        <div className="mx-auto grid w-full max-w-[1280px] px-4 sm:grid-cols-3 sm:px-6">
          {signals.map((signal) => {
            const Icon = signal.icon;
            return (
              <div
                className="fareping-results-content grid grid-cols-[2.5rem_1fr] items-center gap-3 border-b border-white/10 py-5 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"
                key={signal.label}
              >
                <Icon className="text-[#9ff3d0]" size={19} aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold">{signal.label}</h2>
                  <p className="mt-0.5 text-xs text-white/42">{signal.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="relative z-[2] bg-[#050a0d]">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-7 text-xs text-white/35 sm:px-6">
          <span>Chord</span>
          <span>Search wide. Choose well.</span>
        </div>
      </footer>
    </main>
  );
}
