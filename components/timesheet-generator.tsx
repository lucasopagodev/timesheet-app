"use client"

import { useState } from "react"
import { format, getDaysInMonth, isWeekend, isSameDay, addMonths, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, Printer, CalendarDays, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type WorkSchedule = {
  id: string
  name: string
  morningEntry: { hour: number; minute: number }
  morningExit: { hour: number; minute: number }
  afternoonEntry: { hour: number; minute: number }
  afternoonExit: { hour: number; minute: number }
}

const WORK_SCHEDULES: WorkSchedule[] = [
  {
    id: "extended-afternoon",
    name: "Tarde Estendida (10h - 12h, 13h - 19h)",
    morningEntry: { hour: 10, minute: 0 },
    morningExit: { hour: 12, minute: 0 },
    afternoonEntry: { hour: 13, minute: 0 },
    afternoonExit: { hour: 19, minute: 0 },
  },
  {
    id: "standard",
    name: "Padrão (8h - 12h, 13h - 17h)",
    morningEntry: { hour: 8, minute: 0 },
    morningExit: { hour: 12, minute: 0 },
    afternoonEntry: { hour: 13, minute: 0 },
    afternoonExit: { hour: 17, minute: 0 },
  },
  {
    id: "early",
    name: "Antecipado (7h - 11h, 12h - 16h)",
    morningEntry: { hour: 7, minute: 0 },
    morningExit: { hour: 11, minute: 0 },
    afternoonEntry: { hour: 12, minute: 0 },
    afternoonExit: { hour: 16, minute: 0 },
  },
  {
    id: "late",
    name: "Tardio (9h - 13h, 14h - 18h)",
    morningEntry: { hour: 9, minute: 0 },
    morningExit: { hour: 13, minute: 0 },
    afternoonEntry: { hour: 14, minute: 0 },
    afternoonExit: { hour: 18, minute: 0 },
  },
  {
    id: "late-afternoon",
    name: "Tardio (9:30h - 13h, 14h - 18:30h)",
    morningEntry: { hour: 9, minute: 30 },
    morningExit: { hour: 13, minute: 0 },
    afternoonEntry: { hour: 14, minute: 0 },
    afternoonExit: { hour: 18, minute: 30 },
  },
];

type TimesheetEntry = {
  date: Date
  dayOfWeek: string
  isWeekend: boolean
  isHoliday: boolean
  morningEntry: string
  morningExit: string
  afternoonEntry: string
  afternoonExit: string
  totalHours: string
}

export function TimesheetGenerator() {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date())
  const [selectedSchedule, setSelectedSchedule] = useState<string>("extended-afternoon")
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([])
  const [holidays, setHolidays] = useState<Date[]>([])
  const [holidayDate, setHolidayDate] = useState<Date | undefined>(undefined)
  const [holidayPopoverOpen, setHolidayPopoverOpen] = useState(false)

  // Get current date in Brasília timezone
  const getBrasiliaDate = (date?: Date) => {
    // Create a date object with the current UTC time or use provided date
    const now = date ? new Date(date) : new Date()

    // Adjust for Brasília timezone (UTC-3)
    const brasiliaOffset = -3 * 60 // -3 hours in minutes
    const localOffset = now.getTimezoneOffset() // Local timezone offset in minutes

    // Calculate the total offset in milliseconds
    const offsetMs = (localOffset + brasiliaOffset) * 60 * 1000

    // Apply the offset to get Brasília time
    return new Date(now.getTime() + offsetMs)
  }

  // Helper function to format time as HH:MM
  const formatTime = (date: Date): string => {
    return format(date, "HH:mm")
  }

  // Helper function to get a random number between min and max (inclusive)
  const getRandomBetween = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  // Generate random work schedule based on selected schedule with natural variations
  const generateRandomWorkSchedule = (baseSchedule: WorkSchedule) => {
    // Create date objects for each time
    const morningEntry = getBrasiliaDate()
    const morningExit = getBrasiliaDate()
    const afternoonEntry = getBrasiliaDate()
    const afternoonExit = getBrasiliaDate()

    // Morning entry: Random between base time and base time + 17 minutes
    // (with higher probability of being within tolerance)
    const entryDelayMinutes =
      Math.random() < 0.7
        ? getRandomBetween(0, 10) // 70% chance of being within tolerance
        : getRandomBetween(11, 17) // 30% chance of being late

    morningEntry.setHours(baseSchedule.morningEntry.hour, baseSchedule.morningEntry.minute + entryDelayMinutes, 0, 0)

    // Morning exit: Random between 5 minutes before and 15 minutes after base time
    morningExit.setHours(
      baseSchedule.morningExit.hour,
      baseSchedule.morningExit.minute + getRandomBetween(-5, 15),
      0,
      0,
    )

    // Ensure morning exit is after morning entry and at least 1.5 hours of work
    const minMorningExitTime = new Date(morningEntry)
    minMorningExitTime.setHours(minMorningExitTime.getHours() + 1, minMorningExitTime.getMinutes() + 30)

    if (morningExit < minMorningExitTime) {
      morningExit.setTime(minMorningExitTime.getTime())
    }

    // Afternoon entry: Approximately 1 hour after morning exit (lunch break)
    // Random between 50-70 minutes after morning exit
    const lunchBreakMinutes = getRandomBetween(50, 70)
    afternoonEntry.setTime(morningExit.getTime() + lunchBreakMinutes * 60 * 1000)

    // Afternoon exit: Calculate to ensure approximately 8 hours total work
    // First calculate how much time was worked in the morning
    const morningWorkMs = morningExit.getTime() - morningEntry.getTime()
    const morningWorkMinutes = Math.floor(morningWorkMs / (60 * 1000))

    // Target total work minutes (8 hours = 480 minutes)
    // Add some variation: 475-485 minutes
    const targetTotalWorkMinutes = 480 + getRandomBetween(-5, 5)

    // Calculate how many minutes to work in the afternoon
    const afternoonWorkMinutes = targetTotalWorkMinutes - morningWorkMinutes

    // Set afternoon exit time
    afternoonExit.setTime(afternoonEntry.getTime() + afternoonWorkMinutes * 60 * 1000)

    return {
      morningEntry,
      morningExit,
      afternoonEntry,
      afternoonExit,
    }
  }

  // Calculate total work hours for a day
  const calculateWorkHours = (
    morningEntry: Date,
    morningExit: Date,
    afternoonEntry: Date,
    afternoonExit: Date,
  ): string => {
    const morningMinutes = (morningExit.getTime() - morningEntry.getTime()) / (60 * 1000)
    const afternoonMinutes = (afternoonExit.getTime() - afternoonEntry.getTime()) / (60 * 1000)
    const totalMinutes = morningMinutes + afternoonMinutes

    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)

    return `${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`
  }

  // Check if a date is a holiday
  const isHoliday = (date: Date): boolean => {
    return holidays.some((holiday) => isSameDay(holiday, date))
  }

  // Add a holiday
  const addHoliday = () => {
    if (!holidayDate) return

    // Check if this date is already in the holidays array
    if (!holidays.some((holiday) => isSameDay(holiday, holidayDate))) {
      setHolidays([...holidays, holidayDate])
    }

    setHolidayDate(undefined)
    setHolidayPopoverOpen(false)
  }

  // Remove a holiday
  const removeHoliday = (dateToRemove: Date) => {
    setHolidays(holidays.filter((holiday) => !isSameDay(holiday, dateToRemove)))
  }

  // Clear all holidays
  const clearHolidays = () => {
    setHolidays([])
  }

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setSelectedMonth(subMonths(selectedMonth, 1))
  }

  // Navigate to next month
  const goToNextMonth = () => {
    setSelectedMonth(addMonths(selectedMonth, 1))
  }

  // Generate years array for select
  const years = Array.from({ length: 11 }, (_, i) => {
    const year = new Date().getFullYear() - 5 + i
    return { value: year.toString(), label: year.toString() }
  })

  // Generate months array for select
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(i)
    return {
      value: i.toString(),
      label: format(date, "MMMM", { locale: ptBR }),
    }
  })

  // Handle year change
  const handleYearChange = (year: string) => {
    const newDate = new Date(selectedMonth)
    newDate.setFullYear(Number.parseInt(year))
    setSelectedMonth(newDate)
  }

  // Handle month change
  const handleMonthChange = (month: string) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(Number.parseInt(month))
    setSelectedMonth(newDate)
  }

  const generateTimesheet = () => {
    if (!selectedMonth) return

    // Use the selected month to create dates
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const daysInMonth = getDaysInMonth(new Date(year, month))

    const baseSchedule = WORK_SCHEDULES.find((s) => s.id === selectedSchedule) || WORK_SCHEDULES[0]

    const entries: TimesheetEntry[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      // Create date in Brasília timezone for the selected month
      const date = new Date(year, month, day)
      const isWeekendDay = isWeekend(date)
      const isHolidayDay = isHoliday(date)

      if (isWeekendDay || isHolidayDay) {
        // Weekend or holiday entry with no times
        entries.push({
          date,
          dayOfWeek: format(date, "EEEE", { locale: ptBR }),
          isWeekend: isWeekendDay,
          isHoliday: isHolidayDay,
          morningEntry: "",
          morningExit: "",
          afternoonEntry: "",
          afternoonExit: "",
          totalHours: "",
        })
      } else {
        // Generate random schedule for each workday based on selected schedule
        const schedule = generateRandomWorkSchedule(baseSchedule)

        entries.push({
          date,
          dayOfWeek: format(date, "EEEE", { locale: ptBR }),
          isWeekend: false,
          isHoliday: false,
          morningEntry: formatTime(schedule.morningEntry),
          morningExit: formatTime(schedule.morningExit),
          afternoonEntry: formatTime(schedule.afternoonEntry),
          afternoonExit: formatTime(schedule.afternoonExit),
          totalHours: calculateWorkHours(
            schedule.morningEntry,
            schedule.morningExit,
            schedule.afternoonEntry,
            schedule.afternoonExit,
          ),
        })
      }
    }

    setTimesheetEntries(entries)
  }

  const handlePrint = () => {
    window.print()
  }

  // Get the name of the currently selected schedule
  const getSelectedScheduleName = (): string => {
    const schedule = WORK_SCHEDULES.find((s) => s.id === selectedSchedule)
    return schedule ? schedule.name.split(" ")[0] : ""
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Gerador de Folha de Ponto</CardTitle>
          <CardDescription>
            Gere sua folha de ponto com horários aleatórios baseados no seu horário de trabalho.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Selecione o Mês</Label>

              {/* Custom month/year selector */}
              <div className="border rounded-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex gap-2">
                    <Select value={selectedMonth.getMonth().toString()} onValueChange={handleMonthChange}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedMonth.getFullYear().toString()} onValueChange={handleYearChange}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year.value} value={year.value}>
                            {year.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-center py-2 bg-muted rounded-md">
                  <span className="text-lg font-medium">{format(selectedMonth, "MMMM yyyy", { locale: ptBR })}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Feriados</Label>
                {holidays.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearHolidays} className="h-8 px-2 text-xs">
                    Limpar todos
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                {holidays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum feriado marcado</p>
                ) : (
                  holidays.map((holiday, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {format(holiday, "dd/MM/yyyy")}
                      <button onClick={() => removeHoliday(holiday)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>

              <Popover open={holidayPopoverOpen} onOpenChange={setHolidayPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Adicionar Feriado
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={holidayDate} onSelect={setHolidayDate} initialFocus />
                  <div className="p-3 border-t border-border">
                    <Button onClick={addHoliday} disabled={!holidayDate} className="w-full">
                      Adicionar Feriado
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule">Horário de Trabalho</Label>
              <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                <SelectTrigger id="schedule">
                  <SelectValue placeholder="Selecione um horário" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_SCHEDULES.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              <p>Configuração de geração:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Entrada da manhã: entre o horário base e +17 min (maioria dentro da tolerância de 10 min)</li>
                <li>Intervalo de almoço: aproximadamente 1 hora</li>
                <li>Total de trabalho: aproximadamente 8 horas por dia</li>
                <li>Variações naturais nos horários de saída</li>
                <li>Feriados e fins de semana não têm horários</li>
              </ul>
            </div>
            <Button className="w-full mt-8" onClick={generateTimesheet}>
              Gerar Folha de Ponto
            </Button>
          </div>
        </CardContent>
      </Card>

      {timesheetEntries.length > 0 && (
        <Card className="md:col-span-2 print:shadow-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Folha de Ponto - {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}</CardTitle>
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> Horário de Brasília | Horário base: {getSelectedScheduleName()} |
                Tolerância de entrada: 10 minutos
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handlePrint} className="print:hidden">
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] md:h-auto print:h-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead>Entrada Manhã</TableHead>
                    <TableHead>Saída Manhã</TableHead>
                    <TableHead>Entrada Tarde</TableHead>
                    <TableHead>Saída Tarde</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheetEntries.map((entry) => (
                    <TableRow
                      key={entry.date.toISOString()}
                      className={entry.isWeekend || entry.isHoliday ? "bg-muted" : ""}
                    >
                      <TableCell>
                        {format(entry.date, "dd/MM/yyyy")}
                        {entry.isHoliday && (
                          <Badge variant="outline" className="ml-2">
                            Feriado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{entry.dayOfWeek}</TableCell>
                      <TableCell>{entry.morningEntry}</TableCell>
                      <TableCell>{entry.morningExit}</TableCell>
                      <TableCell>{entry.afternoonEntry}</TableCell>
                      <TableCell>{entry.afternoonExit}</TableCell>
                      <TableCell>{entry.totalHours}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

