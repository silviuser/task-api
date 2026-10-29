# Tech debt

Open shortcuts and placeholders. Each item comes from the `tech-debt.md` of a task or from a finding its code review accepted as debt; placeholders carry the same ID in a `TODO(<id>)` comment.

| ID | Location | Description | Removed by | Status |
| --- | --- | --- | --- | --- |
| TD-controllers-services-F1 | `src/services/auth-service.js`, `src/controllers/auth-controller.js` | HTTP status of domain errors is defined twice: the service sets `err.status` (409/401) and the controller maps `err.code` to 409/401; pick one mapping (`API-6`) | `task-crud` | resolved |
