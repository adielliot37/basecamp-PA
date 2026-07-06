import { TopBar } from "@/components/TopBar";
import { HeroReplyPanel } from "@/components/HeroReplyPanel";
import { TasksPanel } from "@/components/TasksPanel";
import { ReportsPanel } from "@/components/ReportsPanel";
import { OtherPanel } from "@/components/OtherPanel";
import { BoardPanel } from "@/components/BoardPanel";

export default function Home() {
  return (
    <main className="cockpit">
      <TopBar />
      <div className="columns">
        <HeroReplyPanel />
        <TasksPanel />
        <div className="rightcol">
          <ReportsPanel />
          <OtherPanel />
        </div>
      </div>
      <BoardPanel />
    </main>
  );
}
