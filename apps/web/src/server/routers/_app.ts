import { router } from "../trpc";
import { clientsRouter } from "./clients";
import { mattersRouter } from "./matters";
import { timeEntriesRouter } from "./timeEntries";
import { documentsRouter } from "./documents";
import { calendarRouter } from "./calendar";
import { usersRouter } from "./users";
import { invoicesRouter } from "./invoices";
import { trustRouter } from "./trust";
import { tasksRouter } from "./tasks";
import { schedulerRouter } from "./scheduler";
import { intakeFormsRouter } from "./intakeForms";
import { leadsRouter } from "./leads";
import { chatRouter } from "./chat";
import { contactFormRouter } from "./contactForm";
import { conflictsRouter } from "./conflicts";
import { relatedPartiesRouter } from "./relatedParties";

export const appRouter = router({
  clients: clientsRouter,
  matters: mattersRouter,
  timeEntries: timeEntriesRouter,
  documents: documentsRouter,
  calendar: calendarRouter,
  users: usersRouter,
  invoices: invoicesRouter,
  trust: trustRouter,
  tasks: tasksRouter,
  scheduler: schedulerRouter,
  intakeForms: intakeFormsRouter,
  leads: leadsRouter,
  chat: chatRouter,
  contactForm: contactFormRouter,
  conflicts: conflictsRouter,
  relatedParties: relatedPartiesRouter,
});

export type AppRouter = typeof appRouter;
