# Feature boundaries

Each feature owns its validation, authorization policies, query services, mutation services, persistence repositories, presentation models, and feature-local components. The permitted dependency direction is:

`app → feature service/query → feature authorization + repository → db`

Cross-feature calls go through a feature's exported application service, never through its repository. React components do not import `src/db`. Route handlers and Server Actions remain thin adapters around application services.
