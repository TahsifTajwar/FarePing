import { Bell, Plane, Search } from "lucide-react";

const setupSteps = [
  "Backend health endpoint",
  "Flight search form",
  "Saved searches",
  "Scheduled price checks",
  "SMS alerts"
];

export default function Home() {
  return (
    <main className="min-h-screen bg-runway text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-5 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-fare text-white">
            <Plane size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">
              Flight deal watcher
            </p>
            <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">FarePing</h1>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Search size={20} aria-hidden="true" />
              <h2 className="text-xl font-semibold">First search setup</h2>
            </div>

            <form className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                From
                <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="JFK" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                To
                <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="LAX" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Depart after
                <input className="rounded-md border border-slate-300 px-3 py-2" type="date" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Return before
                <input className="rounded-md border border-slate-300 px-3 py-2" type="date" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Max price
                <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="$250" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Phone for alerts
                <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="+15551234567" />
              </label>
              <button
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-fare px-4 font-semibold text-white sm:col-span-2"
                type="button"
              >
                <Bell size={18} aria-hidden="true" />
                Save search
              </button>
            </form>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Build path</h2>
            <ol className="grid gap-3">
              {setupSteps.map((step, index) => (
                <li className="flex items-center gap-3" key={step}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>
    </main>
  );
}
