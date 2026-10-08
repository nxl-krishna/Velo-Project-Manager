# Project Management System — Requirements

## 1. Functional Requirements

### 1.1 Authentication & Authorization
*   **FR-01:** Users can register with email and password.
*   **FR-02:** Users can log in; system issues JWT access token (15 min TTL) + refresh token (7 days).
*   **FR-03:** Refresh tokens rotate on use and are stored in Redis.
*   **FR-04:** Role-based access control: Admin > Manager > Member.
*   **FR-05:** Admin can invite users to the platform via email links.
*   **FR-06:** JWT invalidation on logout (blocklist in Redis).
*   **FR-07:** *[Added]* **Email Verification:** Users must verify their email address upon registration.
*   **FR-08:** *[Added]* **Password Recovery:** Users can trigger a "Forgot Password" flow to receive a secure reset link.
*   **FR-09:** *[Added]* **OAuth2 Login:** Support for "Sign in with Google" and "Sign in with GitHub".
*   **FR-10:** *[Added]* **User Profiles:** Users can manage their personal settings, including avatar, timezone, and notification preferences.

### 1.2 Organizations & Teams
*   **FR-11:** A user can create and belong to multiple organizations.
*   **FR-12:** Organizations contain members with roles.
*   **FR-13:** Managers can manage teams within an org.

### 1.3 Projects
*   **FR-14:** Create, read, update, delete (soft delete) projects within an org.
*   **FR-15:** Each project has a name, description, status, start/end dates.
*   **FR-16:** Projects belong to one org and have one owner.
*   **FR-17:** Members can be assigned to projects.

### 1.4 Boards & Sprints
*   **FR-18:** Each project has a Kanban board with customizable columns (Todo, In Progress, Done default).
*   **FR-19:** Sprints can be created with start/end dates; tasks assigned to sprints.
*   **FR-20:** Sprint velocity tracking.

### 1.5 Tasks
*   **FR-21:** CRUD tasks within a project/sprint.
*   **FR-22:** Task fields: title, description, status, priority (low/medium/high/critical), assignee, labels, due date, story points.
*   **FR-23:** Tasks support comments and file attachments.
*   **FR-24:** Task status transitions are tracked (history).
*   **FR-25:** Tasks can be reordered within and across columns (drag-and-drop).
*   **FR-26:** Sub-tasks (parent-child task relationships).
*   **FR-27:** *[Added]* **Time Tracking:** Users can log actual hours spent on a task to compare against story points/estimates.

### 1.6 Global Search, Filters & Activity
*   **FR-28:** *[Added]* **Global Search:** Search functionality across tasks, projects, and comments organization-wide.
*   **FR-29:** *[Added]* **Advanced Filtering:** Board and list views can be filtered by Assignee, Priority, Label, and Due Date.
*   **FR-30:** *[Added]* **Audit Logs (Activity Stream):** Track project-level and org-level administrative actions (e.g., user invitations, role changes, project deletion).

### 1.7 Real-Time, Notifications & Integrations
*   **FR-31:** WebSocket-based real-time board updates.
*   **FR-32:** In-app notification system for mentions, assignments, due-date reminders.
*   **FR-33:** Email notifications via Bull queue (background job).
*   **FR-34:** *[Added]* **Third-Party Integrations:** Webhook support for Slack/Discord notifications and GitHub/GitLab PR linking.

### 1.8 Reporting & Analytics
*   **FR-35:** Project progress dashboards.
*   **FR-36:** Sprint burndown chart data.
*   **FR-37:** Team workload view.

### 1.9 AI Features
*   **FR-38:** AI task summarization — generate concise summary from task description + comments.
*   **FR-39:** Smart task assignment — suggest best-fit assignee based on workload and skill tags.
*   **FR-40:** Deadline prediction — predict likely completion date based on historical sprint data.
*   **FR-41:** Natural language task creation — parse free text into structured task object.
*   **FR-42:** AI sprint planning — recommend which tasks to pull into next sprint.

### 1.10 SaaS & Billing (Optional/Commercial)
*   **FR-43:** *[Added]* **Billing & Tiers:** Integration with Stripe for subscription management (e.g., Free vs. Premium tiers controlling access to AI features).

---

## 2. Non-Functional Requirements (NFRs)
*   **NFR-01:** API response P95 < 200ms (cached endpoints < 50ms).
*   **NFR-02:** AI endpoints P95 < 3s.
*   **NFR-03:** 99.9% uptime SLA target.
*   **NFR-04:** Horizontal scaling — stateless API servers behind load balancer.
*   **NFR-05:** PostgreSQL with read replicas for scaling reads.
*   **NFR-06:** All sensitive data encrypted at rest and in transit (TLS).
*   **NFR-07:** GDPR-compliant: soft delete, data export endpoint.
*   **NFR-08:** Structured JSON logging (level, timestamp, requestId, userId).
*   **NFR-09:** Prometheus metrics exposed at `/metrics`.
*   **NFR-10:** Database migrations versioned via Prisma.
*   **NFR-11:** *[Added]* **File Storage:** Attachments must be stored in secure, scalable object storage (e.g., AWS S3) with presigned URLs for access.

---

## 3. Failure Cases & Edge Cases

### Auth & Security
*   **FC-01:** Expired access token → `401 Unauthorized`, client uses refresh token.
*   **FC-02:** Refresh token reuse after rotation → revoke entire session family (security).
*   **FC-03:** Brute-force login → rate limit 5 attempts / 15 min per IP.
*   **FC-04:** Token in blocklist → `401 Unauthorized`.
*   **FC-05:** *[Added]* **Role Downgrades:** If an Admin downgrades a Manager to Member, the system instantly revokes their team-management privileges.

### Tasks & Data
*   **FC-06:** Concurrent task reorder → last-write-wins with optimistic locking (version field).
*   **FC-07:** Assignee removed from project → tasks unassigned, notification sent.
*   **FC-08:** Sprint closed with incomplete tasks → auto-move to backlog.
*   **FC-09:** *[Added]* **Export Timeout:** If a GDPR data export (NFR-07) takes > 10s, it degrades gracefully to a background job and emails the user a secure download link.

### Infrastructure & External Services
*   **FC-10:** AI provider timeout → retry x2 with exponential backoff, return cached result or graceful degradation.
*   **FC-11:** AI result poison/hallucination → results are suggestions only, user must confirm.
*   **FC-12:** AI service down → main API continues without AI features (circuit breaker).
*   **FC-13:** Email job fails → retry 3x with exponential backoff, dead-letter queue.
*   **FC-14:** Redis down → Bull falls back to in-memory queue (limited), alert fires.
*   **FC-15:** *[Added]* **WebSocket Disconnect:** Frontend automatically attempts to reconnect with exponential backoff and polls the `/sync` API endpoint once reconnected to fetch missed state.
*   **FC-16:** *[Added]* **File Upload Limit:** If a user attempts to attach a file larger than 10MB, reject with `413 Payload Too Large`.
