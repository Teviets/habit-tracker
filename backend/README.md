# Florece API

API REST y WebSocket para usuarios, hábitos, rachas, publicaciones, grupos y chat.

## Stack

- Fastify 5 y TypeScript.
- PostgreSQL 17 con Drizzle ORM y migraciones SQL versionadas.
- JWT de acceso y refresh tokens rotatorios almacenados como hash.
- Compresión Brotli, gzip o deflate para respuestas mayores a 1 KB.
- WebSocket con límite de 64 KB, autenticación en el primer mensaje y `permessage-deflate`.
- CORS, headers de seguridad, rate limiting, límites de body y logs con secretos censurados.
- OpenAPI y Swagger UI en `/docs`.

## Inicio rápido con Docker

Desde la raíz del repositorio:

```bash
docker compose up --build
```

Compose espera a PostgreSQL, ejecuta las migraciones y levanta la API en `http://localhost:4000`.

## Desarrollo local

Requiere Node 22.13 o superior y PostgreSQL.

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Comandos útiles:

```bash
npm run typecheck
npm run build
npm run db:generate
npm run db:check
npm run db:studio
```

## Contrato de respuesta

Las respuestas exitosas usan:

```json
{
  "data": {},
  "meta": {}
}
```

Los errores usan:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos."
  },
  "requestId": "req-1"
}
```

## Endpoints iniciales

### Autenticación y usuarios

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/users/me`
- `PATCH /v1/users/me`
- `DELETE /v1/users/me`
- `GET /v1/users/:id`

### Hábitos, registros y rachas

- `GET|POST /v1/habits`
- `GET|PATCH|DELETE /v1/habits/:id`
- `GET /v1/habits/:id/check-ins`
- `PUT|DELETE /v1/habits/:id/check-ins`
- `GET /v1/stats/overview`

### Publicaciones

- `GET|POST /v1/posts`
- `GET|PATCH|DELETE /v1/posts/:id`

### Grupos

- `GET|POST /v1/groups`
- `GET|PATCH|DELETE /v1/groups/:id`
- `POST /v1/groups/:id/join`
- `POST /v1/groups/:id/leave`
- `GET /v1/groups/:id/members`
- `PATCH /v1/groups/:id/members/:userId`

### Chat

- `GET|POST /v1/conversations`
- `GET|POST /v1/conversations/:conversationId/messages`
- `PATCH|DELETE /v1/conversations/:conversationId/messages/:messageId`
- `WS /v1/chat/:conversationId/ws`

Todos los endpoints protegidos usan `Authorization: Bearer <accessToken>`.

## Protocolo WebSocket

El token no se envía en la URL para evitar que termine en logs. Tras conectar, el primer mensaje debe ser:

```json
{ "type": "auth", "token": "<accessToken>" }
```

Después del evento `authenticated`, se pueden enviar:

```json
{ "type": "message", "content": "Hoy mantuve mi racha", "clientId": "uuid-opcional" }
{ "type": "typing", "active": true }
```

`clientId` permite reintentos idempotentes. El hub incluido distribuye mensajes dentro de una instancia. Para escalar horizontalmente, conecta el mismo contrato a Redis Pub/Sub sin cambiar los clientes.

## Migraciones

El esquema fuente está en `src/db/schema.ts`. Para hacer un cambio:

```bash
npm run db:generate
npm run db:check
npm run db:migrate
```

Nunca uses `db:push` en producción; las migraciones de `drizzle/` son la fuente versionada de cambios.
