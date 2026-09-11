import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarRange,
  Gauge,
  MessageCircle,
  Plane,
  Route,
  Search,
  Tickets
} from "lucide-react";
import { NightGlobeScene } from "./components/NightGlobeScene";

const workflow = [
  {
    icon: MessageCircle,
    step: "01",
    title: "Describe the trip",
    copy: "Give Luna a route, flexible date window, stay length, budget, or any detail you already know."
  },
  {
    icon: Search,
    step: "02",
    title: "Compare real options",
    copy: "FarePing searches valid date combinations and ranks price, duration, stops, and layover quality together."
  },
  {
    icon: BellRing,
    step: "03",
    title: "Watch the strongest",
    copy: "Save a promising trip and receive an alert when a meaningfully better option appears."
  }
];

const capabilities = [
  {
    icon: CalendarRange,
    title: "Flexible travel windows",
    copy: "Search earliest and latest departure boundaries, return deadlines, and optional stay constraints."
  },
  {
    icon: Tickets,
    title: "Split-ticket comparison",
    copy: "Compare ordinary round trips with separately booked outbound and return flights."
  },
  {
    icon: Gauge,
    title: "Quality-aware ranking",
    copy: "Cheap fares do not win automatically when the itinerary carries punishing layovers or poor timing."
  }
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
            <span className="block text-lg font-semibold">FarePing</span>
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

      <section className="relative z-[2] mx-auto flex min-h-[66svh] w-full max-w-[1280px] items-center px-4 pb-14 pt-8 sm:px-6 sm:pb-16">
        <div className="fareping-results-content max-w-[680px]">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#9ff3d0]">
            <Route size={16} aria-hidden="true" />
            Search wide. Choose well.
          </p>

          <h1 className="mt-4 text-5xl font-semibold leading-none sm:text-6xl">FarePing</h1>
          <p className="mt-5 max-w-xl text-2xl font-semibold leading-tight text-white/92 sm:text-3xl">
            Flexible flight search that understands the whole trip.
          </p>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/58 sm:text-lg">
            Explore date windows, compare round trips with split tickets, avoid exhausting layovers,
            and watch the options worth waiting for.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#9ff3d0] px-5 font-semibold text-[#07110f] shadow-[0_18px_55px_rgba(80,215,169,0.16)] transition hover:bg-white"
              href="/search"
            >
              Search flights
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/16 bg-black/20 px-5 font-semibold text-white/72 backdrop-blur-xl transition hover:border-[#9ff3d0]/40 hover:text-[#9ff3d0]"
              href="/alerts"
            >
              <BellRing size={17} aria-hidden="true" />
              View alerts
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-white/40">
            <span>Natural-language setup</span>
            <span>Transparent flight details</span>
            <span>Alerts stay off until you choose</span>
          </div>
        </div>
      </section>

      <section className="relative z-[2] border-y border-white/10 bg-[#07100f]/88 backdrop-blur-xl" aria-labelledby="workflow-title">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
          <div className="fareping-results-content flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[#9ff3d0]">From idea to alert</p>
              <h2 className="mt-2 text-2xl font-semibold" id="workflow-title">How FarePing works</h2>
            </div>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#9ff3d0] hover:text-white" href="/search">
              Start with Luna
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-7 grid border-t border-white/10 md:grid-cols-3">
            {workflow.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  className="fareping-results-content grid min-w-0 grid-cols-[auto_1fr] gap-4 border-b border-white/10 py-6 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
                  key={item.step}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[#9ff3d0]/20 bg-[#9ff3d0]/[0.07] text-[#9ff3d0]">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold text-white/30">{item.step}</p>
                    <h3 className="mt-1 text-base font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/48">{item.copy}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-[2] bg-[#050a0d]" aria-labelledby="difference-title">
        <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)] lg:py-20">
          <div>
            <p className="text-xs font-bold uppercase text-[#efc77e]">Built for flexible travel</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight" id="difference-title">
              A better fare is more than a lower number.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-white/48">
              FarePing treats your dates, trip length, airport choices, stops, and layover quality as
              parts of the same decision.
            </p>
          </div>

          <div className="grid border-t border-white/10">
            {capabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <div className="grid gap-3 border-b border-white/10 py-6 sm:grid-cols-[2.5rem_minmax(12rem,0.7fr)_minmax(0,1fr)] sm:items-start" key={capability.title}>
                  <Icon className="text-[#9ff3d0]" size={19} aria-hidden="true" />
                  <h3 className="font-semibold">{capability.title}</h3>
                  <p className="text-sm leading-6 text-white/48">{capability.copy}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="relative z-[2] border-t border-white/10 bg-[#050a0d]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-7 text-xs text-white/38 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>FarePing</span>
          <div className="flex gap-5">
            <Link className="hover:text-white" href="/search">Search</Link>
            <Link className="hover:text-white" href="/alerts">Alerts</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
