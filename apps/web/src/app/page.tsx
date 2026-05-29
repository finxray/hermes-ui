import { AppShell } from "@/components/AppShell";
import { workspaceMock } from "@/data/mockWorkspace";

export default function Home() {
  return <AppShell workspace={workspaceMock} />;
}
