# Task: Add Photo Expense Capture to Clio AI

Add a Photo Expense Capture feature that lets me photograph/upload receipts, extract expense data using Claude's vision API, and save expenses linked to matters.

## What to build (in this order):

### 1. Schema Updates
- Check the existing `Expense` model in `prisma/schema.prisma`
- Add these fields if missing: `receiptUrl String?`, `receiptFileName String?`, `extractionSource String?` ("ai_vision" | "manual"), `extractionRaw Json?`, `extractionConfidence String?` ("high" | "medium" | "low")
- Ensure `ExpenseCategory` enum exists with: FILING_FEE, COURT_COST, EXPERT_WITNESS, DEPOSITION, TRAVEL, MEALS_ENTERTAINMENT, POSTAGE, COPYING, RESEARCH, SERVICE_OF_PROCESS, MEDIATION, OFFICE_SUPPLY, SOFTWARE, PROCESS_SERVER, TRANSLATOR, OTHER
- Run `npx prisma db push`

### 2. Receipt Extraction Service — `src/lib/receipt-extraction.ts`
- Use the Anthropic SDK (follow the same pattern as `src/lib/ai-chat.ts` for client instantiation)
- Send receipt image as base64 to `claude-sonnet-4-20250514` with vision
- Prompt should extract: vendor, amount (number), date (YYYY-MM-DD), category (matching ExpenseCategory enum), description, taxAmount, paymentMethod, confidence level, and rawItems array
- Return typed `ExtractedExpense` interface
- Parse JSON response, strip markdown fences if present

### 3. Upload Utility — `src/lib/upload.ts`
- If `@vercel/blob` is in package.json, use it: `put('receipts/${timestamp}-${filename}', buffer, { access: 'public', contentType })`
- If not, install it: `npm install @vercel/blob`
- Export `uploadReceiptImage(file: Buffer, filename: string, contentType: string): Promise<string>`

### 4. Category Labels Utility — `src/lib/expense-categories.ts`
- Map each ExpenseCategory enum value to a human-friendly label (e.g. FILING_FEE → "Filing Fees")
- Export PAYMENT_METHODS array: "Firm Credit Card", "Personal Card", "Cash", "Check", "Petty Cash", "ACH"

### 5. tRPC Router — `src/server/routers/expenses.ts`
Follow the exact pattern from existing routers (check `clients.ts` or `scheduler.ts`). Create these procedures:
- `extractFromReceipt` — mutation, takes imageBase64 + mediaType, calls receipt-extraction service, returns extracted data
- `uploadReceipt` — mutation, takes imageBase64 + fileName + contentType, uploads via upload utility, returns URL
- `create` — mutation, takes all expense fields including receiptUrl/extractionSource/extractionRaw/extractionConfidence, creates Prisma record
- `list` — query, supports filters (matterId, category, isBillable, startDate, endDate), cursor pagination, includes matter and client relations
- `getById` — query, includes matter and client
- `delete` — mutation

Register in `src/server/routers/_app.ts` as `expenses: expensesRouter`

### 6. Capture Page — `src/app/(dashboard)/expenses/capture/page.tsx`
This is the main feature page. Use the same layout/wrapper pattern as other dashboard pages.

**Receipt capture zone:**
- Drag-and-drop area for receipt images (dashed border, accepts image/*)
- File picker button
- Camera button using `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` — show live video with capture button, draw frame to canvas on capture, convert to JPEG base64
- Image preview after upload (max-height 300px)
- "Extract with AI" button → calls `trpc.expenses.extractFromReceipt.useMutation()`
- Loading state during extraction: shimmer/skeleton with "Reading receipt..." text

**Expense form (pre-populated by AI, fully editable):**
- Vendor (text, required)
- Amount (number, step 0.01, required)
- Date (date input, default today)
- Tax (number, step 0.01)
- Category (Select dropdown from ExpenseCategory enum with friendly labels)
- Matter (Select dropdown — query from existing matters list procedure)
- Payment Method (button group toggle)
- Description (textarea)
- Billable (Switch toggle)
- Notes (optional, expandable)
- AI confidence badge if extraction was used (green/yellow/red)

**Save flow:**
1. Upload receipt image → get receiptUrl
2. Create expense with all form data + receiptUrl + extractionSource="ai_vision" + extractionRaw
3. Show success toast
4. Reset form for next receipt

**Session log at bottom:**
- Running list of expenses saved in current session (local state)
- Shows vendor, category, matter, amount per row
- Running total

**Client-side image compression:**
- Before sending to Claude, resize to max 1024px on longest edge using canvas
- JPEG quality 0.8

### 7. List Page — `src/app/(dashboard)/expenses/page.tsx`
- Table: Date, Vendor, Category, Matter, Amount, Billable (badge), Receipt (thumbnail or "—")
- Click receipt thumbnail → open in modal/lightbox
- Filter bar: date range, category, matter, billable toggle
- "Capture Receipt" button top-right → links to `/expenses/capture`
- Cursor-based pagination

### 8. Sidebar Navigation
In `src/components/layout/sidebar.tsx`, add to the nav items:
- Icon: Receipt or DollarSign from lucide-react
- Title: "Expenses"
- href: "/expenses"
- Children: "All Expenses" → /expenses, "Capture Receipt" → /expenses/capture

## Important rules:
- Use ONLY existing shadcn components from `src/components/ui/` — do not create custom UI components when shadcn equivalents exist
- Follow the exact tRPC hooks pattern used elsewhere in the app (check `src/lib/trpc.ts`)
- Match the styling, layout wrappers, and page header patterns from other dashboard pages
- Wrap AI extraction in try/catch — if it fails, show toast error and let user fill in manually
- Mobile-responsive — camera capture is primarily for phone use
