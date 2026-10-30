<!--
SYNC IMPACT REPORT
==================
Version change: 2.2.0 → 2.2.1
Bump rationale: PATCH — cambio de nombre del producto (MyIvo → Cufeo), decidido por
el usuario (disponibilidad real de dominio verificada para "Cufeo" en .co/.app; la
mayoría de nombres candidatos ya tenían el .com ocupado). Es redacción/branding, no
una redefinición de ningún principio ni de la governance — ninguna garantía,
obligación ni umbral cambia de contenido.

Principios modificados: ninguno en sustancia. Todas las menciones literales de
"MyIvo" en el cuerpo del documento (ninguna fuera del título) pasan a "Cufeo".

Alcance del rename fuera de esta constitution (para que quede trazado en un solo
lugar): nombre visible en la UI, bundle ID de iOS (`com.myivo.app` → `com.cufeo.app`,
capacitor.config.ts + Info.plist + project.pbxproj), issuer de 2FA TOTP (visible en
apps autenticadoras), asuntos de los correos de aviso de seguridad, README.md,
política de privacidad, y las menciones en specs/002, specs/007, specs/008,
specs/009. Deliberadamente SIN tocar: el namespace interno de paquetes pnpm
(`@myivo/domain`, `@myivo/api`, `@myivo/web`) ni los nombres de variables de entorno
(p. ej. `MYIVO_BACKUP_ENCRYPTION_KEY`) — son identificadores técnicos internos, no
branding de cara al usuario, y renombrarlos exigiría que el usuario también
actualizara su propio `.env` ya configurado; no fue parte de lo pedido.

Principios sin cambios: I-VIII — ninguno depende del nombre del producto.

Secciones añadidas: ninguna. Secciones removidas: ninguna.

Plantillas dependientes: sin impacto — ninguna cita el nombre del producto.

TODOs diferidos: ninguno.
-->

# Cufeo Constitution

Sistema personal de gestión de facturas físicas fotografiadas, orientado a producir
soporte confiable para la declaración de renta en Colombia.

## Core Principles

### I. Inmutabilidad de la Evidencia

La imagen original de cada factura es evidencia probatoria y es inmutable.

- El archivo original NUNCA se modifica, sobrescribe ni elimina por procesos automáticos.
- Toda transformación (compresión, recorte, corrección de perspectiva, normalización de
  formato) MUST producir un archivo derivado nuevo, con vínculo explícito al original.
- Eliminar una factura es un soft-delete iniciado explícitamente por el usuario: el
  registro se marca, los archivos permanecen recuperables.
- El sistema MUST poder devolver, para cualquier registro, el byte-stream original tal
  como fue ingresado.
- **Excepción única y acotada — borrado de cuenta**: cuando el titular de una cuenta
  solicita explícitamente eliminarla por completo (no una factura individual, que sigue
  rigiéndose por la regla de soft-delete de arriba sin excepción), el sistema MUST ofrecer
  una ventana de reversión de 30 días calendario desde la solicitud, durante la cual los
  archivos originales permanecen intactos y recuperables. Vencida esa ventana sin que el
  titular haya revertido el borrado, un proceso automatizado MUST destruir físicamente los
  archivos originales y derivados de esa cuenta, de forma irreversible. Fuera de esta única
  circunstancia, la regla general ("nunca por procesos automáticos") sigue rigiendo sin
  excepción.

**Rationale**: Ante una revisión de la DIAN el original es la única prueba admisible.
Cualquier pérdida o alteración silenciosa destruye el valor completo del sistema. La única
excepción deliberada es la voluntad expresa de su propio titular de eliminar su cuenta por
completo: ahí el derecho del usuario sobre sus propios datos (habeas data, y el requisito de
borrado real de App Store Review Guideline 5.1.1(v)) pesa más que la garantía probatoria. La
ventana de 30 días existe precisamente para que un error humano —pedir el borrado por
accidente— no se vuelva irreversible por accidente también.

### II. Exactitud Monetaria

El dinero es exacto o no es.

- Todo valor monetario MUST almacenarse como entero en centavos, o como `numeric` en base
  de datos. Usar `float`/`double` para dinero está PROHIBIDO en cualquier capa: dominio,
  persistencia, API, UI y reportes.
- La moneda es un campo explícito en todo valor monetario, nunca implícita. El default
  es COP.
- Los totales calculados (subtotal + IVA + propina + otros conceptos) MUST cuadrar contra
  el total extraído. Si no cuadran, el registro pasa al estado `needs_review`.
- "Corregir" silenciosamente un descuadre está PROHIBIDO.

**Rationale**: Un centavo perdido por redondeo binario invalida el soporte tributario, y
un descuadre corregido en silencio esconde precisamente el error que hay que revisar.

### III. Desconfianza por Defecto en la Extracción por IA

Todo output de un LLM o de un servicio de OCR es una hipótesis, no un dato.

- Todo output de un proveedor MUST validarse contra un schema estricto (Zod) ANTES de
  persistirse en el modelo de dominio.
- El JSON crudo del proveedor MUST guardarse junto al registro normalizado, con versión
  del prompt y del modelo, para permitir reprocesamiento futuro.
- Un fallo de extracción NUNCA bloquea la ingesta: la foto se guarda y el registro queda
  en `extraction_failed`, disponible para reintento.
- El CUFE se obtiene por decodificación determinística del código QR. Obtenerlo por OCR
  del CUFE impreso solo se acepta como fallback, y MUST quedar marcado con confianza menor.

**Rationale**: La extracción es probabilística; el modelo de dominio no. La frontera entre
ambos es el schema. Guardar el crudo permite corregir el pasado cuando mejore el modelo.

### IV. Clasificación Tributaria Explícita y Versionada

La consecuencia tributaria es siempre derivada y trazable, nunca escrita a mano.

- Todo documento MUST clasificarse en un tipo explícito: `factura_electronica`,
  `documento_equivalente_pos`, `documento_soporte`, `otro`, `desconocido`.
- La elegibilidad para beneficios tributarios (p. ej. la deducción del 1%, art. 336 ET)
  es un CÁLCULO DERIVADO a partir de reglas versionadas por año gravable. Editarla a mano
  sin trazabilidad está PROHIBIDO.
- Las reglas tributarias MUST implementarse como funciones puras del dominio, con tests
  unitarios obligatorios, y cada regla MUST citar su fuente normativa en un comentario.
- El sistema informa y organiza; NO emite conceptos tributarios. Todo reporte MUST incluir
  la nota de que debe ser revisado por el usuario o su contador.

**Rationale**: Las reglas cambian por año gravable. Versionarlas permite recalcular años
anteriores sin reescribir la historia, y la cita normativa hace auditable cada decisión.

### V. Arquitectura Hexagonal

El dominio no conoce el mundo exterior.

- El dominio MUST NOT importar NestJS, Prisma/TypeORM, ni SDKs de proveedores.
- Los proveedores de extracción (LLM/OCR) y de validación DIAN viven detrás de puertos
  (`InvoiceExtractor`, `DianValidator`) con adaptadores intercambiables.
- Monorepo pnpm + Turborepo. TypeScript en modo estricto en todos los paquetes.

**Rationale**: Los proveedores de IA cambian de API, precio y calidad con frecuencia. Un
dominio aislado permite cambiarlos sin tocar las reglas tributarias ni migrar datos.

### VI. Validación DIAN sin Trampas

La validación es asistida y respeta los términos del portal de la DIAN.

- Cualquier mecanismo de evasión de captcha, o automatización que viole los términos del
  portal de la DIAN, está PROHIBIDO.
- La validación de CUFE es asistida: el sistema prepara el enlace de consulta con el CUFE
  precargado y el usuario confirma el resultado; o se concilia contra documentos que el
  propio usuario descargó desde su portal DIAN.
- Todo resultado de validación MUST guardar: fecha de consulta, método (manual /
  conciliación) y snapshot de los metadatos observados.

**Rationale**: Un sistema de soporte tributario construido sobre accesos indebidos es un
riesgo legal mayor que el problema que resuelve.

### VII. Privacidad y Soberanía Operativa

Los datos son de cada usuario, y viven donde quien opera la instancia decide.

- Imágenes, montos y hábitos de consumo son datos sensibles: MUST vivir únicamente en
  infraestructura controlada por quien opera la instancia. Telemetría a terceros: cero.
- El sistema MUST admitir una o varias cuentas de usuario en la misma instancia
  autoalojada. Los datos de una cuenta MUST ser completamente invisibles para
  cualquier otra cuenta del mismo sistema, sin excepción — aislamiento total a nivel
  de datos y de consulta, no solo de interfaz. Una fuga entre cuentas es tan grave
  como una fuga a un tercero externo.
- Los secretos NUNCA se versionan. La configuración va por variables de entorno, con
  validación al arranque que falla rápido si falta o es inválida.
- El sistema completo MUST levantar con `docker compose up` en un VPS pequeño, sin
  importar cuántas cuentas use. Costo operativo objetivo: menos de 25 USD/mes de
  infraestructura (incluye la cuota de Apple Developer Program amortizada, 99
  USD/año ≈ 8.25 USD/mes), más el consumo de LLM (que escala con el uso total de
  todas las cuentas, no es un costo fijo por cuenta).
- Toda acción que cambie cómo alguien accede a su propia cuenta (activar/desactivar
  2FA, agregar/eliminar un passkey, cambiar la contraseña) o que la afecte de forma
  irreversible (todo el ciclo de borrado de cuenta del Principio I: programar,
  cancelar, purgar) MUST generar un correo de aviso al titular — es la única señal
  que tiene si alguien distinto a él hizo el cambio.

**Rationale**: El historial de facturas es un perfil de consumo completo de una persona.
El modelo de privacidad defendible es que los datos nunca salgan de la infraestructura
que su dueño controla — eso ya no exige que la instancia sirva a una sola persona, exige
que cada cuenta dentro de ella esté completamente aislada de las demás.

### VIII. Calidad Verificable

Se testea lo que puede estar mal de forma silenciosa.

- Las reglas de dominio —tributarias, de cuadre monetario, de clasificación— MUST tener
  tests unitarios. La cobertura de infraestructura es pragmática, no dogmática.
- Los estados del pipeline de una factura MUST formar una máquina de estados explícita y
  documentada. Ninguna transición ocurre fuera de ella.

**Rationale**: Un bug en una regla tributaria no se manifiesta como un crash: produce un
número plausible y equivocado. Solo un test lo detecta.

## Máquina de Estados del Documento

Los estados y transiciones del pipeline MUST estar definidos en un único lugar del dominio
y documentados en los artefactos de diseño de la feature correspondiente.

- El conjunto de estados MUST incluir al menos `needs_review` (Principio II) y
  `extraction_failed` (Principio III).
- Toda transición MUST ejecutarse a través de la máquina de estados. Mutar el estado
  directamente desde un servicio, controlador o repositorio está PROHIBIDO.
- Toda transición MUST registrar: estado origen, estado destino, disparador (usuario o
  proceso) y timestamp.
- Las transiciones no definidas MUST fallar de forma explícita, nunca degradar a un estado
  por defecto.

## Flujo de Desarrollo y Puertas de Calidad

- **Puerta de spec** (`/speckit-specify`): los requisitos que tocan dinero, evidencia o
  clasificación tributaria se expresan como requisitos funcionales verificables, no como
  descripciones generales.
- **Puerta de plan** (`/speckit-plan`): la sección "Constitution Check" MUST evaluarse
  contra los ocho principios antes de Phase 0 y de nuevo tras Phase 1. Toda violación va a
  "Complexity Tracking" con su justificación y la alternativa más simple descartada; una
  violación sin justificación escrita bloquea el plan.
- **Puerta de tasks** (`/speckit-tasks`): toda regla de dominio nueva genera su tarea de
  test unitario en la misma fase que su implementación.
- **Puerta de implementación** (`/speckit-implement`): ningún cambio se da por terminado
  con tests de dominio en rojo.

## Governance

Esta constitution supersede cualquier otra práctica del proyecto. Ante conflicto entre un
principio y una conveniencia de implementación, gana el principio o se enmienda la
constitution — no hay tercera vía.

**Enmiendas**: se realizan mediante `/speckit-constitution`, que MUST actualizar este
archivo, incrementar la versión y regenerar el Sync Impact Report. Toda enmienda documenta
qué cambió y por qué.

**Versionado semántico**:

- MAJOR — remoción o redefinición incompatible de un principio o de la governance.
- MINOR — nuevo principio o sección, o expansión material de una guía existente.
- PATCH — aclaraciones, redacción, correcciones no semánticas.

**Cumplimiento**: toda revisión de código y todo `Constitution Check` en un plan MUST
verificar el cumplimiento de los ocho principios. La complejidad se justifica o se elimina.

**Guía de runtime**: cuando existan, `README.md` y `docs/quickstart.md` MUST enlazar este
documento como fuente de autoridad y MUST NOT duplicar sus reglas, para evitar divergencia.

**Version**: 2.2.1 | **Ratified**: 2026-07-25 | **Last Amended**: 2026-10-30
