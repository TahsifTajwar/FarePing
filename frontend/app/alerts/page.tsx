import Link from "next/link";
import { Plane, Search } from "lucide-react";
import { AuthPanel } from "../components/AuthPanel";
import { BackButton } from "../components/BackButton";
import { TrackedTripsPanel } from "../components/TrackedTripsPanel";

export default function AlertsPage() {
  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45"
          style={{
            backgroundImage: "url('/images/fareping-hero.png')"
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#050914_0%,rgba(5,9,20,0.96)_52%,rgba(5,9,20,0.74)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-52 bg-[linear-gradient(180deg,rgba(5,9,20,0)_0%,#050914_86%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-3">
            <BackButton fallbackHref="/" />
            <Link className="flex items-center gap-3" href="/">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#2563eb]">
                <Plane size={22} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Flight deal watcher
                </p>
                <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">FarePing</h1>
              </div>
            </Link>
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-slate-200 hover:bg-white/10" href="/">
              Home
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-slate-200 hover:bg-white/10"
              href="/search"
            >
              <Search size={15} aria-hidden="true" />
              New search
            </Link>
            <Link className="rounded-full bg-white px-4 py-2 text-[#07111f]" href="/alerts">
              Alerts
            </Link>
          </nav>
        </div>

        <section className="grid max-w-3xl gap-3">
          <p className="text-sm font-semibold text-cyan-100">Tracked trips</p>
          <h2 className="text-4xl font-bold tracking-normal sm:text-5xl">
            Trips FarePing is watching.
          </h2>
          <p className="max-w-2xl text-base leading-7 text-slate-300">
            Pause, delete, check now, or open a trip to see the latest ranked options.
          </p>
        </section>

        <AuthPanel />

        <TrackedTripsPanel />
      </div>
      </section>
    </main>
  );
}
