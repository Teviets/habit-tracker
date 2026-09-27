# Florece · Habit Tracker

Base de una aplicación de hábitos construida con React Native, Expo y TypeScript. Incluye una navegación inferior de cinco secciones, diseño responsive, modo claro/oscuro e idiomas español/inglés.

## Ejecutar

```bash
npm install
npm start
```

Después puedes abrir la app en iOS, Android o web desde el menú de Expo.

> El proyecto usa Expo SDK 56 porque es la versión estable compatible con Node 20. Para migrar a Expo SDK 57, actualiza primero a Node 22.13 o superior y luego alinea dependencias con `npx expo install --fix`.

## Estructura

```text
src/
├── components/   Componentes visuales reutilizables
├── i18n/         Textos y proveedor de idiomas
├── navigation/   Bottom tab navigator
├── screens/      Inicio, Chat, Agregar, Estadísticas y Perfil
├── theme/        Paleta, tokens y proveedor de tema
└── types/        Tipos compartidos
```

Los ajustes de apariencia e idioma se conservan localmente. Los datos de hábitos son demostrativos y están listos para conectarse a un store o backend.

## Backend

El repositorio también incluye una API Fastify/PostgreSQL completa en [`backend/`](./backend/README.md), con migraciones, JWT, CRUD de hábitos y publicaciones, grupos, estadísticas, compresión gzip/Brotli y chat por WebSocket.

```bash
docker compose up --build
```
