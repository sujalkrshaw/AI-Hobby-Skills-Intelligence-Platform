# Architecture

## Core flow

Browser -> React/Vite -> FastAPI REST API -> PostgreSQL
                                   |-> MinIO/S3-compatible storage
                                   |-> local AI/ML service
                                   |-> public Stack Overflow API ingestion

## Security boundaries

- Passwords are Argon2-hashed.
- JWTs are signed with an environment-provided secret.
- Every private endpoint resolves the user from the bearer token.
- Skill, goal and practice queries are scoped to the authenticated user.
- Uploads enforce content type and 5 MB size limits.
- No cloud credentials are committed to Git.

## AI architecture

The default AI layer is deliberately reproducible:
- analytics service calculates explainable user metrics;
- recommendation engine converts those metrics into coaching actions;
- scikit-learn LinearRegression estimates next-week practice volume when enough history exists.

This makes the AI behavior testable and does not make the application dependent on a paid LLM provider.
