# Feature Specification: Publicación en el Apple App Store (Fase 1)

**Feature Branch**: `001-captura-facturas` (rama troncal real del proyecto — cada spec numerado es solo el directorio de la especificación, no define una rama propia)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Fase 1 de publicación en el Apple App Store para Cufeo. Empaquetar apps/web (Vite+React, ya construido y probado) con Capacitor como capa nativa delgada — decisión ya tomada y confirmada con el usuario tras investigar tradeoffs: Capacitor porque reutiliza el 100% del código existente en vez de reescribir la UI en React Native/Expo, dado que es un desarrollador solo manteniendo un monorepo con lógica de dominio ya construida (captura de facturas, validación DIAN, reportes, multi-usuario, 2FA/passkeys). Debe cubrir qué falta para poder enviar la app a revisión de Apple y publicarla: integrar Capacitor en apps/web, agregar al menos una capacidad nativa real (p. ej. notificaciones push o cámara nativa) para evitar el rechazo por Guideline 4.2 'Minimum Functionality', crear la cuenta de Apple Developer Program (bloqueado en el usuario), armar la ficha en App Store Connect, redactar una política de privacidad pública, configurar TestFlight, y confirmar cumplimiento de Guideline 5.1.1(v) de borrado de cuenta (ya existe en specs/008-borrado-cuenta)."

## Clarifications

### Session 2026-10-28

- Q: ¿Cómo empaquetar apps/web para que Apple la acepte como app nativa? → A: Capacitor, no React Native/Expo. Se investigaron los tradeoffs explícitamente: Capacitor reutiliza el 100% del build web existente; React Native/Expo habría significado reescribir toda la UI desde cero, inviable para un solo desarrollador manteniendo un monorepo con años de lógica de dominio ya construida.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instalar y usar Cufeo como app nativa en el iPhone (Priority: P1)

Como usuario, quiero poder instalar Cufeo desde el App Store en mi iPhone y usarla como una app nativa (ícono propio, pantalla de carga, sin barra de navegador visible), para seguir capturando facturas desde la calle igual que hoy hago en la web, pero sin depender de abrir Safari.

**Why this priority**: Es el requisito habilitante de todo lo demás — sin un binario instalable no hay nada que enviar a revisión ni que publicar.

**Independent Test**: Generar un build de Capacitor para iOS a partir del build de apps/web, instalarlo en un dispositivo o simulador vía Xcode, y confirmar que todas las pantallas y flujos actuales (captura, listado, detalle, reportes, cuenta) funcionan igual que en el navegador.

**Acceptance Scenarios**:

1. **Given** el proyecto Capacitor configurado sobre el build de apps/web, **When** se compila e instala en un iPhone, **Then** la app abre con ícono y pantalla de carga propios, sin ninguna barra de navegador visible.
2. **Given** la app instalada, **When** el usuario navega entre las pantallas existentes (captura, listado, detalle, reportes, cuenta), **Then** el comportamiento es idéntico al de la versión web, incluida la sesión ya autenticada.
3. **Given** la app instalada sin conexión a internet, **When** el usuario la abre, **Then** recibe un mensaje claro de falta de conexión en vez de una pantalla en blanco o un error crudo del WebView.

---

### User Story 2 - La app no es indistinguible de abrir una página web (Priority: P1)

Como usuario, quiero que la app tenga al menos una funcionalidad nativa real, para que Apple no la rechace en revisión bajo la Guideline 4.2 ("Minimum Functionality") por ser solo un navegador con otro ícono.

**Why this priority**: Es un motivo de rechazo real y documentado para apps empaquetadas con un WebView — sin esto, no importa qué tan bien funcione el resto, Apple la rebota en la primera revisión.

**Independent Test**: Instalar un build con la capacidad nativa implementada y confirmar que ejerce una funcionalidad verdaderamente nativa del sistema operativo, no solo accesible desde el navegador.

**Acceptance Scenarios**:

1. **Given** el flujo de captura de facturas, **When** el usuario elige tomar una foto, **Then** se abre la cámara nativa del dispositivo (no un selector de archivos genérico del navegador) y la foto sigue el mismo pipeline de carga ya existente.

---

### User Story 3 - El borrado de cuenta sigue cumpliendo la Guideline 5.1.1(v) ya empaquetado (Priority: P1)

Como usuario, quiero poder borrar mi cuenta desde dentro de la app de iPhone exactamente igual que ya puedo hacerlo en la web, para que Apple no rechace la app por falta de borrado de cuenta in-app.

**Why this priority**: Guideline 5.1.1(v) ya se resolvió una vez de fondo en specs/008-borrado-cuenta; el riesgo acá es solo que el empaquetado rompa algo de ese flujo, no reconstruirlo desde cero.

**Independent Test**: Desde la app instalada en un dispositivo, completar el flujo de borrado de cuenta existente de punta a punta y confirmar que el resultado es idéntico al de la versión web.

**Acceptance Scenarios**:

1. **Given** la app instalada con una cuenta de prueba activa, **When** el usuario solicita el borrado desde la configuración de la cuenta, **Then** la cuenta queda inaccesible de inmediato, igual que en la web.
2. **Given** una eliminación programada dentro de los 30 días, **When** el usuario la cancela desde la app instalada, **Then** funciona idéntico a la web y todos los datos quedan intactos.

---

### User Story 4 - Ficha pública lista en App Store Connect (Priority: P2)

Como usuario, quiero tener la ficha de Cufeo lista en App Store Connect (nombre, descripción, categoría, ícono, capturas de pantalla) y una política de privacidad publicada, para poder enviar la app a revisión.

**Why this priority**: Apple no acepta un build para revisión sin esto — es un requisito de envío, independiente de que el código ya funcione.

**Independent Test**: Completar la ficha en App Store Connect hasta el punto en que el botón de enviar a revisión esté disponible, sin llegar a enviarlo todavía.

**Acceptance Scenarios**:

1. **Given** una cuenta de Apple Developer Program activa, **When** se completa la ficha de la app en App Store Connect, **Then** quedan llenos nombre, descripción, categoría, ícono y al menos 3 capturas de pantalla reales de la app.
2. **Given** la ficha en progreso, **When** Apple exige el enlace a una política de privacidad, **Then** existe una URL pública y accesible con una política acorde a los datos reales que Cufeo recolecta (facturas, correo, datos DIAN).

---

### User Story 5 - Validar con TestFlight antes de salir a revisión pública (Priority: P3)

Como usuario, quiero poder instalar una build de prueba de Cufeo vía TestFlight antes de enviarla a revisión pública, para detectar problemas de empaquetado sin arriesgar un rechazo formal.

**Why this priority**: Reduce el riesgo de las historias anteriores con una prueba real en mi propio dispositivo, antes de exponerse al proceso formal de revisión de Apple.

**Independent Test**: Instalar la build desde TestFlight en un iPhone real (no simulador) y repetir los flujos clave (captura, borrado de cuenta, notificación push) de punta a punta.

**Acceptance Scenarios**:

1. **Given** un build subido a App Store Connect, **When** se distribuye por TestFlight, **Then** el usuario puede instalarlo en su iPhone real sin pasar por el App Store público.
2. **Given** el build instalado por TestFlight, **When** el usuario repite los flujos de las Historias 1 a 3, **Then** todos funcionan igual que en el build de desarrollo.

### Edge Cases

- ¿Qué pasa si Apple rechaza igual el build por Guideline 4.2 pese a la cámara nativa agregada? Queda documentado como pendiente para evaluar sumar notificaciones push como segunda capacidad nativa antes de reenviar (ver alternativas descartadas en research.md).
- ¿Qué pasa si el usuario abre la app por primera vez sin conexión, antes de tener cualquier sesión cacheada? Debe ver un mensaje claro de falta de conexión, no una pantalla en blanco.
- ¿Qué pasa si se usa desde un iPad en vez de un iPhone? Fuera de alcance explícito de esta fase (ver Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST empaquetar `apps/web` mediante Capacitor como una app instalable para iOS, reutilizando el build web existente sin reescribir la interfaz.
- **FR-002**: La app empaquetada MUST ofrecer al menos una capacidad nativa real (notificaciones push o cámara nativa) para no resultar indistinguible de una página web abierta en el navegador (Guideline 4.2).
- **FR-003**: El flujo de borrado de cuenta ya existente (specs/008-borrado-cuenta) MUST seguir cumpliendo la Guideline 5.1.1(v) de Apple cuando se ejecuta desde dentro de la app empaquetada.
- **FR-004**: El sistema MUST contar con una política de privacidad pública, accesible por URL, antes de enviar la app a revisión.
- **FR-005**: La ficha en App Store Connect MUST incluir nombre, descripción, categoría, ícono y capturas de pantalla reales de la app antes de enviarla a revisión.
- **FR-006**: El usuario MUST poder instalar un build de prueba vía TestFlight antes de que la app se envíe a revisión pública.
- **FR-007**: La app empaquetada MUST mostrar un mensaje claro cuando no hay conexión a internet, en vez de una pantalla en blanco o un error crudo del WebView.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede instalar Cufeo en su iPhone desde el App Store y completar la captura de una factura de punta a punta sin encontrar ninguna diferencia funcional respecto a la versión web.
- **SC-002**: El primer build enviado a revisión de Apple no es rechazado por la Guideline 4.2 (Minimum Functionality).
- **SC-003**: El primer build enviado a revisión de Apple no es rechazado por la Guideline 5.1.1(v) (borrado de cuenta).
- **SC-004**: La app queda publicada y descargable desde el App Store sin superar el techo de costo de infraestructura de <25 USD/mes de la constitution v2.2.0, más allá de la cuota anual de Apple Developer Program ya contemplada ahí.

## Assumptions

- Se asume que el usuario (único, personal) va a usar la app principalmente en iPhone, no en iPad — el diseño responsive ya existente de `apps/web` no se optimiza especialmente para pantallas grandes en esta fase.
- Se asume que Android / Google Play queda fuera de alcance de esta fase. Capacitor deja la puerta abierta para agregarlo después reutilizando el mismo empaquetado, pero no es parte de este spec.
- Se asume que la capacidad nativa elegida para cumplir la Guideline 4.2 (FR-002) es cámara nativa, no notificaciones push: no agrega ningún secreto, servicio de terceros ni tabla nueva, y reutiliza directamente el flujo de captura de facturas ya existente — solo cambia el origen del archivo. Push notifications queda descartado para esta fase por la complejidad que introduce sin necesidad (ver research.md); se puede reconsiderar después si una revisión real de Apple exige una segunda capacidad nativa.
- Depende de specs/008-borrado-cuenta (ya implementado) para que el borrado de cuenta funcione dentro de la app empaquetada sin cambios adicionales de fondo.
- La creación y el pago de la cuenta de Apple Developer Program los hace el usuario directamente — no es algo que el sistema o el código puedan automatizar.
