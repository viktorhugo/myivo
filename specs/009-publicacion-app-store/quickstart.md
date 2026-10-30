# Quickstart: Publicación en el Apple App Store (Fase 1)

Guía de validación de punta a punta. No repite el detalle ya escrito en `research.md`/`data-model.md` — los referencia.

## Prerrequisitos

- Una Mac con Xcode instalado — compilar para iOS exige macOS, no hay alternativa (requisito de Apple, no de este proyecto).
- Node/pnpm ya instalados, igual que el resto del monorepo.
- CocoaPods NO hace falta para esto: Capacitor 8 integra `@capacitor/camera` vía Swift Package Manager (genera `Package.swift`, no `Podfile`) — confirmado al correr `npx cap add ios`/`npx cap sync ios` de verdad. Solo instalarlo si algún otro plugin de terceros lo exige explícitamente más adelante.
- Una cuenta de Apple Developer Program activa (bloqueada en el usuario — ver `specs/007-despliegue-produccion/PENDIENTES.md` y el costo ya contemplado en `constitution.md` v2.2.0).
- Un iPhone real o el simulador de Xcode para probar.

## 1. Agregar Capacitor a `apps/web` (US1)

```bash
pnpm --filter web add @capacitor/core @capacitor/camera
pnpm --filter web add -D @capacitor/cli @capacitor/ios

cd apps/web
npx cap init                 # nombre de la app + app id (p. ej. com.myivo.app)
pnpm build
npx cap add ios
npx cap sync ios
npx cap open ios
```

**Verificación (US1 Acceptance Scenario 1)**: Xcode abre el proyecto generado en `apps/web/ios/`. Corriéndolo en el simulador, Cufeo debe abrir con ícono y pantalla de carga propios, sin ninguna barra de navegador visible.

> Nota: `xcodebuild -scheme App build` desde la terminal (sin abrir Xcode) devuelve "Supported platforms for the buildables in the current scheme is empty" y no encuentra el simulador, aunque el simulador exista (confirmado con `xcrun simctl list devices`). Parece un tema de configuración del scheme generado por Capacitor, no del código de Cufeo — abrir el proyecto en Xcode y correrlo desde ahí (▶) funciona distinto a la build por CLI. No se investigó más a fondo; si hace falta compilar por CLI (p. ej. para CI), hay que resolver esto primero.

## 2. Confirmar que los flujos existentes no cambiaron (US1)

- Loguearse y navegar captura, listado, detalle, reportes y cuenta — debe verse y comportarse igual que en la versión web (US1 Acceptance Scenario 2).
- Apagar la red del dispositivo/simulador y abrir la app — debe mostrar un mensaje claro de falta de conexión, nunca una pantalla en blanco ni un error crudo del WebView (US1 Acceptance Scenario 3, FR-007).

## 3. Verificar la cámara nativa (US2)

- Desde la pantalla de captura de facturas, elegir "tomar foto" — debe abrir la cámara nativa del sistema (no un selector de archivo genérico del navegador), y la foto resultante debe completar el mismo pipeline de carga que ya existe hoy (US2 Acceptance Scenario, FR-002; decisión y alternativas descartadas en `research.md` § Decisión 2).

## 4. Verificar el borrado de cuenta ya empaquetado (US3)

Con una cuenta de prueba (no una real):

1. Solicitar el borrado desde la configuración de la cuenta, dentro de la app instalada — debe quedar inaccesible de inmediato, igual que en la web.
2. Cancelar una eliminación programada dentro de los 30 días — debe funcionar idéntico a la web, con los datos intactos.

(US3 Acceptance Scenarios 1-2, FR-003 — el flujo en sí ya está probado en `specs/008-borrado-cuenta`; esto solo confirma que el empaquetado no lo rompió.)

## 5. Ficha en App Store Connect (US4) — fuera del repo, manual

- Completar nombre, descripción, categoría, ícono y al menos 3 capturas de pantalla reales de la app.
- Publicar la política de privacidad en una URL pública y pegar el enlace en la ficha.

(US4 Acceptance Scenarios 1-2, FR-004, FR-005.)

## 6. TestFlight (US5)

1. Desde Xcode: `Product` → `Archive`, y subir el build a App Store Connect.
2. Agregarse a sí mismo como tester interno e instalar el build en el iPhone real vía TestFlight (no el simulador).
3. Repetir los pasos 2 a 4 de esta guía sobre ese build de TestFlight.

(US5 Acceptance Scenarios 1-2, FR-006.)

## Criterios de éxito que esta guía ejercita

- **SC-001**: pasos 2-4 completos sin ninguna diferencia funcional respecto a la web.
- **SC-002**/**SC-003**: se confirman solo después de un envío real a revisión de Apple — esta guía reduce el riesgo, no lo elimina (ver `spec.md` § Edge Cases).
- **SC-004**: ningún paso de esta guía agrega infraestructura nueva de pago — confirmado por `research.md` § Decisión 2.
