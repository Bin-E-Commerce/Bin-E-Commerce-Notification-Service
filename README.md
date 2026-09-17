<div align="center">
  <img src="https://raw.githubusercontent.com/Bin-E-Commerce/Bin-E-Commerce-UI-Web/main/public/images/logo/logo_background_white.png" alt="Bin E-Commerce" width="220" />

  # Notification Service

  Make every important order, seller, shipment, and account event reach the right person at the right time.

  <p>
    <img src="https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white" alt="NestJS" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
    <img src="https://img.shields.io/badge/Kafka-231F20?logo=apachekafka&logoColor=white" alt="Kafka" />
    <img src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white" alt="Redis" />
    <img src="https://img.shields.io/badge/Nodemailer--SMTP-2F2F2F?logo=minutemailer&logoColor=white" alt="SMTP with Nodemailer" />
  </p>

  [Portfolio](https://daongocanh.site)
</div>

---

## Table of contents

1. [Problem](#1-problem)
2. [Service at a glance](#2-service-at-a-glance)
3. [Responsibility and boundaries](#3-responsibility-and-boundaries)
4. [Architecture](#4-architecture)
5. [Trust and runtime guarantees](#5-trust-and-runtime-guarantees)
6. [Installation](#6-installation)
7. [See it work](#7-see-it-work)
8. [Notification lifecycle](#8-notification-lifecycle)
9. [Audience and authorization](#9-audience-and-authorization)
10. [Kafka event consumers](#10-kafka-event-consumers)
11. [Notification policies](#11-notification-policies)
12. [Persistence model](#12-persistence-model)
13. [REST API](#13-rest-api)
14. [Read and unread behavior](#14-read-and-unread-behavior)
15. [Realtime delivery](#15-realtime-delivery)
16. [Email delivery](#16-email-delivery)
17. [Idempotency and failure isolation](#17-idempotency-and-failure-isolation)
18. [Project structure](#18-project-structure)
19. [Configuration](#19-configuration)
20. [Local development](#20-local-development)
21. [Testing](#21-testing)
22. [Security and privacy](#22-security-and-privacy)
23. [Operations](#23-operations)
24. [Known design decisions](#24-known-design-decisions)
25. [FAQ](#25-faq)
26. [Ownership](#26-ownership)

---

## 1. Problem

Several parts of an e-commerce workflow need to notify users:

- an order is created or cancelled;
- a shipment changes status;
- a return request moves through its lifecycle;
- a seller receives a new review;
- a seller application is submitted, approved, or rejected;
- a shop profile change request needs attention;
- Auth Service needs to deliver a one-time password by email.

Putting notification work inside the source transaction makes those workflows slower and more fragile. A temporary SMTP, Redis, or email-lookup failure should not roll back an order, shipment, review, or seller decision.

Notification Service separates these concerns:

1. domain services publish events through Kafka;
2. this service converts supported events into notification policies;
3. in-app notifications are persisted in MongoDB;
4. a best-effort Redis signal updates connected clients quickly;
5. transactional email is rendered and sent independently.

The result is a durable notification feed without making the source business operation depend on the availability of email infrastructure.

---

## 2. Service at a glance

| Property | Value |
| --- | --- |
| Runtime | Node.js with NestJS 11 |
| Language | TypeScript |
| HTTP port | 3005 by default |
| HTTP prefix | /api |
| API version | /v1 |
| Event transport | Kafka |
| Primary persistence | MongoDB with Mongoose |
| Realtime signal | Redis Pub/Sub |
| Email transport | SMTP through Nodemailer |
| Internal dependency | Auth Service email lookup |
| Consumer group | notification-service by default |
| Health endpoint | GET /api/v1/health |
| Local API documentation | GET /docs |
| Source of truth | MongoDB notification documents |

### What this service provides

- a user-scoped notification feed;
- cursor pagination;
- filtering by read state and category;
- unread totals grouped by category and badge key;
- mark-one-read and mark-all-read operations;
- audience filtering for users, roles, permissions, and broadcast messages;
- event-driven email templates for supported workflows;
- idempotent event handling based on eventId;
- Redis notification-created signals for realtime consumers;
- health information for MongoDB, Kafka configuration, SMTP, and memory.

### What this service does not provide

- business-order state or shipment state;
- authentication or token validation;
- product, seller, or review ownership decisions;
- direct browser access to Kafka, Redis, SMTP, or Auth Service;
- a replacement for the source service event log;
- a guarantee that SMTP delivery is immediate or successful.

---

## 3. Responsibility and boundaries

### Owned by Notification Service

- notification policy mapping;
- notification audience records;
- notification feed read model;
- viewer-specific read receipts;
- notification expiration;
- email template selection and rendering;
- publishing notification-created events to Redis;
- consumption of supported Kafka events;
- notification-specific health reporting.

### Owned by other services

| Concern | Owning service |
| --- | --- |
| User identity and authentication | Auth Service |
| User email lookup | Auth Service |
| Order lifecycle | Order Service |
| Shipping lifecycle | Shipping Service |
| Product and catalog data | Product and Catalog services |
| Seller application and shop changes | Seller Service |
| Review lifecycle | Review Service |
| Client-facing authentication and routing | API Gateway |
| User interface and Redis subscription | Web application / API Gateway |

Notification Service receives trusted event contracts and does not recalculate domain truth. Its job is to translate an event into a safe, useful representation for the recipient.

---

## 4. Architecture

~~~text
+-------------------+       Kafka events       +-------------------------+
| Order Service     | -----------------------> |                         |
| Shipping Service  |                          |  Kafka consumers        |
| Seller Service    | -----------------------> |  and notification       |
| Review Service    |                          |  policies               |
| Auth Service      | -----------------------> |                         |
+-------------------+                          +------------+------------+
                                                           |
                                                           v
                                               +-----------+-----------+
                                               | Notification Service  |
                                               |                       |
                                               |  MongoDB persistence  |
                                               |  Redis publisher      |
                                               |  Email templates      |
                                               +-----+-------------+---+
                                                     |             |
                                                     v             v
                                             +-------+----+   +----+------+
                                             | MongoDB    |   | SMTP      |
                                             | feed/read  |   | provider  |
                                             | receipts   |   | email     |
                                             +------------+   +-----------+

API Gateway ---------------- HTTP ----------------> Notification Service
API Gateway / realtime layer <--- Redis Pub/Sub --- Notification Service
Notification Service -------- internal HTTP ------> Auth Service
~~~

### Request path

~~~text
Browser
  -> API Gateway authenticates the request
  -> Gateway forwards x-user-id, x-user-roles, x-user-permissions
  -> Notification Service builds a viewer context
  -> MongoDB applies the audience filter
  -> Service returns only fields safe for the notification center
~~~

### Event path

~~~text
Domain event
  -> Kafka consumer receives the event
  -> Policy builds one or more audience-specific notifications
  -> MongoDB create uses eventId uniqueness
  -> New notification publishes a Redis signal
  -> Consumer optionally resolves recipient email
  -> Email template is rendered and sent through SMTP
~~~

---

## 5. Trust and runtime guarantees

### Durable in-app delivery

MongoDB is the source of truth for the notification feed. If Redis is unavailable, the next REST request can still load the notification from MongoDB.

### Audience isolation

Every read operation is scoped to the authenticated viewer. The client cannot choose another user ID through a query parameter. The service reads identity only from trusted headers forwarded by API Gateway.

### Duplicate protection

The notification document has a unique eventId index. Kafka redelivery therefore becomes an idempotent no-op instead of creating a duplicate feed item.

Notification receipts also have a unique pair of notificationId and userId. Repeating mark-read is safe.

### Expiration

Notifications have expiresAt and MongoDB removes expired feed documents through a TTL index. Expiration of a notification does not remove the original order, shipment, review, seller, or authentication event.

### Failure isolation

- MongoDB failure prevents durable notification creation and should be visible through health and logs.
- Redis failure loses the immediate signal, but does not remove the MongoDB record.
- Auth Service email lookup failure can leave the in-app notification available.
- SMTP failure is logged independently and does not make an already-created in-app notification disappear.
- A recipient failure does not prevent another recipient from receiving their own notification.

---

## 6. Installation

### Prerequisites

Install or have access to:

- Node.js compatible with the monorepo;
- pnpm, npm, or the package manager used by the repository;
- MongoDB;
- Kafka;
- Redis;
- an SMTP account for email testing;
- Auth Service if testing user email lookup;
- the shared packages used by this monorepo.

### Install dependencies

From the repository root:

~~~bash
pnpm install
~~~

If this repository is configured for npm, use the equivalent repository command rather than mixing lockfiles.

### Configure the service

Create a local environment file:

~~~powershell
Copy-Item .env.example .env
~~~

Update at least:

- MONGODB_URI;
- KAFKA_BROKERS;
- AUTH_SERVICE_URL;
- INTERNAL_SERVICE_TOKEN;
- REDIS_HOST and REDIS_PORT;
- SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD;
- WEB_BASE_URL.

Do not commit .env files or real SMTP and internal service credentials.

### Start the service

From services/notification-service:

~~~bash
pnpm dev
~~~

The service starts:

- HTTP server on http://localhost:3005;
- versioned routes below http://localhost:3005/api/v1;
- Swagger UI on http://localhost:3005/docs outside production;
- Kafka consumers using KAFKA_GROUP_ID.

---

## 7. See it work

### Check health

~~~bash
curl http://localhost:3005/api/v1/health
~~~

A healthy local response includes:

~~~json
{
  "status": "ok",
  "service": "notification-service",
  "environment": "development",
  "checks": {
    "http": { "status": "ok" },
    "kafka": { "status": "configured" },
    "mongodb": { "status": "up" },
    "smtp": { "status": "configured" }
  }
}
~~~

The exact response also includes version, timestamps, broker configuration, MongoDB connection information, SMTP host and port, and memory usage.

### Read the current viewer feed

The service expects API Gateway to supply the authenticated viewer headers:

~~~bash
curl "http://localhost:3005/api/v1/notifications?status=all&limit=20" -H "x-user-id: user-123" -H "x-user-roles: customer" -H "x-user-permissions:"
~~~

Example response shape:

~~~json
{
  "data": {
    "items": [
      {
        "id": "65f000000000000000000001",
        "category": "order",
        "type": "ORDER_CREATED",
        "title": "Order received",
        "message": "Your order has been created.",
        "actionUrl": "/orders/order-123",
        "badgeKey": null,
        "priority": "normal",
        "createdAt": "2026-09-16T08:00:00.000Z",
        "readAt": null
      }
    ],
    "nextCursor": null
  },
  "message": "Lấy danh sách thông báo thành công.",
  "statusCode": 200
}
~~~

For a realistic end-to-end test, publish one of the supported domain events through the repository Kafka tooling, then call the feed again with the matching user identity.

### Get unread counts

~~~bash
curl http://localhost:3005/api/v1/notifications/unread-counts -H "x-user-id: user-123" -H "x-user-roles: customer"
~~~

The response contains total, byCategory, and byBadgeKey so a notification bell and multiple navigation badges can share one request.

### Mark a notification read

~~~bash
curl -X PATCH http://localhost:3005/api/v1/notifications/65f000000000000000000001/read -H "x-user-id: user-123"
~~~

### Mark all notifications read

~~~bash
curl -X POST http://localhost:3005/api/v1/notifications/read-all -H "Content-Type: application/json" -H "x-user-id: user-123" -d "{\"category\":\"order\"}"
~~~

---

## 8. Notification lifecycle

1. A domain service commits a business change.
2. The domain service publishes a versioned event to Kafka.
3. A matching consumer receives the event.
4. The relevant policy builds title, message, action URL, audience, category, priority, entity, metadata, and expiration.
5. Notification Service creates the MongoDB document.
6. A duplicate eventId returns the existing notification and stops duplicate delivery.
7. A newly-created document is published to the Redis realtime channel.
8. Consumers that support email resolve the recipient email through Auth Service.
9. The corresponding email template is rendered and passed to Nodemailer.
10. The frontend reads or marks the notification through the versioned REST API.

The source business transaction is complete before this asynchronous workflow begins. Notification work must not be used to decide whether the original domain mutation succeeds.

---

## 9. Audience and authorization

Notifications can target:

- one user;
- a role;
- a permission;
- every authenticated viewer through broadcast;
- multiple audience records at the same time.

A viewer is built from:

- x-user-id;
- x-user-roles;
- x-user-permissions.

The audience service translates these values into a MongoDB filter. A notification is returned when at least one audience entry matches the viewer.

### Gateway trust boundary

API Gateway is responsible for authenticating the request and injecting trusted identity headers. Notification Service is responsible for applying those headers to its own data filter.

A browser must not be allowed to set arbitrary identity headers directly against a publicly exposed Notification Service. In production, expose the service through the gateway or enforce an equivalent trusted-network boundary.

The response intentionally omits audiences and internal metadata. The notification center receives only the fields it needs to render the item and navigate the user.

---

## 10. Kafka event consumers

| Consumer | Events handled | Main result |
| --- | --- | --- |
| OtpConsumer | notification.otp.requested | Sends an OTP email |
| OrderConsumer | order.created, order.cancelled | Creates customer and seller notifications; sends supported order emails |
| ShipmentConsumer | shipment.status.updated | Creates customer and seller notifications; sends shipment status emails |
| ReturnConsumer | return lifecycle events | Creates return notifications and supported return emails |
| ReviewConsumer | review.created, review.updated | Notifies the seller about review activity |
| SellerApplicationConsumer | application submitted, approved, rejected | Notifies the relevant seller and administrative audience |
| ShopProfileChangeRequestConsumer | request requested, approved, rejected | Notifies the relevant shop or administrative audience |

The event names are imported from shared common contracts. This service should not define a second, locally-drifting copy of those names.

### Kafka processing rule

Consumers should persist the notification before performing optional email work. This ordering ensures that a missing email address or SMTP outage does not erase the durable in-app signal.

---

## 11. Notification policies

Policies keep event-specific decisions out of consumers. Each policy translates a domain event into a notification input.

A policy can determine:

- notification category;
- notification type;
- title and message;
- action URL;
- badge key;
- priority;
- audience records;
- entity type and entity ID;
- safe metadata;
- expiration time.

### Order policy

Order events can produce different messages for the customer and seller. The customer follows the order, while the seller needs an operational view of the affected order or shop context.

### Shipment policy

A shipment status update is mapped independently for customer and seller. A seller email failure must not stop the customer notification path.

### Return policy

Return states are translated into seller-facing operational notifications, including requested, approved, rejected, cancelled, in-transit, received, and inspection outcomes.

### Review policy

Review creation and update events produce seller notifications so the seller can follow new or changed customer feedback.

### Seller application policy

Application submission, approval, and rejection are routed to the audiences that need to act or understand the decision. Permission-based administrative audiences are handled through the common audience model.

### Shop profile change policy

A requested, approved, or rejected shop profile change is routed to the relevant seller or administrative audience with a suitable action URL and expiration.

### Policy tests

Policy unit tests cover the mapping of event names and payloads to notification inputs. They are intentionally separate from MongoDB and Kafka so message wording, audience rules, and expiration logic can be validated quickly.

---

## 12. Persistence model

### notifications collection

| Field | Purpose |
| --- | --- |
| eventId | Unique idempotency key from the source event |
| eventName | Original event contract name |
| eventVersion | Contract version |
| source | Producing service |
| category | Notification category |
| type | Domain-specific notification type |
| audiences | User, role, permission, or broadcast targets |
| title | Short notification title |
| message | Notification center message |
| actionUrl | Optional frontend destination |
| badgeKey | Optional navigation badge grouping |
| priority | Rendering and attention hint |
| entityType | Referenced domain entity type |
| entityId | Referenced domain entity ID |
| metadata | Structured non-sensitive context |
| occurredAt | Time of the source event |
| expiresAt | Feed retention deadline |
| createdAt / updatedAt | Persistence timestamps |

Indexes include:

- unique eventId;
- category;
- type;
- badgeKey;
- entityId;
- expiration TTL on expiresAt;
- audience and creation-time lookup for feed queries.

### notification_receipts collection

Receipts store viewer-specific state separately from the shared notification:

| Field | Purpose |
| --- | --- |
| notificationId | Referenced notification |
| userId | Viewer who owns the receipt |
| seenAt | When the viewer saw the item |
| readAt | When the viewer marked it read |
| createdAt / updatedAt | Receipt timestamps |

The unique notificationId and userId index makes mark-read idempotent and prevents one user's read state from changing another user's view.

---

## 13. REST API

All routes below are served below /api/v1 when URI versioning is enabled.

### GET /notifications

Returns the authenticated viewer's notification feed.

Query parameters:

| Parameter | Values | Meaning |
| --- | --- | --- |
| status | all, unread, read | Read-state filter |
| category | supported notification category | Category filter |
| cursor | opaque base64url value | Continue from the previous page |
| limit | 1 to 50, default 20 | Page size |

The response includes items and nextCursor. The cursor is opaque to clients and must be sent back unchanged.

### GET /notifications/unread-counts

Returns:

~~~json
{
  "total": 4,
  "byCategory": {
    "order": 2,
    "shipment": 1
  },
  "byBadgeKey": {
    "seller-orders": 2
  }
}
~~~

### PATCH /notifications/:id/read

Creates or updates the current viewer's receipt for one notification. Calling the endpoint repeatedly is safe.

### POST /notifications/read-all

Marks matching notifications as read. Optional body fields:

~~~json
{
  "category": "order",
  "badgeKey": "seller-orders"
}
~~~

If no filter is supplied, all accessible notifications are marked read.

### Response envelope

Notification endpoints return the service's standard envelope:

~~~json
{
  "data": {},
  "message": "Human-readable result message.",
  "statusCode": 200
}
~~~

Validation rejects unknown fields, invalid enums, invalid limits, malformed IDs, and malformed cursors.

---

## 14. Read and unread behavior

Read state belongs to the viewer, not to the shared notification document.

This means:

- two users can see the same broadcast notification with different read states;
- one seller reading a notification does not mark it read for another seller;
- unread counts are calculated for the current viewer only;
- category and badge filters can be used independently;
- a malformed cursor returns a client error rather than silently restarting at page one.

Feed queries join the current viewer's receipt in MongoDB before applying read-state filtering. The service does not expose another viewer's receipt data.

---

## 15. Realtime delivery

After MongoDB persistence succeeds, Notification Service publishes a notification-created message to the configured Redis channel.

The realtime message contains:

- event name;
- matching audiences;
- safe notification display fields;
- creation timestamp;
- action URL and badge key when present.

Redis is an acceleration path, not the durable store:

- Redis subscribers can update a bell or notification drawer immediately;
- a Redis outage is logged;
- REST remains able to recover the durable feed from MongoDB;
- the publisher never includes SMTP credentials, internal tokens, or private persistence fields.

The channel constant is shared through the common notification contract so publishers and subscribers use the same name.

---

## 16. Email delivery

Email delivery uses Nodemailer with SMTP configuration.

Current template families include:

- OTP;
- order created and cancelled;
- shipment status;
- return status;
- seller application submitted, approved, and rejected;
- shared email layout and branding.

For user-based emails, the service can resolve the address through:

~~~text
GET {AUTH_SERVICE_URL}/api/v1/internal/users/{userId}/email
x-internal-service-token: configured internal token
~~~

The lookup has a timeout. A missing or unavailable address does not remove the in-app notification.

### Email rendering rules

- templates are selected by workflow rather than by arbitrary client input;
- URLs come from configured WEB_BASE_URL and event-derived identifiers;
- notification metadata is not automatically copied into email HTML;
- credentials and internal headers never appear in templates;
- email failures are logged with enough context for diagnosis but should not log OTP values or credentials.

---

## 17. Idempotency and failure isolation

### Event redelivery

Kafka may deliver an event more than once. MongoDB's unique eventId index is the idempotency boundary.

The consumer flow is:

~~~text
create notification
  -> if created: publish realtime and perform optional email
  -> if duplicate: return existing notification and skip email
~~~

This prevents both duplicate in-app items and duplicate emails for consumers that use the create result.

### Independent recipients

When an event targets customer and seller audiences, each recipient path is processed independently. A failure resolving one email address should not block the other recipient's notification.

### Retry expectations

Kafka delivery and service-level retry behavior are owned by the event infrastructure. Notification policies must remain deterministic so replaying a valid event produces the same notification shape and expiration rules.

### Expiration and replay

Expiration is calculated from the source event time where the policy requires it. Replaying an old event must not extend a notification's useful lifetime indefinitely.

---

## 18. Project structure

~~~text
services/notification-service/
+-- src/
|   +-- main.ts
|   +-- app.module.ts
|   +-- integrations/
|   |   +-- auth-user-email.client.ts
|   +-- infrastructure/
|   |   +-- redis/
|   |       +-- redis.module.ts
|   +-- kafka/
|   |   +-- consumers/
|   |       +-- order.consumer.ts
|   |       +-- otp.consumer.ts
|   |       +-- return.consumer.ts
|   |       +-- review.consumer.ts
|   |       +-- shipment.consumer.ts
|   |       +-- seller-application.consumer.ts
|   |       +-- shop-profile-change-request.consumer.ts
|   +-- modules/
|       +-- email/
|       |   +-- application/
|       |       +-- services/
|       |       +-- templates/
|       |       +-- types/
|       |       +-- utils/
|       +-- health/
|       |   +-- health.controller.ts
|       |   +-- health.module.ts
|       +-- notifications/
|           +-- application/
|           |   +-- policies/
|           |   +-- services/
|           |   +-- types/
|           +-- infrastructure/
|           |   +-- schemas/
|           +-- presentation/
|               +-- controllers/
|               +-- dto/
+-- .env.example
+-- package.json
+-- tsconfig.json
+-- README.md
~~~

### Organization rules

- consumers adapt Kafka messages into application calls;
- policies own event-to-notification decisions;
- application services own persistence, audience filtering, realtime publishing, and viewer context;
- schemas own MongoDB persistence shape and indexes;
- controllers own HTTP input/output boundaries;
- email templates remain separate from notification feed persistence.

---

## 19. Configuration

The complete starter configuration is in .env.example.

| Variable | Required | Purpose |
| --- | --- | --- |
| NODE_ENV | No | Runtime environment |
| PORT | No | HTTP port, default 3005 |
| APP_VERSION | No | Version reported by health |
| MONGODB_URI | Yes | Notification MongoDB database |
| KAFKA_BROKERS | Yes | Comma-separated Kafka brokers |
| KAFKA_GROUP_ID | No | Kafka consumer group |
| AUTH_SERVICE_URL | Yes for user emails | Auth Service base URL |
| INTERNAL_SERVICE_TOKEN | Yes for internal lookup | Service-to-service credential |
| REDIS_HOST | Yes for realtime | Redis host |
| REDIS_PORT | No | Redis port, default 6379 |
| REDIS_PASSWORD | No | Redis password |
| REDIS_DB | No | Redis logical database |
| SMTP_HOST | Yes for email | SMTP server |
| SMTP_PORT | No | SMTP port, default 587 |
| SMTP_USER | Yes for email | SMTP username |
| SMTP_PASSWORD | Yes for email | SMTP password or app password |
| SMTP_FROM | Yes for email | Sender address |
| WEB_BASE_URL | Yes for links | Frontend base URL |
| EMAIL_LOGO_PATH | No | Email logo asset path |

### Configuration ownership

Runtime infrastructure settings belong in environment configuration and deployment secrets. Domain notification behavior belongs in source policies and shared event contracts. Do not move credentials into source code or event payloads.

---

## 20. Local development

### Useful commands

~~~bash
pnpm dev
pnpm build
pnpm type-check
pnpm lint
pnpm test
~~~

### Development workflow

1. Start MongoDB, Kafka, Redis, and an SMTP test server.
2. Copy .env.example to .env and set local endpoints.
3. Start Auth Service if testing recipient email lookup.
4. Start Notification Service in watch mode.
5. Verify GET /api/v1/health.
6. Produce a supported Kafka event.
7. Confirm the notification document in MongoDB.
8. Call the feed endpoint with the matching trusted viewer headers.
9. Confirm unread counts and mark-read behavior.
10. Inspect Redis and SMTP logs when testing realtime or email delivery.

### API documentation

Swagger is enabled when NODE_ENV is not production:

~~~text
http://localhost:3005/docs
~~~

The OpenAPI document describes the HTTP controller surface. Kafka event contracts remain defined in the shared common package and source service contracts.

---

## 21. Testing

### Unit tests

Policy tests should verify:

- event name to notification type mapping;
- customer and seller audience differences;
- title, message, action URL, and badge key;
- priority and expiration;
- unsupported event behavior;
- safe metadata selection.

Service tests should verify:

- duplicate eventId handling;
- audience filtering;
- unread count grouping;
- cursor pagination;
- malformed ObjectId and cursor errors;
- mark-read idempotency;
- mark-all filters;
- Redis failure isolation.

### Integration tests

Use real or test instances of MongoDB, Kafka, Redis, and an SMTP capture server when verifying:

- event consumption;
- persistence and indexes;
- Redis publication after successful persistence;
- email lookup and delivery;
- consumer-group behavior;
- recovery after dependency reconnect.

### Manual acceptance checklist

- health reports MongoDB and SMTP configuration correctly;
- an event creates exactly one notification;
- Kafka redelivery does not duplicate the notification;
- the correct user, seller, role, or permission can see the item;
- an unrelated viewer cannot see it;
- unread counts change after mark-read;
- Redis failure does not remove REST visibility;
- email failure does not remove in-app visibility;
- expired notifications are eventually removed by MongoDB TTL cleanup.

---

## 22. Security and privacy

- trust identity headers only from API Gateway or an equivalent private boundary;
- never accept userId as a client-controlled query parameter for feed access;
- keep internal service tokens in deployment secrets;
- use a least-privilege MongoDB user in non-local environments;
- use TLS for MongoDB, Kafka, Redis, Auth Service, and SMTP where supported;
- do not expose Redis or Kafka publicly;
- do not log OTP values, SMTP passwords, internal tokens, or full private event payloads;
- return only presentation fields to the browser;
- keep metadata minimal and avoid copying sensitive domain records into notifications;
- use HTTPS for action URLs in production;
- rate-limit HTTP requests using the configured NestJS throttler;
- rotate SMTP and internal service credentials according to the deployment policy.

---

## 23. Operations

### Health interpretation

The health endpoint reports:

- HTTP process status;
- Kafka broker configuration;
- MongoDB connection state;
- SMTP credential configuration;
- process uptime and memory usage.

The overall status is degraded when MongoDB is not up or SMTP credentials are missing. SMTP may be intentionally disabled in some environments, so deployment health policy should distinguish email-disabled environments from accidental credential loss.

### Logs

Useful log dimensions include:

- consumer name;
- event name and event ID;
- notification ID;
- recipient role;
- source service;
- email delivery outcome;
- Redis publication outcome.

Never add secret values to structured logs.

### Metrics to add at deployment level

Track:

- events consumed by type;
- notification creation success and duplicate rate;
- MongoDB write latency;
- unread query latency;
- Redis publish failures;
- Auth Service email lookup latency and failures;
- SMTP send success, failure, and latency;
- notification expiration volume;
- Kafka consumer lag.

### Scaling

The service can run multiple instances when they share:

- the same Kafka consumer group;
- the same MongoDB notification database;
- the same Redis deployment;
- compatible event contract versions.

Kafka distributes event processing across instances. MongoDB uniqueness remains the final duplicate protection boundary.

---

## 24. Known design decisions

### MongoDB is the feed source of truth

Redis is used for a fast signal, not as the notification database. This keeps the feed recoverable after a subscriber restart or transient Redis outage.

### Read receipts are separate documents

A shared notification can target multiple viewers. Keeping read state in notification_receipts prevents one viewer's action from mutating everyone else's state.

### Policies are explicit

Notification wording, audience, expiry, and navigation are business decisions. Keeping them in named policy classes makes those decisions testable and reviewable.

### Event-driven delivery is asynchronous

The source service does not wait for SMTP. This protects order, shipment, seller, and review workflows from an unrelated email provider outage.

### Versioned shared contracts are authoritative

Kafka event names and payload types come from the common package. Consumers should be updated together with contract changes rather than silently accepting incompatible shapes.

---

## 25. FAQ

### Why is my notification visible in MongoDB but not immediately in the browser?

Realtime delivery uses Redis as an acceleration path. Check the Redis connection and subscriber, then call the REST feed. The persisted document should still be available.

### Why did a Kafka retry not create a second item?

The eventId is unique in MongoDB. The service treats the second delivery as already processed and skips duplicate email work.

### Why can a seller see a notification but a customer cannot?

Audience policy is explicit per event and recipient role. Inspect the policy and the trusted viewer roles or permissions forwarded by API Gateway.

### Why does health show degraded when the API responds?

Health also checks MongoDB state and SMTP credentials. The HTTP process can be reachable while one dependency is down or incompletely configured.

### Can the browser call this service directly?

In local development it can be useful for diagnosis, but production access should go through API Gateway so authentication and trusted viewer headers cannot be forged.

### Does deleting an expired notification delete the order or shipment?

No. MongoDB TTL only removes the notification feed document. The source domain service owns the business record.

### Why is the email not sent even though the in-app item exists?

The in-app write and email path are intentionally separated. Check Auth Service email lookup, SMTP configuration, and consumer logs.

---

## 26. Ownership

### Engineering

**Đào Ngọc Anh**

**Software Engineer**

[View portfolio](https://daongocanh.site)

Software Engineer responsible for the architecture, implementation, integration, and maintenance of this service.

### Architecture and API design

**Đào Ngọc Anh**

Designed the event boundary, notification policies, audience filtering, persistence strategy, realtime signal, email integration, and API surface for the Bin E-Commerce ecosystem.
