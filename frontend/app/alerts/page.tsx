import Link from "next/link";
import { Bell, Plane, Search } from "lucide-react";
import { AuthPanel } from "../components/AuthPanel";
import { BackButton } from "../components/BackButton";
import { NightGlobeScene } from "../components/NightGlobeScene";
import { TrackedTripsPanel } from "../components/TrackedTripsPanel";

export default function AlertsPage() {
  return (
    <main className="fareping-cinematic min-h-screen bg-[#050a0d] text-white">
      <NightGlobeScene />
      <div className="fareping-space-shade fixed inset-0" />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[#050a0d]/45" />

      <div className="fareping-results-content relative z-10 mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton fallbackHref="/" />
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
          </div>

          <div className="flex h-10 items-center rounded-md border border-white/10 bg-black/25 p-1 text-sm font-semibold backdrop-blur-xl">
            <Link className="inline-flex h-8 items-center px-3 text-white/55 hover:text-white" href="/">
              Home
            </Link>
            <Link className="inline-flex h-8 items-center px-3 text-white/55 hover:text-white" href="/search">
              Search
            </Link>
            <Link className="inline-flex h-8 items-center rounded bg-[#9ff3d0] px-3 text-[#07110f]" href="/alerts">
              Alerts
            </Link>
          </div>
        </nav>

        <header className="grid gap-5 border-b border-white/12 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)] lg:items-end">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#9ff3d0]">
              <Bell size={15} aria-hidden="true" />
              Tracked trips
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
              Your flight watchlist
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
              Review the latest prices, adjust a search, or pause monitoring without losing its history.
            </p>
          </div>

          <AuthPanel compact compactHint="Manage alerts" compactLabel="Sign in" />
        </header>

        <TrackedTripsPanel />

        <Link
          className="mb-10 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/14 bg-black/20 px-4 text-sm font-semibold text-white/70 transition hover:border-[#9ff3d0]/40 hover:text-[#9ff3d0] sm:w-auto sm:self-start"
          href="/search"
        >
          <Search size={16} aria-hidden="true" />
          Start a new search
        </Link>
      </div>
    </main>
  );
}
