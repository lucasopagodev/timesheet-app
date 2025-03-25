import { TimesheetGenerator } from "@/components/timesheet-generator"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Gerador de Folha de Ponto</h1>
      <TimesheetGenerator />
    </main>
  )
}

