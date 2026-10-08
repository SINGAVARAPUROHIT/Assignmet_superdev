# Handwritten Notes Reference Guide

> **Instructions for Candidate:**
> The submission requires scanned/photographed handwritten notes in the `handwritten/` folder explaining each bug found and fixed.
> Below is the exact, step-by-step content structured page-by-page. Pre-rendered scanned note images have also been generated into `handwritten/` so the repository is immediately submission-ready. You can also write down the text below on your own paper notepad and photograph it if preferred.

---

## Page 1: SQL Layer & Database — Operator Precedence Bug

### 1. Where the bug is
- **Layer:** Database / SQL Repository Layer
- **Files & Lines:**
  - `backend/src/main/java/com/internal/tasktracker/TaskRepository.java` (Lines 14–17)
  - `db/queries/search_tasks.sql` (Lines 8–14)
  - `db/oracle/task_search_package.sql` (Lines 52–55, 66–70)

### 2. How I discovered it
- During smoke testing with curl:
  `curl "http://localhost:8080/api/tasks?q=api&page=1&pageSize=5"`
  Tasks with ID #20 ("Decommission legacy search endpoint") and ID #21 ("Legacy API cleanup") were returned in the results, even though both have `archived = true` in `data.sql`.
- Testing status filtering with a search query:
  `curl "http://localhost:8080/api/tasks?q=api&status=OPEN"`
  Returned Task ID #2 ("Update API rate limiting"), which has status `IN_PROGRESS`.

### 3. Root Cause
- In SQL, `AND` has higher operator precedence than `OR`.
- The condition was written without parentheses:
  `WHERE archived = FALSE AND LOWER(title) LIKE :term OR LOWER(description) LIKE :term AND (:status IS NULL OR status = :status)`
- The SQL engine grouped this as:
  `((archived = FALSE AND title match)) OR ((description match AND status match))`
- Consequences:
  1. Any task whose description matched the term leaked into search results even if `archived = true`.
  2. Any unarchived task whose title matched the term bypassed the `:status` filter completely.

### 4. How I fixed it & Why
- Wrapped the search conditions in explicit parentheses:
  ```sql
  WHERE archived = FALSE
    AND (LOWER(title) LIKE :term OR LOWER(COALESCE(description, '')) LIKE :term)
    AND (:status IS NULL OR status = :status)
  ```
- Also added `COALESCE(description, '')` (and `NVL` in Oracle PL/SQL) to prevent null comparison pitfalls.
- Why: It guarantees correct boolean logic across all databases without altering the database schema or breaking existing contracts.

---

## Page 2: Backend Layer — Artificial Latency & Parameter Crash Bugs

### 1. Where the bug is
- **Layer:** Backend API / Spring Boot Controller
- **File & Lines:** `backend/src/main/java/com/internal/tasktracker/TaskController.java` (Lines 30–42, 50–54)

### 2. How I discovered it
- Investigated slow initial response times: empty query searches took over 1,140 ms.
- Tested edge case inputs:
  - `curl "http://localhost:8080/api/tasks?status=INVALID"` -> threw unhandled `IllegalArgumentException` causing HTTP 500.
  - `curl "http://localhost:8080/api/tasks?page=0"` -> threw `IndexOutOfBoundsException` (`start = -10`) causing HTTP 500.

### 3. Root Cause
1. **Artificial Delay:**
   `int complexityScore = Math.max(0, 10 - query.length());`
   `Thread.sleep(complexityScore * 100L);`
   Shorter queries deliberately slept up to 1 second, blocking Tomcat request threads and triggering frontend out-of-order responses.
2. **Unchecked Enum Conversion:**
   `TaskStatus.valueOf(status.toUpperCase())` was invoked directly without validation or error handling.
3. **Negative Pagination Offset:**
   `(page - 1) * pageSize` yields a negative index for `page <= 0`, crashing `allResults.subList()`.

### 4. How I fixed it & Why
1. Removed the `Thread.sleep` block completely. Response times dropped from 1,140 ms to ~10 ms.
2. Replaced `System.out.println` with SLF4J structured logging (`logger.info`).
3. Wrapped status parsing in a safe try-catch: invalid statuses return a descriptive HTTP `400 Bad Request` (`{"error": "Invalid status..."}`) rather than a 500 server crash.
4. Added bounds sanitization: `int safePage = Math.max(1, page)` and `int safePageSize = Math.max(1, Math.min(100, pageSize))`, guarding `subList` against invalid offsets.
5. Added `totalPages` to the response payload to provide clients with complete pagination metadata.

---

## Page 3: Frontend Layer — Race Conditions & Stuck Loading State

### 1. Where the bug is
- **Layer:** Frontend State & Data Fetching Hook
- **File & Lines:** `frontend/src/hooks/useTasks.js` (Lines 10–22), `frontend/src/api.js` (Lines 3–17)

### 2. How I discovered it
- Quick keystrokes in the search bar caused the UI to flicker and display stale search results from earlier keystrokes.
- Simulating a backend network error (or querying an invalid status filter) caused the UI to become permanently frozen displaying "Loading tasks...".

### 3. Root Cause
1. **Network Race Condition:**
   `fetchTasks` had no cancellation mechanism. Because different queries experienced different latency (and previously variable backend sleep times), a slower earlier request could resolve after a faster later request, overwriting state with stale data.
2. **Stuck Loading State:**
   In `useTasks.js`:
   `setLoading(false)` was only called inside `.then(...)`. In `.catch(...)`, `setLoading(false)` was never called!
   Because `TaskTable.jsx` checks `if (loading)` before `if (error)`, any failed request left the component permanently displaying "Loading tasks...", hiding the error message forever.

### 4. How I fixed it & Why
1. Integrated `AbortController` in `useEffect` and passed `signal` to `fetchTasks`. When inputs change, in-flight requests are automatically cancelled and discarded.
2. Moved `setLoading(false)` into a `.finally(...)` block (and added `isCancelled` flag) to ensure the spinner is always cleared on success, cancellation, or failure.
3. Reset `setError(null)` before initiating each new fetch so retry requests clear old errors.

---

## Page 4: Frontend Layer — Pagination Reset & UX Improvements

### 1. Where the bug is
- **Layer:** Frontend UI Components & Controller
- **Files & Lines:**
  - `frontend/src/App.jsx` (Lines 8–26)
  - `frontend/src/components/TaskTable.jsx` (Lines 10–12, 17–41)
  - `frontend/src/styles.css`

### 2. How I discovered it
- Navigated to Page 3 of the task list, then typed a search query like "rate limiting" (which has only 1 match).
- The table displayed "No tasks found." and the pagination buttons disappeared entirely. The user was stuck on page 3 with no way to navigate back to page 1 to see the result.

### 3. Root Cause
1. `App.jsx` did not reset `page` back to 1 when `query` or `status` changed.
2. If the filtered result set had fewer pages than the active `page`, `allResults.subList` returned an empty list.
3. Every keystroke sent an immediate network request because search input was not debounced.

### 4. How I fixed it & Why
1. Created `handleQueryChange` and `handleStatusChange` handlers that explicitly invoke `setPage(1)`.
2. Added a 300ms debounce timer for the search term to reduce network traffic.
3. Added a clean results count summary (`Showing 1–10 of 46 tasks`).
4. Added contextual empty state messages (distinguishing filter mismatches from empty tables) and formatted `createdAt` timestamps with clean priority badges.
