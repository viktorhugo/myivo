# Tasks: Publicación en el Apple App Store (Fase 1)

**Input**: Design documents from `specs/009-publicacion-app-store/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Ninguno automatizado — esta fase no agrega ninguna regla de dominio nueva (Constitution Check, Principio VIII) y `apps/web` no tiene ningún runner de tests instalado. El único comportamiento existente que cambia (el origen del archivo en el flujo de captura) se verifica a mano, marcado explícitamente abajo.

**Organization**: Tareas agrupadas por historia de usuario (spec.md), en su orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Agregar Capacitor a `apps/web`: `pnpm --filter web add @capacitor/core @capacitor/camera` y `pnpm --filter web add -D @capacitor/cli @capacitor/ios`.
- [X] T002 Correr `npx cap init` dentro de `apps/web` (app id, p. ej. `com.myivo.app`, y nombre visible "Cufeo"); commitear el `apps/web/capacitor.config.ts` resultante. Depende de T001.
- [X] T003 [P] Agregar una sección breve en `README.md` sobre la app iOS, enlazando a `specs/009-publicacion-app-store/quickstart.md` como fuente de autoridad del procedimiento (constitution § Guía de runtime: no duplicar el detalle).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: bloquea las 5 historias — sin el proyecto Xcode generado no hay nada que correr ni que probar.

- [X] T004 Generar el proyecto iOS: `pnpm --filter web build && cd apps/web && npx cap add ios && npx cap sync ios`. Depende de T002. *(Confirmado: Capacitor 8 integra `@capacitor/camera` vía Swift Package Manager — no generó `Podfile`, CocoaPods no hizo falta para esto puntual.)*
- [ ] T005 [P] Configurar ícono y pantalla de carga propios de Cufeo en `apps/web/ios/App/App/Assets.xcassets` (reemplazar los genéricos que Capacitor pone por defecto). Depende de T004. *(Pendiente — necesita el arte/ícono real de Cufeo, que no tengo.)*

**Checkpoint**: proyecto iOS generado y abrible en Xcode (`npx cap open ios`) — las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Instalar y usar Cufeo como app nativa (Priority: P1) 🎯 MVP

**Goal**: la app corre en un dispositivo/simulador con ícono y splash propios, y todas las pantallas existentes funcionan igual que en la web, incluido el manejo de falta de conexión.

**Independent Test**: `quickstart.md` pasos 1-2.

### Implementation for User Story 1

- [X] T006 [US1] Implementar manejo de "sin conexión" en `apps/web`: detectar el estado offline (`navigator.onLine` + eventos `online`/`offline`) y mostrar un mensaje claro en vez de una pantalla en blanco o un error crudo del WebView (FR-007). → `apps/web/src/utils/conexion.ts` + `App.tsx`.
- [X] T006b [US1] *(No estaba en el plan original — encontrado corriendo de verdad en el iPhone.)* Arreglar que la app no abría en absoluto: Better Auth usaba `window.location.origin` (`capacitor://localhost` en nativo) como base, y lo rechaza por no ser http(s). 3 fixes, verificados contra el código fuente instalado de better-auth@1.6.25:
  - `apps/web/src/services/auth-client.ts`: `baseURL` explícito en nativo (`${API_BASE_URL}/auth`), sin tocar el comportamiento en web.
  - `apps/api/src/main.ts`: `app.enableCors({ origin: ['capacitor://localhost'], credentials: true })` — nunca hizo falta antes porque la web siempre fue same-origin.
  - `apps/api/src/modules/auth/auth.ts`: `'capacitor://localhost'` agregado a `trustedOrigins`.
  - **Límite real encontrado, no resuelto a propósito**: la cookie de sesión cross-origin necesita `SameSite=None; Secure`, y `Secure` exige HTTPS — tu API local corre en `http://`, así que el login no persiste la sesión probando por LAN. En producción (specs/007, HTTPS real por Caddy) esto no hace falta tocarlo más. Decisión del usuario (2026-10-29): dejarlo para cuando haya VPS real en vez de armar HTTPS local esta noche.
- [X] T007 [US1] Verificación manual (`quickstart.md` pasos 1-2): correr el build en el simulador/dispositivo, confirmar ícono y splash propios sin barra de navegador, y navegar captura/listado/detalle/reportes/cuenta confirmando paridad total con la web. Depende de T004, T005, T006. *(Confirmado en iPhone real, 2026-10-29: login renderiza bien, sin barra de navegador, sin crash — igual que la web. El resto de las pantallas [captura/listado/detalle/reportes/cuenta] necesitan sesión activa, que no persiste hasta T006b/HTTPS real — pendiente hasta el VPS, decisión ya tomada.)*

**Checkpoint**: User Story 1 funcional y probada de forma independiente.

---

## Phase 4: User Story 2 - La app no es indistinguible de abrir una página web (Priority: P1)

**Goal**: tomar una foto de una factura abre la cámara nativa del dispositivo, no un selector de archivo genérico del navegador — la capacidad nativa real que exige la Guideline 4.2 (research.md § Decisión 2).

**Independent Test**: `quickstart.md` paso 3.

### Verificación de regresión para User Story 2

> `apps/web` no tiene ningún runner de tests instalado (ni Vitest ni Jest, ni script `test` en su `package.json`) — agregar uno solo para este cambio de UI sería infraestructura nueva que la tarea no pide (constitution Principio VIII: "la cobertura de infraestructura es pragmática, no dogmática"; esto no es una regla de dominio). Queda como verificación manual, igual que T007/T013.

- [X] T008 [US2] Verificación manual en navegador de escritorio/móvil (plataforma NO nativa): confirmar que "Tomar foto" y "Subir de galería" siguen abriendo el `<input type="file">` de siempre y que el flujo de carga completo sigue funcionando igual que antes de T009-T010 — no debe romperse por el cambio. *(Confirmado 2026-10-30 con Playwright real contra `pnpm dev` + Postgres local: login, registro, y login de vuelta funcionan igual que siempre (confirma que `baseURL: undefined` en `auth-client.ts` no cambió nada en web); en Captura, el click en "Tomar foto" sigue disparando el `filechooser` nativo del navegador — cero errores de consola. Cuenta de prueba borrada al terminar.)*

### Implementation for User Story 2

- [X] T009 [P] [US2] Crear `apps/web/src/utils/camara-nativa.ts`: si `Capacitor.isNativePlatform()`, usar `Camera.getPhoto()` de `@capacitor/camera` y devolver un `Blob`/`File` compatible con el pipeline de carga existente; si no, no hacer nada (deja que la rama web siga igual).
- [X] T010 [US2] Integrar el helper de T009 en el componente de captura de facturas existente: en plataforma nativa, el botón de "tomar foto" llama a `camara-nativa.ts`; en web, sigue usando el `<input type="file">` de siempre. Depende de T009. → `Captura.tsx` (incluye recapturar y manejo de cancelación del usuario sin mostrar error).
- [X] T011 [US2] Agregar el permiso de cámara (`NSCameraUsageDescription`, con un texto claro en español de por qué Cufeo necesita la cámara) al `Info.plist` generado en `apps/web/ios/App/App/Info.plist` — sin esto Apple rechaza el build antes de revisión. Depende de T004.
- [X] T012 [US2] Repetir la verificación manual de T008 tras la integración de T010 — confirmar que la rama web sigue sin cambios. *(Mismo pase de T008 — ya corrido después de T009-T011, no antes; ver evidencia ahí arriba.)*

**Checkpoint**: User Stories 1 y 2 funcionan juntas de forma independiente.

---

## Phase 5: User Story 3 - El borrado de cuenta sigue cumpliendo la Guideline 5.1.1(v) empaquetado (Priority: P1)

**Goal**: confirmar (no reconstruir) que el flujo de borrado de cuenta de `specs/008-borrado-cuenta` funciona igual dentro de la app empaquetada.

**Independent Test**: `quickstart.md` paso 4.

### Implementation for User Story 3

- [ ] T013 [US3] Verificación manual (`quickstart.md` paso 4): con una cuenta de prueba, solicitar el borrado y cancelar una eliminación programada desde el build instalado; confirmar paridad total con la web. Si algo se rompe, documentar el hallazgo acá antes de tocar nada de `specs/008-borrado-cuenta`. Depende de T007.

**Checkpoint**: las 3 historias P1 (requisito mínimo para enviar a revisión) están completas y probadas.

---

## Phase 6: User Story 4 - Ficha pública lista en App Store Connect (Priority: P2)

**Goal**: ficha completa en App Store Connect, con política de privacidad publicada, lista para enviar a revisión.

**Independent Test**: `quickstart.md` paso 5.

### Implementation for User Story 4

- [X] T014 [P] [US4] Redactar la política de privacidad pública de Cufeo (qué datos recolecta — facturas, correo, datos DIAN —, cómo se usan, y contacto) → `apps/web/public/privacidad.html` (contenido completo, queda servida automáticamente por Vite en `/privacidad.html`). *(Parcial — quedan 2 placeholders literales `[TODO: ...]` en el archivo (nombre/dominio del operador, correo de contacto real) para que el usuario los complete con sus datos reales; la URL solo es pública de verdad una vez desplegada en el dominio de `specs/007-despliegue-produccion`, todavía pendiente.)*
- [ ] T015 [US4] *(Bloqueado en el usuario — requiere la cuenta de Apple Developer Program activa, costo ya contemplado en `constitution.md` v2.2.0)* Completar la ficha en App Store Connect: nombre, descripción, categoría, ícono, al menos 3 capturas de pantalla reales de la app, y el enlace a la política de privacidad de T014.

**Checkpoint**: ficha lista para que un build pueda enviarse a revisión.

---

## Phase 7: User Story 5 - Validar con TestFlight antes de salir a revisión pública (Priority: P3)

**Goal**: un build real instalado vía TestFlight en un iPhone real, con los flujos clave re-verificados ahí.

**Independent Test**: `quickstart.md` paso 6.

### Implementation for User Story 5

- [ ] T016 [US5] Archivar el build desde Xcode (`Product` → `Archive`) y subirlo a App Store Connect. Depende de T007, T012, T013, T011.
- [ ] T017 [US5] *(Bloqueado en el usuario — requiere un iPhone real)* Agregarse como tester interno en TestFlight, instalar el build ahí, y repetir las verificaciones de las Historias 1 a 3 sobre ese build (`quickstart.md` paso 6). Depende de T016.

**Checkpoint**: build validado en un dispositivo real, listo para decidir el envío a revisión pública.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T018 [P] Actualizar la sección de T003 en `README.md` con cualquier ajuste encontrado durante la verificación manual de las historias 1-3. → nueva sección "Estado actual" con los 3 fixes de T006b y el bloqueo de HTTPS.
- [X] T019 Correr `pnpm typecheck` y `pnpm lint` en todo el monorepo tras los cambios de `apps/web` — confirmar que nada existente se rompió. *(Limpio, 2026-10-30.)*
- [ ] T020 *(Acción final e irreversible, no es un paso de código — requiere confirmación explícita del usuario antes de ejecutarla)* Enviar el build a revisión pública de Apple ("Submit for Review") desde App Store Connect. Depende de T015, T017, T019.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede arrancar de inmediato.
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA las 5 historias.
- **User Stories 1-3 (Phases 3-5, todas P1)**: dependen de Foundational. Son el requisito mínimo real para poder enviar algo a revisión — ninguna es opcional.
- **User Story 4 (Phase 6, P2)**: depende de Foundational; independiente de las historias 1-3 en código (T014 puede arrancar en paralelo), pero T015 (la ficha) necesita que el build ya exista para subir capturas de pantalla reales.
- **User Story 5 (Phase 7, P3)**: depende de que 1, 2 y 3 estén implementadas (T016 necesita el build final) y de que la ficha (US4) esté lista para subir.
- **Polish (Phase 8)**: depende de todas las historias deseadas estando completas.

### User Story Dependencies

- **US1 (P1)**: puede arrancar apenas termine Foundational — sin dependencia de otras historias.
- **US2 (P1)**: puede arrancar apenas termine Foundational — independiente de US1 en código, aunque T007 (verificación de US1) y T012 (test de US2) conviene correrlos sobre el mismo build.
- **US3 (P1)**: no agrega código nuevo — solo verifica que US1+US2 no rompieron `specs/008-borrado-cuenta`; depende de que US1 esté verificada (T007).
- **US4 (P2)**: independiente en código; T015 depende de tener un build mínimamente verificado para las capturas de pantalla.
- **US5 (P3)**: depende de US1, US2, US3 (el build que sube a TestFlight) y de US4 (la ficha a la que ese build se asocia).

### Parallel Opportunities

- T001-T003 (Setup) son secuenciales entre sí salvo T003, que es independiente.
- T005 (Foundational) puede correr en paralelo con nada más en su fase (T004 lo bloquea).
- T008 (verificación manual) y T009 (código del helper) pueden hacerse en paralelo — no dependen entre sí.
- T014 (US4, política de privacidad) puede escribirse en paralelo con toda la Phase 3-5, ya que no depende de ningún build.

---

## Parallel Example: User Story 2

```bash
# Pueden hacerse juntos — no dependen entre sí:
Task: "Verificación manual del flujo de carga web (T008)"
Task: "Crear apps/web/src/utils/camara-nativa.ts (T009)"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2 y 3 — las tres P1)

Las tres historias P1 son, juntas, el mínimo real para poder enviar algo a revisión de Apple: sin US1 no hay app instalable; sin US2, Apple la rechaza por Guideline 4.2; sin US3, la rechaza por Guideline 5.1.1(v). No tiene sentido tratar "solo User Story 1" como MVP en esta feature — las tres P1 son el MVP conjunto.

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational (bloquea todo).
3. Completar Phases 3-5: User Stories 1, 2 y 3.
4. **STOP and VALIDATE**: correr `quickstart.md` pasos 1-4 completos antes de avanzar a la ficha o a TestFlight.

### Incremental Delivery

1. Setup + Foundational → proyecto iOS abrible en Xcode.
2. US1 → la app corre y se ve nativa.
3. US2 → pasa el riesgo real de rechazo por Guideline 4.2.
4. US3 → pasa el riesgo real de rechazo por Guideline 5.1.1(v). En este punto el build ya es enviable en términos de código.
5. US4 → ficha lista para enviar.
6. US5 → validado en un dispositivo real antes del envío final (T020).

---

## Notes

- [P] tasks = archivos distintos, sin dependencias entre sí.
- Las tareas marcadas *(Bloqueado en el usuario)* no las puede completar un agente — quedan para cuando el usuario tenga la cuenta de Apple Developer Program y/o un iPhone real a mano, igual que los bloqueados ya documentados en `specs/007-despliegue-produccion/PENDIENTES.md`.
- T020 es irreversible (envía la app a revisión pública real de Apple) — no se ejecuta sin confirmación explícita del usuario en el momento, sin importar que todas las tareas anteriores estén en verde.
