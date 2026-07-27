# Repository Architecture & Template Convention

To maintain consistency across our microservices architecture and ensure seamless context-switching for any team member, **every single microservice repository must strictly adhere to the standardized skeleton structural template outlined below.** When initializing a new microservice, use `gym-<name>-service` as the naming convention and implement this exact directory layout.

---

## 📂 Repository Structural Skeleton

```text
gym-<name>-service/
├── src/
│   ├── index.js                    # entrypoint: bootstraps express, DB, Kafka, routes
│   ├── config/                     # env config, DB connection, Kafka connection
│   │   ├── database.js
│   │   └── kafka.js
│   ├── models/                     # data layer — one file per sub-domain entity
│   │   └── example.model.js
│   ├── views/                      # only if you're server-rendering anything (likely empty/unused for a pure API — most teams skip this folder entirely for APIs, see note below)
│   ├── controllers/                # request handling — calls services, shapes responses
│   │   └── example.controller.js
│   ├── services/                   # business logic — the actual "how", called by controllers
│   │   └── example.service.js
│   ├── routes/                     # maps URLs to controllers
│   │   ├── example.routes.js
│   │   └── index.js                # combines all routers, mounted in index.js
│   ├── events/
│   │   ├── producers/              # one file per event this service publishes
│   │   │   └── sessionBooked.producer.js
│   │   └── consumers/              # one file per event this service subscribes to
│   │       └── paymentSucceeded.consumer.js
│   ├── middleware/                 # auth check, error handler, request validation
│   │   ├── auth.middleware.js
│   │   └── errorHandler.middleware.js
│   └── db/
│       └── migrations/             # schema migrations — this service's OWN tables only
├── tests/
│   ├── unit/
│   └── integration/
├── k8s/
│   ├── deployment.yaml     # Pod configurations, replica limits, and container specs
│   ├── service.yaml        # Service definition mapping internal container ports
│   └── configmap.yaml      # Non-sensitive runtime environment variables for THIS service
├── Jenkinsfile
├── Dockerfile
├── .env.example
└── README.md
