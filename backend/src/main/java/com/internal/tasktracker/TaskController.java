package com.internal.tasktracker;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class TaskController {

    private static final Logger logger = LoggerFactory.getLogger(TaskController.class);
    private final TaskRepository taskRepository;

    public TaskController(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @GetMapping("/api/tasks")
    public ResponseEntity<?> searchTasks(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "10") int pageSize) {

        // Validate and sanitize pagination bounds
        int safePage = Math.max(1, page);
        int safePageSize = Math.max(1, Math.min(100, pageSize));

        // Normalize query input
        String query = q == null ? "" : q.trim();
        String searchTerm = "%" + query.toLowerCase() + "%";

        // Parse and validate status filter safely (prevent HTTP 500 on invalid enum input)
        String normalizedStatus = null;
        if (status != null && !status.trim().isEmpty()) {
            try {
                normalizedStatus = TaskStatus.valueOf(status.trim().toUpperCase()).name();
            } catch (IllegalArgumentException e) {
                logger.warn("Invalid status filter requested: {}", status);
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Invalid status parameter: '" + status + "'. Allowed values: OPEN, IN_PROGRESS, DONE"
                ));
            }
        }

        // Structured logging replaces System.out.println
        logger.info("Search tasks: q=\"{}\", status={}, page={}, pageSize={}",
                query, normalizedStatus, safePage, safePageSize);

        List<Task> allResults = taskRepository.searchTasks(searchTerm, normalizedStatus);

        int total = allResults.size();
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safePageSize);

        // Safe sublist pagination calculation
        int start = (safePage - 1) * safePageSize;
        int end = Math.min(start + safePageSize, total);
        List<Task> pageResults = (start < total && start >= 0)
                ? allResults.subList(start, end)
                : Collections.emptyList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", pageResults);
        response.put("total", total);
        response.put("page", safePage);
        response.put("pageSize", safePageSize);
        response.put("totalPages", totalPages);

        return ResponseEntity.ok(response);
    }
}
