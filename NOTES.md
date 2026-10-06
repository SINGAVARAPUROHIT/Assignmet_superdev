# NOTES.md

## Summary of Changes
- **SQL Operator Precedence**: Added parentheses around `(LOWER(title) LIKE :term OR LOWER(COALESCE(description, '')) LIKE :term)` across `TaskRepository.java`, `search_tasks.sql`, and `task_search_package.sql`. This ensures `archived = FALSE` and status filters are strictly enforced.
- **Backend Latency & Robustness**: Removed the artificial `Thread.sleep` delay in `TaskController`. Replaced `System.out.println` with SLF4J structured logging. Safely validated the `status` enum (returning 400 Bad Request on invalid input) and guarded against negative pagination offsets. Added `totalPages` to the response metadata.
- **Frontend Race Conditions & Stuck Loading**: Introduced `AbortController` in `useTasks` to cancel stale in-flight requests on input changes and moved `setLoading(false)` into a `finally` block to fix perpetual loading on error.
- **Frontend UX & Pagination**: Implemented 300ms search debouncing, reset pagination to page 1 on search/filter changes, and added formatted timestamps and result counts.

## What I Chose Not to Change
- **In-Memory Sublist Pagination**: The backend still queries all matching rows before slicing. For large production datasets, database-level pagination (`LIMIT`/`OFFSET` or Spring Data `Pageable`) is required; however, keeping the native query signature avoided unnecessary architectural rewrites given the exercise timebox.
- **PL/SQL Package Deployment**: Refactored the PL/SQL queries for correctness while preserving its role as a reference artifact.

## Biggest Remaining Risk
The primary remaining risk is query scalability under high row volumes. Using unindexed `LIKE '%...%'` queries requires full table scans on every search, which will degrade database throughput as data scales into hundreds of thousands of tasks without full-text indexing.

## Tools & AI Used
- Used Gemini for rapid codebase exploration, reproducing SQL precedence anomalies with curl, and drafting the `AbortController` cleanup and debounce logic.
- Validated all fixes manually against the running Spring Boot API and Vite dev server.
