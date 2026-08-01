# Sistema de diseño — MyIvo

Documento de referencia para recrear el diseño de la app (dos temas, todas las pantallas ya construidas). Extraído directamente del código real (`apps/web/src/theme/tokens.css` + cada página en `apps/web/src/pages/`), no de memoria — cualquier valor de aquí coincide con lo que corre hoy.

App móvil-first (una sola columna, sin sidebar), SPA de una vista a la vez (no hay router de URLs: `App.tsx` cambia entre "vistas" con estado de React). Dos temas intercambiables en caliente, elegidos por el usuario o heredados del sistema operativo:

- **Industry** (claro) — vocabulario "blueprint": esquinas cuadradas, marcas de registro "+" en las 4 esquinas de cada tarjeta, versalitas en títulos, un único elemento con relleno sólido (el botón primario).
- **Nocturne** (oscuro) — esquinas redondeadas, sin marcas de registro, sin versalitas, botones con contorno en vez de relleno, tarjetas con fondo propio en vez de transparente.

---

## 1. Tokens

### 1.1 Color — Industry (`:root[data-theme='industry']`)

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#f2f2f3` | Fondo de página |
| `--color-text` | `#1d1f20` | Texto principal |
| `--color-text-muted` | `rgba(29,31,32,.55)` | Texto secundario |
| `--color-text-muted-2` | `rgba(29,31,32,.45)` | Texto terciario (kickers, notas) |
| `--color-accent` | `#5980a6` | Acento (azul grisáceo) |
| `--color-accent-fg` | `#f2f2f3` | Texto sobre acento sólido |
| `--color-accent-bg-tint` | `#eef6ff` | Fondo tintado (chip/botón-icono activo) |
| `--color-accent-fg-tint` | `#41617f` | Texto/ícono con tinte de acento |
| `--color-border` | `rgba(29,31,32,.18)` | Bordes normales |
| `--color-border-strong` | `rgba(29,31,32,.08)` | Bordes muy sutiles (separadores de fila) |
| `--color-estado-recibida` | `rgba(29,31,32,.55)` | |
| `--color-estado-procesando` | `#5980a6` | |
| `--color-estado-extraida` / `-fg` | `#3d6249` / `#4d7c5b` | Verde éxito |
| `--color-estado-revision` / `-fg` | `#8a6423` / `#a3742c` | Ámbar advertencia |
| `--color-estado-fallida` / `-fg` | `#82372f` / `#a5473d` | Rojo error |
| `--color-estado-varias` | `#6b3f66` | Púrpura ("varias facturas en una foto") |
| `--color-estado-varias-bg` | `rgba(138,90,134,.13)` | |

Radios: `--radius-card: 0`, `--radius-button: 0`, `--radius-fab: 0` (todo cuadrado). `--card-bg: transparent`, `--card-border: 1px solid var(--color-border)`. `--icon-stroke-width: 1.5`. `--titulo-transform: uppercase`.

### 1.2 Color — Nocturne (`:root[data-theme='nocturne']`)

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#161826` | Fondo de página |
| `--color-text` | `#e9e9ed` | Texto principal |
| `--color-text-muted` | `rgba(233,233,237,.5)` | Texto secundario |
| `--color-text-muted-2` | `rgba(233,233,237,.45)` | Texto terciario |
| `--color-accent` | `#9184d9` | Acento (violeta) |
| `--color-accent-fg` | `#b5abfc` | Texto/ícono sobre outline de acento |
| `--color-accent-bg-tint` | `transparent` | (Nocturne nunca usa relleno tintado) |
| `--color-accent-fg-tint` | `#b5abfc` | |
| `--color-border` | `rgba(233,233,237,.16)` | |
| `--color-border-strong` | `rgba(233,233,237,.09)` | |
| `--color-estado-recibida` | `#9397ab` | |
| `--color-estado-procesando` | `#9184d9` | |
| `--color-estado-extraida` / `-fg` | `#7cc79a` (ambos) | Verde |
| `--color-estado-revision` / `-fg` | `#d8a95f` (ambos) | Ámbar |
| `--color-estado-fallida` / `-fg` | `#e08a80` (ambos) | Rojo |
| `--color-estado-varias` | `#d59bcf` | Púrpura |
| `--color-estado-varias-bg` | `transparent` | |

Radios: `--radius-card: 8px`, `--radius-button: 8px`, `--radius-fab: 50%`. `--card-bg: #232532`, `--card-border: 1px solid var(--color-border)`. `--icon-stroke-width: 1.7`. `--titulo-transform: none` (sin versalitas, `letter-spacing: -0.015em` en su lugar).

`color-scheme` va fijado por tema (`light`/`dark`) dentro de cada bloque `:root[data-theme=...]` — necesario para que los controles nativos (inputs, `<select>`) sigan el tema elegido y no el del sistema operativo.

### 1.3 Tipografía

| Token | Industry | Nocturne |
|---|---|---|
| `--font-heading` | `'Barlow Condensed', system-ui, sans-serif` | `'Inter', system-ui, sans-serif` |
| `--font-body` | `'Barlow', system-ui, sans-serif` | `'Inter', system-ui, sans-serif` |
| `--font-weight-heading` | 600 | 500 |
| `--font-weight-body-strong` | 500 | 500 |
| `--font-weight-body` | 400 | 400 |

Fuentes auto-hospedadas vía `@fontsource` (nunca CDN de Google Fonts): `barlow/400,500,600`, `barlow-condensed/600`, `inter/400,500`.

Título de pantalla (`.heading.titulo-pantalla`, `<h1>`): 26px, `letter-spacing: 0.02em`, versalitas en Industry (`text-transform: uppercase`); en Nocturne caja normal con `letter-spacing: -0.015em`.

Kicker (`.kicker` — mes del listado, etiqueta de tarjeta de totales, secciones): 10px, weight 600, `letter-spacing: 0.12em`, uppercase, siempre.

### 1.4 Espaciado y layout

- Padding de página estándar: `16px 20px` (a veces `4px 20px 24px` en Detalle, donde el header ya no necesita el padding-top).
- Tarjetas (`.card`): `padding: 14px 16px` típico; `border-radius: var(--radius-card)`; `background: var(--card-bg)`; `border: var(--card-border)`; `position: relative` (ancla para `<MarcasEsquina />`).
- Sin sistema de grid — todo flexbox/inline-styles puntuales por pantalla (no hay librería de UI, CSS puro).
- Ancho de referencia del frame (mockups): **392px** (phone frame), diseño móvil-first sin límite de ancho máximo explícito en el código (una tablet/desktop grande simplemente deja la columna angosta a la izquierda salvo donde se indique lo contrario).

---

## 2. Componentes compartidos (`tokens.css`)

### `.card` + `<MarcasEsquina />`
Contenedor base de casi toda la app. `<MarcasEsquina />` (`theme/MarcasEsquina.tsx`) agrega 4 `<i class="corner-mark tl|tr|bl|br">` — una cruz "+" de 11×11px en cada esquina, solo visible en Industry (`display:none` en Nocturne). Siempre el primer hijo de un `.card`.

### `.btn-primary`
Único elemento con relleno sólido en Industry (`background: var(--color-accent)`, texto `--color-accent-fg`, borde del mismo acento). En Nocturne: `background: transparent`, borde de acento, texto `--color-accent-fg` — **nunca relleno**. `position: relative` (para anclar `<MarcasEsquina />` si el botón la usa, p. ej. el FAB de cámara).

### `.boton-icono`
Cuadrado 34×34px, borde `--color-border`, `border-radius: var(--radius-button)`, fondo transparente. Estado `.activo`: borde de acento + `background: var(--color-accent-bg-tint)` + `color: var(--color-accent-fg-tint)`.

### `.chip`
Pill de filtro: `font-size: 12px`, `padding: 4px 8px`, borde `--color-border`, `border-radius: var(--radius-button)`. `.activo` en Industry = relleno sólido de acento; en Nocturne = solo contorno de acento + texto `--color-accent-fg-tint`. Puede envolver un `<select>`/`<input>` transparente (fecha, número, texto) — ancho máximo recortado (`74px` fecha, `56px` número) para que no desborde.

### `.badge-estado` (Captura — badge del lote de hoy)
Pill `font-size: 11px`, weight 600. Industry: texto en versalitas + fondo tintado según el estado (`recibida` gris, `procesando`/`extraida` según acento/verde, `revision` ámbar, `fallida` rojo, `varias` púrpura). Nocturne: nunca relleno, solo `border` del color del estado + texto en caja normal, `border-radius: 6px`.

### `.menu-contextual` (Detalle — menú "···")
`position: absolute; top: calc(100% + 6px); right: 0; width: 210px`, ancla el `<header>` del padre (que debe ser `position: relative`). Backdrop full-screen semitransparente detrás (`.menu-contextual-backdrop`, cierra al click fuera). Ítems (`.menu-contextual-item`): fila `13px`, weight 500, ícono + texto; variante `.peligro` en rojo (`--color-estado-fallida-fg`) para "Eliminar factura".

### `.duplicado-sheet` (Listado — "¿Es la misma compra?")
Bottom sheet fijo al fondo de la pantalla. Industry: fondo `--color-bg`, borde superior, sin radio. Nocturne: fondo `--card-bg`, `border-radius: 16px 16px 0 0`, sombra fuerte. Handle de 44×4px centrado arriba. Dos tarjetas comparativas lado a lado (`.duplicado-tarjeta`, una de ellas `.acento`) con comercio/fecha/hora/total. Botón primario ancho completo + botón secundario outline + nota de ayuda.

### `.estado-vacio` (Listado — biblioteca sin facturas)
Industry: centrado (texto y bloque), Nocturne: alineado a la izquierda — diferencia real de diseño, no omisión. Ícono grande en una tarjeta cuadrada/redondeada (`96×118px`), título 24px, subtítulo, botón primario grande, nota final.

### `.rejilla-campos` / `.celda-campo` (Detalle — campos clave)
Grid 2 columnas (`grid-template-columns: 1fr 1fr`). Cada celda: etiqueta uppercase 10px con un punto de confianza + ícono lápiz, valor 14px/500 debajo, tocable completa para entrar en modo edición inline (reemplaza el valor por un `<input>`/`<select>` + botones Guardar/Cancelar). Badge "Corregido" cuando el valor difiere del extraído originalmente (con el valor original tachado debajo).

### Punto de confianza
Círculo de 6px, color según umbral: `< 0.7` rojo (`--color-estado-fallida-fg`), `< 0.9` ámbar (`--color-estado-revision-fg`), `≥ 0.9` verde (`--color-estado-extraida-fg`). Leyenda de 3 puntos (alta/media/baja) debajo de la rejilla de campos en Detalle.

### `.fila-listado`
Fila plana (no tarjeta): Industry con línea inferior sólida sutil; Nocturne con degradado que se desvanece en los extremos (`24px` de margen a cada lado antes de llegar al color de línea).

---

## 3. Iconografía

Dos librerías, una por tema, mapeadas 1:1 por nombre semántico (`theme/iconos.ts` → `obtenerIcono(nombre, tema)`):

| Nombre | Industry (Lucide) | Nocturne (Phosphor) |
|---|---|---|
| `volver` | ArrowLeft | ArrowLeftIcon |
| `camara` | Camera | CameraIcon |
| `reloj` | Clock | ClockIcon |
| `galeria` | Images | ImagesIcon |
| `filtro` | ListFilter | FunnelIcon |
| `cargando` | LoaderCircle | CircleNotchIcon |
| `menu` | MoreVertical | DotsThreeVerticalIcon |
| `buscar` | Search | MagnifyingGlassIcon |
| `capas` | Layers | StackIcon |
| `check` | CircleCheck | CheckCircleIcon |
| `alerta` | TriangleAlert | WarningIcon |
| `error` | XCircle | XCircleIcon |
| `eliminar` | Trash2 | TrashIcon |
| `editar` | Pencil | PencilSimpleIcon |
| `factura` | ReceiptText | ReceiptIcon |
| `reporte` | ChartColumn | ChartBarIcon |
| `mostrar-contraseña` | Eye | EyeIcon |
| `ocultar-contraseña` | EyeOff | EyeSlashIcon |
| `reprocesar` | RefreshCw | ArrowsClockwiseIcon |

Trazo: Industry 1.5px (algunos usos puntuales 1.7px en headers), Nocturne 1.7px (`--icon-stroke-width`).

---

## 4. Chrome global (`App.tsx`)

Barra superior `sticky` (no `fixed`) de **44px** de alto, fondo `--color-bg`, alineada a la derecha, `padding: 0 20px`, `gap: 8px`:
1. `<select>` de tema (Sistema / Claro / Oscuro) — outline sutil, `font-size: 12px`.
2. Botón "Mi cuenta" — mismo estilo outline sutil.
3. Botón "Salir" — mismo estilo, cierra sesión.

Debajo de esa barra vive el contenido de la "vista" activa (una de: `listado`, `captura`, `detalle`, `conciliacion-dian`, `reporte-anual`, `cuenta-propia`) — no hay tab bar ni navegación inferior; la navegación entre pantallas ocurre por botones/íconos dentro de cada pantalla (volver, FAB de cámara, íconos del header de Listado, "Ver facturas en el Listado" del reporte, etc.).

Si no hay sesión: se reemplaza todo el `<main>` por la pantalla de **Login** (pantalla completa, sin chrome).

---

## 5. Pantallas

### 5.1 Login (`pages/Login.tsx`)

Card centrada verticalmente en toda la altura de pantalla, 280px de ancho, `padding: 24px`, `gap: 12px` entre elementos, `<MarcasEsquina />`. Tres variantes por estado (`modo`), todas dentro del mismo layout de card centrada:

**`iniciar-sesion` / `crear-cuenta`** (mismo formulario, el texto y el submit cambian):
- Título `<h1 class="heading">MyIvo</h1>` (24px).
- Campo "Correo" (label + input email).
- Campo "Contraseña" (label + input password; `autoComplete` cambia entre `current-password`/`new-password`; `minLength=8` solo al crear cuenta).
- Mensaje de error (`role="alert"`, color rojo) si aplica.
- Botón primario ancho completo: "Ingresar" / "Crear cuenta" (o "Ingresando…"/"Creando cuenta…" mientras envía).
- Enlace de texto subrayado: "¿No tienes cuenta? Crear una" / "¿Ya tienes cuenta? Ingresar".
- Separador "o" (línea — texto — línea).
- Botón outline "Continuar con Google".
- Botón outline "Continuar con Microsoft".
- Botón outline "Continuar con GitHub".
- Botón outline "Ingresar con passkey" (solo en modo `iniciar-sesion`, no al crear cuenta).

**`verifica-tu-correo`** (tras registrarse):
- Título "Verifica tu correo".
- Texto: "Te enviamos un enlace a **{correo}**. Ábrelo para activar tu cuenta — después podrás iniciar sesión desde aquí."
- Botón primario "Ya verifiqué, ingresar" (vuelve a `iniciar-sesion`).

**`verificar-2fa`** (cuenta con 2FA activo, tras credenciales válidas):
- Título "Verificación en dos pasos".
- Campo único: "Código de tu app autenticadora" (numérico) o "Código de respaldo" (texto) según el toggle.
- Error inline si el código es inválido.
- Botón primario "Verificar" / "Verificando…".
- Enlace de texto: "Perdí acceso — usar un código de respaldo" ↔ "Usar el código de la app autenticadora" (toggle).

### 5.2 Listado — "Mis facturas" (`pages/Listado.tsx`)

Pantalla principal / home. Padding `16px 20px`.

**Header**: `<h1>Mis facturas</h1>` (flex:1) + 4 botones-icono a la derecha (ocultos si la biblioteca está vacía): buscar (toggle), filtros (toggle), conciliar DIAN, reporte anual.

**Búsqueda** (si se activa): input full-width "Buscar por comercio…".

**Filtros** (si se activan) — fila horizontal scrolleable de chips: Desde (fecha) · Hasta (fecha) · Min. (número) · Máx. (número) · Tipo (select tipo de documento) · Elegibilidad (select: Elegibles/No elegibles) · Estado (select) · "Limpiar" (chip botón).

**Tarjeta de totales** (`.card`, margin `18px 0 6px`): kicker "{Total facturas | Compras elegibles | Compras no elegibles} · {año actual}", monto grande 42px (`.heading`), subtítulo "{N} factura(s) en COP · refleja los filtros activos".

**Lista agrupada por mes**: `<h2 class="kicker">` con el nombre del mes + lista de filas (`.fila-listado`). Cada fila: nombre del comercio (con check DIAN inline si tiene validación) + fecha (badge de moneda si no es COP) a la izquierda; monto + etiqueta de elegibilidad ("Elegible" con check / "No elegible" / "Por confirmar" / "Fuera del total en COP") a la derecha.

**FAB**: botón circular/cuadrado (58×58px) fijo abajo-derecha, ícono cámara, `<MarcasEsquina />`, abre Captura.

**Estado vacío** (biblioteca sin ninguna factura, sin filtros activos): reemplaza header extendido + tarjeta + lista por `<EstadoVacio />` (ver 5.2.1). El header sigue mostrando solo el título, sin los 4 íconos ni el FAB.

**Bottom sheet "¿Es la misma compra?"** (aparece encima de todo si hay una marca de posible duplicado pendiente): título, subtítulo explicando el motivo (CUFE idéntico o similitud fuerte), dos tarjetas comparativas lado a lado ("Ya guardada" / "Recién capturada", esta última acentuada con hora destacada), botón primario "Sí, es la misma — conservar una", botón secundario "No, son compras distintas", nota "Si es la misma, conservamos la copia con más datos."

#### 5.2.1 Estado vacío (`pages/EstadoVacio.tsx`)

Bloque centrado (Industry) / alineado a la izquierda (Nocturne): tarjeta-ícono grande (ícono factura, 96×118px), título "Aún no tienes facturas", subtítulo "Toma una foto de tu próxima factura y nosotros nos encargamos de leerla, guardarla y decirte si sirve para tu declaración.", botón primario grande "Capturar mi primera factura" (con ícono cámara), nota "También puedes subir fotos desde tu galería."

### 5.3 Captura (`pages/Captura.tsx`)

Header con volver + título "Capturar".

**Dos botones grandes lado a lado**: "Tomar foto" (botón primario, input `capture="environment"`) / "Subir de galería" (tarjeta outline, input múltiple imágenes+PDF).

**Resumen del lote** (si hay fotos subidas): kicker "Lote de hoy — {N} foto(s)" a la izquierda, "{listas} lista(s) · {en proceso} en proceso" a la derecha.

**Lista de filas** (una por foto subida), cada una con miniatura 48×62px (borde según estado: rojo si fallida, púrpura si varias_facturas, normal si no) + nombre del comercio (o los primeros 8 caracteres del id mientras no hay nombre) + subtítulo dependiente del estado + badge de estado a la derecha:
- `recibida`: "En fila para procesar" · badge reloj.
- `procesando`: "Leyendo los campos…" · badge spinner.
- `extraída`: "{monto} · {N} campos leídos" · badge check.
- `necesita_revisión`: "Revisa los campos con baja confianza" · badge alerta.
- `fallida`: "No pudimos leer esta factura · **Reintentar**" (enlace inline) · badge error.
- `varias_facturas`: "Vimos varias facturas en esta foto · **Separar y recapturar**" (enlace inline, reabre la cámara) · badge capas.

Nota final: "Puedes cerrar esta pantalla — seguimos leyendo tus fotos y te avisamos si algo necesita revisión."

### 5.4 Detalle (`pages/Detalle.tsx`)

La pantalla más densa. Header (`position: relative`, ancla el menú): volver + nombre del comercio (título 24px) + "{fecha} · {estado}" debajo + menú "···" a la derecha.

**Menú "···"** (`MenuAcciones`): "Reprocesar" (solo si estado es `fallida`/`necesita_revisión`/`extraída`) + "Eliminar factura" (rojo). Al elegir eliminar, el menú cambia a un paso de confirmación inline: texto de advertencia ("El registro y la foto original quedan recuperables — solo deja de aparecer en tu listado") + botones "Sí, eliminar" (rojo sólido) / "Cancelar".

**Foto**: botón de texto centrado "Mostrar foto" / "Ocultar foto" que expande/colapsa la imagen original (max-height 220px, object-fit cover).

**Banner de elegibilidad** (si ya se calculó): ícono check verde + "Elegible para deducción del 1%" (borde verde), o ícono alerta ámbar + el motivo de no-elegibilidad (borde ámbar) — siempre con la nota fija: "El sistema organiza, no emite concepto tributario — revísalo con tu contador antes de usarlo en tu declaración de renta."

**Sección Validación DIAN** (solo si la factura tiene CUFE): kicker "Validación DIAN", última validación si existe ("**{resultado}** · {fecha}"), botón primario "Consultar en la DIAN" (enlace externo) + botón "Copiar CUFE" (cambia a "CUFE copiado" 2s), select de resultado + botón "Registrar resultado", `<details>` colapsable "Ver historial completo (N)" si hay más de una validación.

**Leyenda de confianza**: "Confianza: ● alta ● media ● baja" (3 puntos de color).

**Rejilla de campos clave** (2 columnas, tocable campo por campo para editar inline): Comercio, NIT, Fecha y hora, Medio de pago, Tipo de documento, Moneda, Adquiriente, Identificación, CUFE (con etiqueta "CUFE (por OCR)" si vino de respaldo OCR en vez del QR).

**Ítems**: kicker "Ítems · {N}", lista con descripción / cantidad / monto / punto de confianza por fila, o "Sin ítems extraídos."

**Totales**: Subtotal, Impuesto al consumo, Propina (cada uno editable igual que los campos clave) + una línea por cada tarifa de IVA presente + fila "Total" grande (24px, tocable para editar).

**Correcciones manuales** (si hay alguna): kicker "Correcciones manuales · {N}", lista `{campo}: ~~{original}~~ → {corregido} · {fecha}`.

### 5.5 Conciliar con la DIAN (`pages/ConciliacionDian.tsx`)

Header: volver + "Conciliar con la DIAN". Texto explicativo: "Sube el archivo que descargaste del portal de la DIAN (Facturando Electrónicamente → documentos recibidos) para marcar de una sola vez cuáles de tus facturas ya capturadas aparecen ahí como válidas."

**Tarjeta de carga**: label "Archivo de la DIAN (.xlsx)", input file, botón primario "Conciliar" / "Conciliando…" (deshabilitado sin archivo).

**Tarjeta de resultado** (tras conciliar): kicker "Resultado", "**{N}** factura(s) conciliada(s)", "{M} CUFE(s) del archivo sin ninguna factura capturada correspondiente".

### 5.6 Reporte anual (`pages/ReporteAnual.tsx`)

Header: volver + "Reporte anual" (flex:1) + chip-select de año a la derecha (chip siempre `.activo`, con años desde el más antiguo con facturas hasta el actual).

**Tarjeta de totales**: kicker "Compras elegibles · {año}", monto grande 42px, "{N} factura(s) en COP", fila de acciones: botón primario "Ver facturas en el Listado" (navega a Listado con filtros del año ya aplicados: fechas del año completo, elegibilidad=true, moneda=COP) + chip "Exportar Excel" + chip "Exportar PDF" (cada uno con su propio estado "Exportando…").

**Tarjeta de desglose mensual**: kicker "Desglose mensual", lista de 12 filas (nombre del mes, capitalizado) con conteo pequeño + monto a la derecha, separadas por línea.

Nota fija al final: "Este reporte organiza información ya calculada por el sistema; no es un concepto tributario. Revísalo con tu contador antes de usarlo en tu declaración de renta."

### 5.7 Mi cuenta (`pages/CuentaPropia.tsx`)

Header: volver + "Mi cuenta". Cuatro tarjetas apiladas, `max-width: 480px`:

**1. Identificación tributaria**: texto explicativo, input de texto ("1121880039, 16469166" como placeholder, varias separadas por coma), botón primario "Guardar".

**2. Cambiar contraseña**: tres campos `CampoContraseña` (componente reutilizable: label + input con botón de ojo para mostrar/ocultar, `aria-pressed`, warning para lector de pantalla) — "Contraseña actual", "Contraseña nueva" (mín. 8), "Confirmar contraseña nueva" (valida coincidencia solo tras salir del campo) — botón primario "Cambiar contraseña".

**3. Verificación en dos pasos**: texto explicativo. Tres estados posibles:
  - *Desactivada*: texto "Desactivada.", campo de contraseña (opcional para cuentas solo-OAuth), botón primario "Activar".
  - *Confirmando activación* (tras activar): código QR (`react-qr-code`, siempre fondo blanco/trazo negro sin importar el tema — legibilidad del escáner por encima de la estética), lista de códigos de respaldo en grid monoespaciado 2 columnas dentro de un recuadro con borde, campo de código de 6 dígitos, botón primario "Confirmar y activar".
  - *Activa*: texto "Activa.", botón "Desactivar" que despliega un campo de contraseña + botón "Desactivar" definitivo.

**4. Passkeys**: texto explicativo. Lista de passkeys registrados (nombre + botón eliminar con ícono de basura por fila) o "Todavía no tienes passkeys registrados."; formulario "Nombre (opcional...)" + botón primario "Agregar passkey".

---

## 6. Patrones transversales

- **Estados de carga**: casi siempre un simple `<p>Cargando…</p>`; nunca skeletons.
- **Errores**: `<p role="alert">` en color `--color-estado-fallida-fg`, siempre inline junto al control que falló (nunca un toast/snackbar global).
- **Confirmaciones destructivas**: solo "Eliminar factura" las tiene (paso intermedio dentro del propio menú, no un modal aparte); ninguna otra acción del sistema es irreversible desde la UI (reprocesar es repetible; deshabilitar 2FA/borrar passkey no tienen paso de confirmación adicional más allá de pedir la contraseña).
- **Ediciones inline**: el patrón "tocar el valor → se convierte en formulario con Guardar/Cancelar" se repite en Detalle (campos clave, totales) — nunca un modal para editar un campo.
- **Nota de disclaimer tributario**: aparece literalmente en dos lugares con la misma idea (banner de elegibilidad en Detalle, pie del Reporte anual) — "el sistema organiza, no emite concepto tributario, revisar con el contador" — es un requisito de producto (constitution Principio IV), no solo de copy.
