import { NeedsReplyPanel } from "@/components/NeedsReplyPanel";
import { TasksPanel } from "@/components/TasksPanel";
import { OtherPanel } from "@/components/OtherPanel";
import { StatusStrip } from "@/components/StatusStrip";
import { StatusBar } from "@/components/StatusBar";

export default function Home() {
  return (
    <main className="flex-1 w-full max-w-[1080px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <header className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cockpit</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Your Basecamp radar
          </p>
        </div>
        <StatusBar />
      </header>

      <StatusStrip />

      <div className="flex flex-col gap-8">
        <NeedsReplyPanel />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-7">
            <TasksPanel />
          </div>
          <div className="lg:col-span-5 lg:border-l lg:border-[var(--color-border)] lg:pl-10">
            <OtherPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
