pg_dump: warning: there are circular foreign-key constraints on this table:
pg_dump: detail: TrustTransaction
pg_dump: hint: You might not be able to restore the dump without using --disable-triggers or temporarily dropping the constraints.
pg_dump: hint: Consider using a full dump instead of a --data-only dump to avoid this problem.
--
-- PostgreSQL database dump
--

\restrict f7qMb24hwAlEftlBOUPmodRXZDOyYc2uW1zYqc6gGJtuXgOEbUcNOcQbfF4Vj44

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
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public."Client" VALUES ('cml5g7c200001b2r8wav4f78y', 'Meir Friedland', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 17:33:06.116', '2026-02-02 17:33:06.116');
INSERT INTO public."Client" VALUES ('cml5g7vn00002b2r8blpybeqy', 'Marie Bernard', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 17:33:31.499', '2026-02-02 17:33:31.499');
INSERT INTO public."Client" VALUES ('cml5g88rt0003b2r8om4t1f3u', 'Djibril Gueye', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 17:33:48.52', '2026-02-02 17:33:48.52');
INSERT INTO public."Client" VALUES ('cml5gprlu0004b2r8hqgxf6vf', 'Jay Tusk', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 17:47:26.077', '2026-02-02 17:47:26.077');
INSERT INTO public."Client" VALUES ('cml5gq3m60005b2r88u3pugui', 'Jessica Longo', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 17:47:41.645', '2026-02-02 17:47:41.645');
INSERT INTO public."Client" VALUES ('cml5gqjss0006b2r87fj58wlh', 'Syuzanna Khait', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 17:48:02.597', '2026-02-02 17:48:02.597');
INSERT INTO public."Client" VALUES ('cml5gquiy0007b2r8go7o32xb', 'Cesar Henriquez', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 17:48:16.523', '2026-02-02 17:48:16.523');
INSERT INTO public."Client" VALUES ('cml5h6fmo0008b2r8p1m5v0bw', 'Shlomo Makaron', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 18:00:23.702', '2026-02-02 18:00:23.702');
INSERT INTO public."Client" VALUES ('cml5h6rl10009b2r8c1qiqnwl', 'Yaakov Gerbi', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 18:00:39.203', '2026-02-02 18:00:39.203');
INSERT INTO public."Client" VALUES ('cml5hd3uu000ab2r8uvk35da1', 'Trevor Keller', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 18:05:34.939', '2026-02-02 18:05:34.939');
INSERT INTO public."Client" VALUES ('cml5hdkpt000bb2r877frqom3', 'Elliott Cohen', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 18:05:56.894', '2026-02-02 18:05:56.894');
INSERT INTO public."Client" VALUES ('cml5kjiqk000cb2r8rwwf7rc5', 'Ezriel Schonberger', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:34:33.109', '2026-02-02 19:34:33.109');
INSERT INTO public."Client" VALUES ('cml5kjuaj000db2r881y3nr9d', 'Michael Rollhaus', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:34:48.09', '2026-02-02 19:34:48.09');
INSERT INTO public."Client" VALUES ('cml5kkpce000eb2r88ovao4dq', 'Rachel Lyons', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:35:28.334', '2026-02-02 19:35:28.334');
INSERT INTO public."Client" VALUES ('cml5kl4l8000fb2r8wxfueaw8', 'Hilly Lichtenstein', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:35:48.091', '2026-02-02 19:35:48.091');
INSERT INTO public."Client" VALUES ('cml5kluy6000gb2r8wx577gax', 'Medleom Golf', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:36:22.254', '2026-02-02 19:36:22.254');
INSERT INTO public."Client" VALUES ('cml5km586000hb2r8l4cwiz7l', 'Charlie Razook', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:36:35.573', '2026-02-02 19:36:35.573');
INSERT INTO public."Client" VALUES ('cml5kogxh000ib2r8lwqkkhkb', 'Pinchus Morozow', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:38:24.053', '2026-02-02 19:38:24.053');
INSERT INTO public."Client" VALUES ('cml5koox1000jb2r8t71rbztt', 'Sol Kelman', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:38:34.404', '2026-02-02 19:38:34.404');
INSERT INTO public."Client" VALUES ('cml5ktiay000kb2r8xrl1wxya', 'Elchonon Weisman', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:42:19.113', '2026-02-02 19:42:19.113');
INSERT INTO public."Client" VALUES ('cml5ktszi000lb2r8wp2fm8d4', 'Carlos Urbina', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:42:32.958', '2026-02-02 19:42:32.958');
INSERT INTO public."Client" VALUES ('cml5kyy7d000mb2r8mkp9d647', 'Yehudit Sanders', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:46:33.001', '2026-02-02 19:46:33.001');
INSERT INTO public."Client" VALUES ('cml5kz7td000nb2r81j3i7h48', 'Erik Bober', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:46:45.432', '2026-02-02 19:46:45.432');
INSERT INTO public."Client" VALUES ('cml5l1aut000ob2r8ghjqen4h', 'Esty Breier', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:48:22.707', '2026-02-02 19:48:22.707');
INSERT INTO public."Client" VALUES ('cml5l74sk000pb2r8y6v4v8qc', 'Smooth Auto Leasing', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:52:54.789', '2026-02-02 19:52:54.789');
INSERT INTO public."Client" VALUES ('cml5l7fyp000qb2r8pvr3p46s', 'Alora Bijou', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:53:09.263', '2026-02-02 19:53:09.263');
INSERT INTO public."Client" VALUES ('cml5la6dw000rb2r8acqiw63b', 'Bluview', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:55:16.82', '2026-02-02 19:55:16.82');
INSERT INTO public."Client" VALUES ('cml5laguy000sb2r8k410208i', 'Thermglass', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:55:30.356', '2026-02-02 19:55:30.356');
INSERT INTO public."Client" VALUES ('cml5lbnqy000tb2r82dd32mkw', 'Tribe Training Club ', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:56:25.976', '2026-02-02 19:56:25.976');
INSERT INTO public."Client" VALUES ('cml5lbzdc000ub2r8mz9yojmm', 'Nechami Tenenbaum', NULL, NULL, NULL, NULL, 'ACTIVE', '2026-02-02 19:56:41.039', '2026-02-02 19:56:41.039');


--
-- Data for Name: Matter; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public."Matter" VALUES ('cml5n6rbh000wb2r8rp024887', 'cml5kjuaj000db2r881y3nr9d', 'Rollhaus v. RSP', NULL, '2026-7791', 'OPEN', 'Corporate', '2026-02-02 20:48:36.554', NULL, '2026-02-02 20:48:36.554', '2026-02-02 20:48:36.554');


--
-- Data for Name: CalendarEvent; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: InvoiceLineItem; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public."User" VALUES ('cml4qs9wh0000b2r8eyea1dnu', 'jr@rubesq.com', 'Jacob Rubinstein', '$2b$12$N56gF9VcHM2BMAEywyb/e.W02.txtlVsTfAhutyn.Ovlfp35PNmi2', '2026-02-02 05:41:33.078', '2026-02-02 05:41:33.078', NULL, NULL, NULL);


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: TimeEntry; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: TrustAccount; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: TrustAuditLog; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: TrustLedger; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: TrustTransaction; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- PostgreSQL database dump complete
--

\unrestrict f7qMb24hwAlEftlBOUPmodRXZDOyYc2uW1zYqc6gGJtuXgOEbUcNOcQbfF4Vj44

