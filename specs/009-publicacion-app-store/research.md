# Research: Publicación en el Apple App Store (Fase 1)

## Decisión 1 — Empaquetado: Capacitor, no React Native/Expo

**Decision**: Empaquetar `apps/web` con Capacitor como capa nativa delgada.

**Rationale**: Ya resuelta y confirmada con el usuario antes de este spec (ver [spec.md § Clarifications](./spec.md#clarifications)). Capacitor reutiliza el 100% del build de Vite existente; no reescribe la UI.

**Alternatives considered**: React Native/Expo — descartado porque exige reescribir toda la interfaz desde cero, inviable para un solo desarrollador manteniendo un monorepo con años de lógica de dominio ya construida en `apps/web`.

## Decisión 2 — Capacidad nativa para la Guideline 4.2: cámara nativa, no push notifications

**Decision**: La capacidad nativa real que exige FR-002 es acceso a la cámara nativa del dispositivo (`@capacitor/camera`) en el flujo de captura de facturas, no notificaciones push.

**Rationale**: El spec original asumía push porque "el backend de avisos ya existe" — una suposición falsa que se corrigió en esta fase de planeamiento: `NotificacionesService` (specs/008 ítem 4) manda **correos** vía Resend, no push. Implementar push de cero exigiría:
- Un secreto nuevo (clave `.p8` de Apple + Key ID + Team ID) para autenticar contra APNs.
- Una tabla nueva (`DeviceToken` o similar) para persistir el token de cada dispositivo.
- Un cliente HTTP/2 nuevo contra la API de APNs de Apple.
- Un endpoint nuevo para que la app registre su token tras pedir permiso.

Cámara nativa, en cambio:
- No agrega ningún secreto, tabla, ni endpoint nuevo en `apps/api`.
- No agrega ningún servicio de terceros nuevo — mantiene "Telemetría a terceros: cero" (Principio VII) sin ninguna ambigüedad, porque no hay ningún tercero de por medio.
- Reutiliza el flujo de captura de facturas que ya existe: solo cambia de dónde viene el archivo (cámara nativa vs. `<input type="file">` del navegador), el resto del pipeline de carga no cambia.
- Satisface igual el criterio real de la Guideline 4.2 (una funcionalidad verdaderamente nativa del sistema operativo, no solo accesible desde el navegador).

**Alternatives considered**:
- **Push vía APNs directo** — descartado por la complejidad nueva de arriba, sin ningún beneficio adicional sobre el mínimo que exige la Guideline 4.2.
- **Push vía Firebase Cloud Messaging** — descartado además por agregar a Google como tercero nuevo, innecesario ya que Android queda fuera de alcance de esta fase (ver spec.md § Assumptions).

Esta decisión queda documentada acá porque corrige una suposición ya escrita en `spec.md`; el spec fue actualizado para reflejarla.

## Decisión 3 — Dónde vive el proyecto Capacitor en el monorepo

**Decision**: El proyecto Capacitor vive dentro de `apps/web/` (`apps/web/capacitor.config.ts` + `apps/web/ios/` generado por `npx cap add ios`), no como un paquete nuevo del monorepo.

**Rationale**: Capacitor empaqueta el build de Vite de `apps/web` tal cual — es la misma app, no un servicio nuevo. Crear un `apps/ios` separado solo agregaría indirección (un paquete pnpm nuevo, scripts de build duplicados) sin ningún beneficio real, y rompería la correspondencia 1:1 entre "la app web" y "la app empaquetada" que Capacitor está pensado para mantener.

**Alternatives considered**: Paquete nuevo `apps/ios-wrapper` en el monorepo — descartado por la indirección innecesaria explicada arriba.

## Decisión 4 — Versión mínima de iOS

**Decision**: iOS 15+.

**Rationale**: Es el mínimo por defecto de las versiones actuales de Capacitor (6.x/7.x) y cubre una proporción abrumadoramente mayoritaria de dispositivos activos reales — no hay ningún requisito del propio Cufeo que exija una versión más nueva.

**Alternatives considered**: Ninguna evaluada en profundidad — es un valor por defecto razonable, no una decisión con tradeoffs reales para este proyecto; se puede subir después sin costo si Capacitor lo exige en una actualización.
