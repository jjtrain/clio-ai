--
-- PostgreSQL database dump
--

\restrict 87xeaj3mxYQn9WOQ339BgtC83sYNEkDMIbObPFRcRIo2KYEQ95kdqNsgUi6dFkw

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ClientStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ClientStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'ARCHIVED'
);


ALTER TYPE public."ClientStatus" OWNER TO postgres;

--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);


ALTER TYPE public."InvoiceStatus" OWNER TO postgres;

--
-- Name: MatterStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MatterStatus" AS ENUM (
    'OPEN',
    'CLOSED',
    'PENDING'
);


ALTER TYPE public."MatterStatus" OWNER TO postgres;

--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'CHECK',
    'CREDIT_CARD',
    'BANK_TRANSFER',
    'OTHER'
);


ALTER TYPE public."PaymentMethod" OWNER TO postgres;

--
-- Name: TaskPriority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TaskPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE public."TaskPriority" OWNER TO postgres;

--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED'
);


ALTER TYPE public."TaskStatus" OWNER TO postgres;

--
-- Name: TrustFundSource; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TrustFundSource" AS ENUM (
    'WIRE_TRANSFER',
    'CHECK',
    'CASH',
    'ACH',
    'CREDIT_CARD',
    'MONEY_ORDER',
    'CASHIERS_CHECK',
    'INTERNAL_TRANSFER',
    'OTHER'
);


ALTER TYPE public."TrustFundSource" OWNER TO postgres;

--
-- Name: TrustTransactionType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TrustTransactionType" AS ENUM (
    'DEPOSIT',
    'WITHDRAWAL',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'INTEREST',
    'BANK_FEE',
    'VOID_REVERSAL'
);


ALTER TYPE public."TrustTransactionType" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: CalendarEvent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CalendarEvent" (
    id text NOT NULL,
    "matterId" text,
    title text NOT NULL,
    description text,
    "startTime" timestamp(3) without time zone NOT NULL,
    "endTime" timestamp(3) without time zone NOT NULL,
    "allDay" boolean DEFAULT false NOT NULL,
    location text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CalendarEvent" OWNER TO postgres;

--
-- Name: Client; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Client" (
    id text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    notes text,
    status public."ClientStatus" DEFAULT 'ACTIVE'::public."ClientStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Client" OWNER TO postgres;

--
-- Name: Document; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Document" (
    id text NOT NULL,
    "matterId" text NOT NULL,
    name text NOT NULL,
    filename text NOT NULL,
    "mimeType" text NOT NULL,
    size integer NOT NULL,
    path text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Document" OWNER TO postgres;

--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "invoiceNumber" text NOT NULL,
    "matterId" text NOT NULL,
    status public."InvoiceStatus" DEFAULT 'DRAFT'::public."InvoiceStatus" NOT NULL,
    "issueDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    "taxRate" numeric(5,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    "amountPaid" numeric(10,2) DEFAULT 0 NOT NULL,
    notes text,
    "sentAt" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Invoice" OWNER TO postgres;

--
-- Name: InvoiceLineItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."InvoiceLineItem" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    description text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    rate numeric(10,2) NOT NULL,
    amount numeric(10,2) NOT NULL,
    date timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."InvoiceLineItem" OWNER TO postgres;

--
-- Name: Matter; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Matter" (
    id text NOT NULL,
    "clientId" text NOT NULL,
    name text NOT NULL,
    description text,
    "matterNumber" text NOT NULL,
    status public."MatterStatus" DEFAULT 'OPEN'::public."MatterStatus" NOT NULL,
    "practiceArea" text,
    "openDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closeDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Matter" OWNER TO postgres;

--
-- Name: Payment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    amount numeric(10,2) NOT NULL,
    "paymentDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "paymentMethod" public."PaymentMethod" NOT NULL,
    reference text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Payment" OWNER TO postgres;

--
-- Name: Task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    status public."TaskStatus" DEFAULT 'NOT_STARTED'::public."TaskStatus" NOT NULL,
    priority public."TaskPriority" DEFAULT 'MEDIUM'::public."TaskPriority" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "matterId" text,
    "assigneeId" text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Task" OWNER TO postgres;

--
-- Name: TimeEntry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TimeEntry" (
    id text NOT NULL,
    "matterId" text NOT NULL,
    "userId" text NOT NULL,
    description text NOT NULL,
    duration integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    billable boolean DEFAULT true NOT NULL,
    rate numeric(10,2),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "invoiceLineItemId" text
);


ALTER TABLE public."TimeEntry" OWNER TO postgres;

--
-- Name: TrustAccount; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TrustAccount" (
    id text NOT NULL,
    name text NOT NULL,
    "accountNumber" text NOT NULL,
    "bankName" text NOT NULL,
    "routingNumber" text,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "bankBalance" numeric(12,2) DEFAULT 0 NOT NULL,
    "lastReconciledAt" timestamp(3) without time zone,
    "lastReconciledBalance" numeric(12,2),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "nextTransactionNumber" integer DEFAULT 1 NOT NULL
);


ALTER TABLE public."TrustAccount" OWNER TO postgres;

--
-- Name: TrustAuditLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TrustAuditLog" (
    id text NOT NULL,
    "trustAccountId" text NOT NULL,
    "trustLedgerId" text,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    "previousValue" text,
    "newValue" text,
    "userId" text,
    "ipAddress" text,
    "userAgent" text,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TrustAuditLog" OWNER TO postgres;

--
-- Name: TrustLedger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TrustLedger" (
    id text NOT NULL,
    "trustAccountId" text NOT NULL,
    "clientId" text NOT NULL,
    "matterId" text,
    balance numeric(12,2) DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TrustLedger" OWNER TO postgres;

--
-- Name: TrustTransaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TrustTransaction" (
    id text NOT NULL,
    "trustAccountId" text NOT NULL,
    "trustLedgerId" text NOT NULL,
    type public."TrustTransactionType" NOT NULL,
    amount numeric(12,2) NOT NULL,
    "runningBalance" numeric(12,2) NOT NULL,
    description text NOT NULL,
    reference text,
    payee text,
    "checkNumber" text,
    "transactionDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "clearedDate" timestamp(3) without time zone,
    "isCleared" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "enteredById" text,
    "isVoided" boolean DEFAULT false NOT NULL,
    payor text,
    source public."TrustFundSource",
    "transactionNumber" integer NOT NULL,
    "voidReason" text,
    "voidedAt" timestamp(3) without time zone,
    "voidedById" text,
    "voidingTransactionId" text
);


ALTER TABLE public."TrustTransaction" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    "passwordHash" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    address text,
    "firmName" text,
    phone text
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Data for Name: CalendarEvent; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CalendarEvent" (id, "matterId", title, description, "startTime", "endTime", "allDay", location, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Client" (id, name, email, phone, address, notes, status, "createdAt", "updatedAt") FROM stdin;
cml5g7c200001b2r8wav4f78y	Meir Friedland	\N	\N	\N	\N	ACTIVE	2026-02-02 17:33:06.116	2026-02-02 17:33:06.116
cml5g7vn00002b2r8blpybeqy	Marie Bernard	\N	\N	\N	\N	ACTIVE	2026-02-02 17:33:31.499	2026-02-02 17:33:31.499
cml5g88rt0003b2r8om4t1f3u	Djibril Gueye	\N	\N	\N	\N	ACTIVE	2026-02-02 17:33:48.52	2026-02-02 17:33:48.52
cml5gprlu0004b2r8hqgxf6vf	Jay Tusk	\N	\N	\N	\N	ACTIVE	2026-02-02 17:47:26.077	2026-02-02 17:47:26.077
cml5gq3m60005b2r88u3pugui	Jessica Longo	\N	\N	\N	\N	ACTIVE	2026-02-02 17:47:41.645	2026-02-02 17:47:41.645
cml5gqjss0006b2r87fj58wlh	Syuzanna Khait	\N	\N	\N	\N	ACTIVE	2026-02-02 17:48:02.597	2026-02-02 17:48:02.597
cml5gquiy0007b2r8go7o32xb	Cesar Henriquez	\N	\N	\N	\N	ACTIVE	2026-02-02 17:48:16.523	2026-02-02 17:48:16.523
cml5h6fmo0008b2r8p1m5v0bw	Shlomo Makaron	\N	\N	\N	\N	ACTIVE	2026-02-02 18:00:23.702	2026-02-02 18:00:23.702
cml5h6rl10009b2r8c1qiqnwl	Yaakov Gerbi	\N	\N	\N	\N	ACTIVE	2026-02-02 18:00:39.203	2026-02-02 18:00:39.203
cml5hd3uu000ab2r8uvk35da1	Trevor Keller	\N	\N	\N	\N	ACTIVE	2026-02-02 18:05:34.939	2026-02-02 18:05:34.939
cml5hdkpt000bb2r877frqom3	Elliott Cohen	\N	\N	\N	\N	ACTIVE	2026-02-02 18:05:56.894	2026-02-02 18:05:56.894
cml5kjiqk000cb2r8rwwf7rc5	Ezriel Schonberger	\N	\N	\N	\N	ACTIVE	2026-02-02 19:34:33.109	2026-02-02 19:34:33.109
cml5kjuaj000db2r881y3nr9d	Michael Rollhaus	\N	\N	\N	\N	ACTIVE	2026-02-02 19:34:48.09	2026-02-02 19:34:48.09
cml5kkpce000eb2r88ovao4dq	Rachel Lyons	\N	\N	\N	\N	ACTIVE	2026-02-02 19:35:28.334	2026-02-02 19:35:28.334
cml5kl4l8000fb2r8wxfueaw8	Hilly Lichtenstein	\N	\N	\N	\N	ACTIVE	2026-02-02 19:35:48.091	2026-02-02 19:35:48.091
cml5kluy6000gb2r8wx577gax	Medleom Golf	\N	\N	\N	\N	ACTIVE	2026-02-02 19:36:22.254	2026-02-02 19:36:22.254
cml5km586000hb2r8l4cwiz7l	Charlie Razook	\N	\N	\N	\N	ACTIVE	2026-02-02 19:36:35.573	2026-02-02 19:36:35.573
cml5kogxh000ib2r8lwqkkhkb	Pinchus Morozow	\N	\N	\N	\N	ACTIVE	2026-02-02 19:38:24.053	2026-02-02 19:38:24.053
cml5koox1000jb2r8t71rbztt	Sol Kelman	\N	\N	\N	\N	ACTIVE	2026-02-02 19:38:34.404	2026-02-02 19:38:34.404
cml5ktiay000kb2r8xrl1wxya	Elchonon Weisman	\N	\N	\N	\N	ACTIVE	2026-02-02 19:42:19.113	2026-02-02 19:42:19.113
cml5ktszi000lb2r8wp2fm8d4	Carlos Urbina	\N	\N	\N	\N	ACTIVE	2026-02-02 19:42:32.958	2026-02-02 19:42:32.958
cml5kyy7d000mb2r8mkp9d647	Yehudit Sanders	\N	\N	\N	\N	ACTIVE	2026-02-02 19:46:33.001	2026-02-02 19:46:33.001
cml5kz7td000nb2r81j3i7h48	Erik Bober	\N	\N	\N	\N	ACTIVE	2026-02-02 19:46:45.432	2026-02-02 19:46:45.432
cml5l1aut000ob2r8ghjqen4h	Esty Breier	\N	\N	\N	\N	ACTIVE	2026-02-02 19:48:22.707	2026-02-02 19:48:22.707
cml5l74sk000pb2r8y6v4v8qc	Smooth Auto Leasing	\N	\N	\N	\N	ACTIVE	2026-02-02 19:52:54.789	2026-02-02 19:52:54.789
cml5l7fyp000qb2r8pvr3p46s	Alora Bijou	\N	\N	\N	\N	ACTIVE	2026-02-02 19:53:09.263	2026-02-02 19:53:09.263
cml5la6dw000rb2r8acqiw63b	Bluview	\N	\N	\N	\N	ACTIVE	2026-02-02 19:55:16.82	2026-02-02 19:55:16.82
cml5laguy000sb2r8k410208i	Thermglass	\N	\N	\N	\N	ACTIVE	2026-02-02 19:55:30.356	2026-02-02 19:55:30.356
cml5lbnqy000tb2r82dd32mkw	Tribe Training Club 	\N	\N	\N	\N	ACTIVE	2026-02-02 19:56:25.976	2026-02-02 19:56:25.976
cml5lbzdc000ub2r8mz9yojmm	Nechami Tenenbaum	\N	\N	\N	\N	ACTIVE	2026-02-02 19:56:41.039	2026-02-02 19:56:41.039
\.


--
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Document" (id, "matterId", name, filename, "mimeType", size, path, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Invoice" (id, "invoiceNumber", "matterId", status, "issueDate", "dueDate", subtotal, "taxRate", "taxAmount", total, "amountPaid", notes, "sentAt", "paidAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: InvoiceLineItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."InvoiceLineItem" (id, "invoiceId", description, quantity, rate, amount, date, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Matter; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Matter" (id, "clientId", name, description, "matterNumber", status, "practiceArea", "openDate", "closeDate", "createdAt", "updatedAt") FROM stdin;
cml5n6rbh000wb2r8rp024887	cml5kjuaj000db2r881y3nr9d	Rollhaus v. RSP	\N	2026-7791	OPEN	Corporate	2026-02-02 20:48:36.554	\N	2026-02-02 20:48:36.554	2026-02-02 20:48:36.554
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Payment" (id, "invoiceId", amount, "paymentDate", "paymentMethod", reference, notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Task" (id, title, description, status, priority, "dueDate", "completedAt", "matterId", "assigneeId", "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TimeEntry; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TimeEntry" (id, "matterId", "userId", description, duration, date, billable, rate, "createdAt", "updatedAt", "invoiceLineItemId") FROM stdin;
\.


--
-- Data for Name: TrustAccount; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TrustAccount" (id, name, "accountNumber", "bankName", "routingNumber", description, "isActive", "bankBalance", "lastReconciledAt", "lastReconciledBalance", "createdAt", "updatedAt", "nextTransactionNumber") FROM stdin;
\.


--
-- Data for Name: TrustAuditLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TrustAuditLog" (id, "trustAccountId", "trustLedgerId", action, "entityType", "entityId", "previousValue", "newValue", "userId", "ipAddress", "userAgent", "timestamp") FROM stdin;
\.


--
-- Data for Name: TrustLedger; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TrustLedger" (id, "trustAccountId", "clientId", "matterId", balance, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TrustTransaction; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TrustTransaction" (id, "trustAccountId", "trustLedgerId", type, amount, "runningBalance", description, reference, payee, "checkNumber", "transactionDate", "clearedDate", "isCleared", "createdAt", "updatedAt", "enteredById", "isVoided", payor, source, "transactionNumber", "voidReason", "voidedAt", "voidedById", "voidingTransactionId") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, name, "passwordHash", "createdAt", "updatedAt", address, "firmName", phone) FROM stdin;
cml4qs9wh0000b2r8eyea1dnu	jr@rubesq.com	Jacob Rubinstein	$2b$12$N56gF9VcHM2BMAEywyb/e.W02.txtlVsTfAhutyn.Ovlfp35PNmi2	2026-02-02 05:41:33.078	2026-02-02 05:41:33.078	\N	\N	\N
\.


--
-- Name: CalendarEvent CalendarEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CalendarEvent"
    ADD CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceLineItem InvoiceLineItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InvoiceLineItem"
    ADD CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: Matter Matter_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Matter"
    ADD CONSTRAINT "Matter_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TimeEntry TimeEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_pkey" PRIMARY KEY (id);


--
-- Name: TrustAccount TrustAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustAccount"
    ADD CONSTRAINT "TrustAccount_pkey" PRIMARY KEY (id);


--
-- Name: TrustAuditLog TrustAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustAuditLog"
    ADD CONSTRAINT "TrustAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: TrustLedger TrustLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustLedger"
    ADD CONSTRAINT "TrustLedger_pkey" PRIMARY KEY (id);


--
-- Name: TrustTransaction TrustTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustTransaction"
    ADD CONSTRAINT "TrustTransaction_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: CalendarEvent_matterId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "CalendarEvent_matterId_idx" ON public."CalendarEvent" USING btree ("matterId");


--
-- Name: Document_matterId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Document_matterId_idx" ON public."Document" USING btree ("matterId");


--
-- Name: InvoiceLineItem_invoiceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON public."InvoiceLineItem" USING btree ("invoiceId");


--
-- Name: Invoice_invoiceNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON public."Invoice" USING btree ("invoiceNumber");


--
-- Name: Invoice_matterId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Invoice_matterId_idx" ON public."Invoice" USING btree ("matterId");


--
-- Name: Invoice_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Invoice_status_idx" ON public."Invoice" USING btree (status);


--
-- Name: Matter_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Matter_clientId_idx" ON public."Matter" USING btree ("clientId");


--
-- Name: Matter_matterNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Matter_matterNumber_key" ON public."Matter" USING btree ("matterNumber");


--
-- Name: Payment_invoiceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_invoiceId_idx" ON public."Payment" USING btree ("invoiceId");


--
-- Name: Task_assigneeId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_assigneeId_idx" ON public."Task" USING btree ("assigneeId");


--
-- Name: Task_dueDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_dueDate_idx" ON public."Task" USING btree ("dueDate");


--
-- Name: Task_matterId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_matterId_idx" ON public."Task" USING btree ("matterId");


--
-- Name: Task_priority_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_priority_idx" ON public."Task" USING btree (priority);


--
-- Name: Task_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_status_idx" ON public."Task" USING btree (status);


--
-- Name: TimeEntry_invoiceLineItemId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TimeEntry_invoiceLineItemId_idx" ON public."TimeEntry" USING btree ("invoiceLineItemId");


--
-- Name: TimeEntry_matterId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TimeEntry_matterId_idx" ON public."TimeEntry" USING btree ("matterId");


--
-- Name: TimeEntry_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TimeEntry_userId_idx" ON public."TimeEntry" USING btree ("userId");


--
-- Name: TrustAccount_accountNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "TrustAccount_accountNumber_key" ON public."TrustAccount" USING btree ("accountNumber");


--
-- Name: TrustAuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustAuditLog_entityType_entityId_idx" ON public."TrustAuditLog" USING btree ("entityType", "entityId");


--
-- Name: TrustAuditLog_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustAuditLog_timestamp_idx" ON public."TrustAuditLog" USING btree ("timestamp");


--
-- Name: TrustAuditLog_trustAccountId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustAuditLog_trustAccountId_idx" ON public."TrustAuditLog" USING btree ("trustAccountId");


--
-- Name: TrustAuditLog_trustLedgerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustAuditLog_trustLedgerId_idx" ON public."TrustAuditLog" USING btree ("trustLedgerId");


--
-- Name: TrustAuditLog_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustAuditLog_userId_idx" ON public."TrustAuditLog" USING btree ("userId");


--
-- Name: TrustLedger_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustLedger_clientId_idx" ON public."TrustLedger" USING btree ("clientId");


--
-- Name: TrustLedger_matterId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustLedger_matterId_idx" ON public."TrustLedger" USING btree ("matterId");


--
-- Name: TrustLedger_trustAccountId_clientId_matterId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "TrustLedger_trustAccountId_clientId_matterId_key" ON public."TrustLedger" USING btree ("trustAccountId", "clientId", "matterId");


--
-- Name: TrustLedger_trustAccountId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustLedger_trustAccountId_idx" ON public."TrustLedger" USING btree ("trustAccountId");


--
-- Name: TrustTransaction_enteredById_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustTransaction_enteredById_idx" ON public."TrustTransaction" USING btree ("enteredById");


--
-- Name: TrustTransaction_isVoided_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustTransaction_isVoided_idx" ON public."TrustTransaction" USING btree ("isVoided");


--
-- Name: TrustTransaction_transactionDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustTransaction_transactionDate_idx" ON public."TrustTransaction" USING btree ("transactionDate");


--
-- Name: TrustTransaction_trustAccountId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustTransaction_trustAccountId_idx" ON public."TrustTransaction" USING btree ("trustAccountId");


--
-- Name: TrustTransaction_trustAccountId_transactionNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "TrustTransaction_trustAccountId_transactionNumber_key" ON public."TrustTransaction" USING btree ("trustAccountId", "transactionNumber");


--
-- Name: TrustTransaction_trustLedgerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustTransaction_trustLedgerId_idx" ON public."TrustTransaction" USING btree ("trustLedgerId");


--
-- Name: TrustTransaction_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TrustTransaction_type_idx" ON public."TrustTransaction" USING btree (type);


--
-- Name: TrustTransaction_voidingTransactionId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "TrustTransaction_voidingTransactionId_key" ON public."TrustTransaction" USING btree ("voidingTransactionId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: CalendarEvent CalendarEvent_matterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CalendarEvent"
    ADD CONSTRAINT "CalendarEvent_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES public."Matter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Document Document_matterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES public."Matter"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLineItem InvoiceLineItem_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InvoiceLineItem"
    ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_matterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES public."Matter"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Matter Matter_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Matter"
    ADD CONSTRAINT "Matter_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_matterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES public."Matter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TimeEntry TimeEntry_invoiceLineItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_invoiceLineItemId_fkey" FOREIGN KEY ("invoiceLineItemId") REFERENCES public."InvoiceLineItem"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TimeEntry TimeEntry_matterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES public."Matter"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TimeEntry TimeEntry_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TrustAuditLog TrustAuditLog_trustAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustAuditLog"
    ADD CONSTRAINT "TrustAuditLog_trustAccountId_fkey" FOREIGN KEY ("trustAccountId") REFERENCES public."TrustAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TrustAuditLog TrustAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustAuditLog"
    ADD CONSTRAINT "TrustAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TrustLedger TrustLedger_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustLedger"
    ADD CONSTRAINT "TrustLedger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TrustLedger TrustLedger_matterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustLedger"
    ADD CONSTRAINT "TrustLedger_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES public."Matter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TrustLedger TrustLedger_trustAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustLedger"
    ADD CONSTRAINT "TrustLedger_trustAccountId_fkey" FOREIGN KEY ("trustAccountId") REFERENCES public."TrustAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TrustTransaction TrustTransaction_enteredById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustTransaction"
    ADD CONSTRAINT "TrustTransaction_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TrustTransaction TrustTransaction_trustAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustTransaction"
    ADD CONSTRAINT "TrustTransaction_trustAccountId_fkey" FOREIGN KEY ("trustAccountId") REFERENCES public."TrustAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TrustTransaction TrustTransaction_trustLedgerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustTransaction"
    ADD CONSTRAINT "TrustTransaction_trustLedgerId_fkey" FOREIGN KEY ("trustLedgerId") REFERENCES public."TrustLedger"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TrustTransaction TrustTransaction_voidedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustTransaction"
    ADD CONSTRAINT "TrustTransaction_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TrustTransaction TrustTransaction_voidingTransactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TrustTransaction"
    ADD CONSTRAINT "TrustTransaction_voidingTransactionId_fkey" FOREIGN KEY ("voidingTransactionId") REFERENCES public."TrustTransaction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 87xeaj3mxYQn9WOQ339BgtC83sYNEkDMIbObPFRcRIo2KYEQ95kdqNsgUi6dFkw

