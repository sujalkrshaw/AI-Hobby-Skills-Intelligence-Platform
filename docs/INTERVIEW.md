# Interview talking points

1. Explain your project. — It is an AI-enabled cloud-style platform that tracks skills, practice sessions and goals, then uses analytics and a local ML model to recommend actions and forecast near-term practice volume.
2. Why FastAPI? — Typed validation, automatic OpenAPI documentation, clean dependency injection and strong Python ecosystem support.
3. Why PostgreSQL? — User, skill, goal, practice and social entities have clear relationships and integrity constraints.
4. Why object storage? — Media is binary content and should not be stored inside relational rows.
5. How is authorization enforced? — JWT identifies the user and every private query applies that user ID as a scope.
6. What makes the AI explainable? — Recommendations expose the reason and the prediction endpoint states the model and confidence limitations.
7. What is real data? — The importer pulls public Stack Overflow API samples for selected skill tags and stores the captured observations.
8. How would you scale it? — Managed PostgreSQL, object storage, CDN, stateless API replicas, caching, queues and background workers.
9. How do you handle failures? — Health checks, timeouts, explicit 4xx/5xx responses and storage/database error boundaries.
10. What would you improve? — Background jobs, refresh-token rotation, Redis caching, richer feature engineering, model monitoring and production observability.
