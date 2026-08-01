# Quickstart: Validación end-to-end por historia de usuario

Guía de validación manual, no de implementación. Prerrequisitos comunes: ver `specs/001-captura-facturas/quickstart.md` (`docker compose up`). Además: acceso a dos bandejas de correo reales distintas (para verificar dos cuentas), y las credenciales de Resend configuradas (research.md § 2).

## P1 — Registro abierto, verificación, y aislamiento total

**Objetivo**: demostrar que dos personas cualquiera pueden registrarse por su cuenta y que sus datos nunca se mezclan ni se filtran entre sí.

1. Registrar la cuenta A (correo real 1) desde la app — confirmar que NO puede capturar facturas ni ver ningún dato hasta verificar el correo (Acceptance Scenarios 1-2, FR-002).
2. Verificar el correo de la cuenta A (siguiendo el enlace recibido) — confirmar que ahora sí puede iniciar sesión y capturar (Acceptance Scenario 1).
3. Repetir 1-2 con la cuenta B (correo real 2, distinto).
4. Con la cuenta A, capturar 2-3 facturas, corregir algún campo, y (si tiene CUFE) registrar una validación DIAN.
5. Con la cuenta B, repetir el paso 4 con sus propias facturas.
6. Con la cuenta A, confirmar en Listado/Detalle que solo ve sus propias facturas — ninguna de la cuenta B (Acceptance Scenario 3).
7. Copiar el identificador de una factura de la cuenta B (desde su URL de Detalle, con la cuenta B todavía logueada) e intentar abrirlo con la sesión de la cuenta A — confirmar que responde exactamente igual que un identificador que no existe (Acceptance Scenario 4, FR-005).
8. Si ambas cuentas capturan una factura del mismo comercio, misma fecha, mismo total (a propósito, para la prueba): confirmar que el sistema NO las marca como posible duplicado entre sí (Acceptance Scenario 5, FR-006).
9. Con la cuenta A, subir un Excel de conciliación DIAN (si se tiene uno real) — confirmar que solo concilia facturas de la cuenta A (Acceptance Scenario 6).
10. Con cada cuenta, abrir el reporte anual — confirmar que el total/desglose de cada una refleja solo sus propias facturas elegibles (Acceptance Scenario 7).
11. Confirmar que los datos que Victor ya tenía capturados antes de esta feature siguen ahí, bajo su propia cuenta nueva ya verificada, sin haber tenido que registrarse (Acceptance Scenario 8, FR-008).

```bash
# Registro
curl -X POST https://localhost/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "cuenta-a@ejemplo.com", "password": "..."}'

# Intentar usar la app sin verificar (debe fallar)
curl -b cookies-a.txt https://localhost/invoices
```

**Resultado esperado**: antes de verificar, cualquier endpoint protegido responde como si no hubiera sesión. Después de verificar (paso 2), el mismo request funciona.

## P2 — Gestionar mi propia cuenta

**Prerrequisito real**: la cuenta A de P1, ya verificada.

1. Cambiar la contraseña de la cuenta A desde la app — cerrar sesión, y confirmar que la contraseña vieja ya no sirve pero la nueva sí (Acceptance Scenario 1).
2. Configurar la identificación tributaria propia de la cuenta A desde la app (`PUT /cuenta/identificaciones`) — capturar una factura nueva a nombre de esa identificación y confirmar que la elegibilidad la reconoce de inmediato, sin reiniciar nada (Acceptance Scenario 2).

## Validar que nada se rompió

Repetir los escenarios de aceptación de `specs/001-captura-facturas/quickstart.md` a `specs/005-captura-pdf-facturas/quickstart.md` con una sola cuenta — deben comportarse exactamente igual que antes, ahora acotados a esa cuenta. En particular, confirmar que `evaluarElegibilidad2026` (dominio) no cambió su comportamiento — solo cambió de dónde vienen las identificaciones que recibe como parámetro.
