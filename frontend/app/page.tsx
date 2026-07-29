import Link from "next/link";
import { ArrowRight, Bell, Plane, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/images/fareping-hero.png')"
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,9,20,0.98)_0%,rgba(5,9,20,0.86)_38%,rgba(5,9,20,0.34)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(180deg,rgba(5,9,20,0)_0%,#050914_82%)]" />

        <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <Link className="flex items-center gap-3" href="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#2563eb]">
              <Plane size={22} aria-hidden="true" />
            </span>
            <span className="text-xl font-bold">FarePing</span>
          </Link>

          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-[#07111f] hover:bg-cyan-100"
            href="/search"
          >
            Open app
          </Link>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-6xl items-center px-6 pb-16">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              <Sparkles size={16} aria-hidden="true" />
              AI flight alerts
            </p>

            <h1 className="text-5xl font-bold leading-[1.05] tracking-normal sm:text-6xl">
              Tell FarePing where you want to go.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">
              It searches flexible routes, compares round trips with split one-way tickets,
              ranks the best options, and only sends texts after you turn alerts on.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#3b6df6] px-5 font-semibold text-white shadow-[0_18px_55px_rgba(37,99,235,0.32)] hover:bg-[#315de0]"
                href="/search"
              >
                Start a search
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/8 px-5 font-semibold text-white hover:bg-white/12"
                href="/alerts"
              >
                View alerts
              </Link>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-3 px-6 pb-10 sm:grid-cols-3">
          <div className="rounded-md border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
            <p className="text-sm font-semibold text-cyan-100">Natural setup</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Type the trip like you would say it to a person.
            </p>
          </div>
          <div className="rounded-md border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
            <p className="text-sm font-semibold text-cyan-100">Smarter ranking</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Price, duration, stops, and trip fit are scored together.
            </p>
          </div>
          <div className="rounded-md border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
              <Bell size={15} aria-hidden="true" />
              Text alerts
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Alerts stay off until you choose to track a trip.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
