# Data Model: Captura y Registro Estructurado de Facturas

Entidades derivadas de `spec.md` (Key Entities) y de las reglas de gobernanza de `.specify/memory/constitution.md`. Todos los campos monetarios son enteros en centavos — nunca `float`/`double` (Principio II).

## Factura (Documento de Compra)

Representa una compra respaldada por una imagen capturada.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `estado` | enum: `recibida` \| `procesando` \| `extraída` \| `necesita_revisión` \| `fallida` | Ver máquina de estados abajo. FR-004 |
| `rutaImagenOriginal` | string (ruta de archivo) | Nunca se sobrescribe (Principio I, FR-005) |
| `derivados` | array de `{ ruta, tipoTransformación, creadoEn }` | Cada derivado es un archivo nuevo vinculado al original, nunca lo reemplaza |
| `tipoDocumento` | enum: `factura_electronica` \| `documento_equivalente_pos` \| `documento_soporte` \| `otro` \| `desconocido` | FR-014 |
| `comercioNombre`, `comercioNIT` | string, nullable | Vive como atributo de la factura, sin directorio propio de comercios |
| `fechaHoraCompra` | timestamp, nullable | Nullable si la extracción no pudo leerlo (FR-025) |
| `moneda` | código ISO 4217, default `COP` | Explícita siempre, nunca implícita (FR-026) |
| `subtotal`, `impuestoConsumo`, `propina`, `total` | entero (centavos), nullable | FR-006 |
| `ivaPorTarifa` | array de `{ tarifa, valor (centavos) }` | Desglose de IVA por tarifa (FR-006) |
| `medioPago` | enum: `efectivo` \| `tarjeta_debito` \| `tarjeta_credito` \| `transferencia_pse` \| `billetera_digital`, nullable | Todo excepto `efectivo` cuenta como electrónico (FR-015, clarificación Q1) |
| `adquirienteNombre`, `adquirienteIdentificacion` | string, nullable | FR-006 |
| `cufe` | string, nullable | Único cuando existe |
| `cufeOrigen` | enum: `qr` \| `ocr_respaldo`, nullable | `ocr_respaldo` implica confianza reducida (FR-008) |
| `elegibilidadTributaria` | boolean, nullable | Siempre un valor CALCULADO — nunca editable directamente (FR-016) |
| `elegibilidadMotivo` | string, nullable | Motivo cuando `elegibilidadTributaria = false` (FR-018) |
| `confianzaCampos` | mapa `{ nombreCampo: { valor: 0-1, origen } }` | Un nivel de confianza por campo extraído (FR-009) |
| `eliminadaEn` | timestamp, nullable | Soft-delete explícito del usuario (FR-029) |
| `creadaEn`, `actualizadaEn` | timestamp | |

**Validaciones de dominio**:
- `subtotal + ΣivaPorTarifa + impuestoConsumo + propina` MUST cuadrar con `total`; si no, `estado = necesita_revisión` (FR-010).
- `elegibilidadTributaria` y `elegibilidadMotivo` MUST derivarse siempre de `tipoDocumento` + coincidencia de identificación + `medioPago` — ninguna ruta de código los asigna directamente (FR-016/FR-017).
- `cufe` MUST obtenerse por decodificación de QR salvo cuando `cufeOrigen = ocr_respaldo` (FR-007/FR-008).

## Ítem de Factura

Cada línea de producto o servicio dentro de una factura.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `facturaId` | UUID (FK → Factura) | |
| `descripcion` | string, nullable | |
| `cantidad` | número, nullable | |
| `valorUnitario`, `valorTotal` | entero (centavos), nullable | |
| `nivelConfianza` | 0-1 | |

## Corrección Manual

Registro de un campo editado por el usuario, diferenciado del valor extraído (FR-011/FR-012).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `facturaId` | UUID (FK → Factura) | |
| `campo` | string | Nombre del campo corregido (p. ej. `medioPago`, `total`) |
| `valorExtraidoOriginal` | string (serializado) | Conserva el valor tal como fue extraído |
| `valorCorregido` | string (serializado) | |
| `corregidoEn` | timestamp | |

**Regla**: si `campo` alimenta el cálculo de elegibilidad (`tipoDocumento`, `adquirienteIdentificacion`, `medioPago`), guardar la corrección MUST disparar el recálculo de `elegibilidadTributaria`/`elegibilidadMotivo` (FR-017).

## Marca de Posible Duplicado

Relación entre dos facturas que el sistema considera la misma compra.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `facturaOriginalId`, `facturaCandidataId` | UUID (FK → Factura) | |
| `metodoDeteccion` | enum: `cufe_exacto` \| `comercio_fecha_total_similar` | FR-019/FR-020 |
| `estado` | enum: `duplicado_confirmado` \| `pendiente_confirmacion` \| `confirmado_distinto` | `cufe_exacto` entra directo en `duplicado_confirmado`; `comercio_fecha_total_similar` entra en `pendiente_confirmacion` y espera al usuario |
| `resueltoEn` | timestamp, nullable | |

**Regla de coincidencia** (clarificación Q3): `comercio_fecha_total_similar` exige fecha calendario exacta + total exacto + nombre de comercio *similar* (no exige igualdad carácter por carácter — tolerante a variación de OCR). Ver `research.md` §6 para el mecanismo (`pg_trgm`).

**Nota de diseño**: esta marca es ortogonal a `Factura.estado` — una factura puede estar `extraída` y a la vez tener una `MarcaDePosibleDuplicado` pendiente; el estado del pipeline y la resolución de duplicados no se mezclan en la misma máquina de estados.

## Extracción Cruda

Entidad exigida por la constitution (Principio III), no visible en el spec de negocio pero obligatoria en el diseño técnico: preserva la salida cruda del proveedor de extracción para permitir reprocesamiento futuro sin volver a fotografiar nada.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `facturaId` | UUID (FK → Factura) | |
| `jsonCrudo` | JSON | Salida sin normalizar del proveedor de extracción |
| `versionPrompt` | string | |
| `versionModelo` | string | p. ej. `claude-sonnet-5` |
| `creadaEn` | timestamp | |

## Máquina de Estados de `Factura.estado`

```text
recibida ──────────────► procesando
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          extraída    necesita_revisión   fallida
              ▲              │              │
              └──────────────┘              │
                             ▲ (reintento)   │
                             └───────────────┘
```

| Transición | Disparador |
|---|---|
| `recibida → procesando` | El pipeline de extracción toma el documento |
| `procesando → extraída` | Extracción exitosa y totales cuadran |
| `procesando → necesita_revisión` | Baja confianza en algún campo, o totales no cuadran (FR-010) |
| `procesando → fallida` | Fallo total del procesamiento (FR-013) |
| `fallida → procesando` | Reintento (manual o automático) |
| `necesita_revisión → extraída` | El usuario corrige el/los campo(s) y el registro ya cuadra |

Cualquier transición no listada aquí MUST fallar de forma explícita — nunca degradar a un estado por defecto (constitution, sección "Máquina de Estados del Documento").

## Relaciones

- `Factura 1 — N ÍtemFactura`
- `Factura 1 — N CorrecciónManual`
- `Factura 1 — N ExtracciónCruda` (una por cada intento de procesamiento/reintento)
- `Factura N — N Factura` a través de `MarcaDePosibleDuplicado` (relación reflexiva)
