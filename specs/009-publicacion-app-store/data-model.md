# Data Model: Publicación en el Apple App Store (Fase 1)

Esta fase no introduce ninguna entidad de dominio nueva ni ningún cambio de esquema en `apps/api`/Prisma.

Capacitor empaqueta el build de `apps/web` tal cual; la cámara nativa (ver [research.md § Decisión 2](./research.md#decisión-2--capacidad-nativa-para-la-guideline-42-cámara-nativa-no-push-notifications)) entrega el archivo de la foto al mismo pipeline de carga que ya existe hoy — no hay ningún dato nuevo que persistir, ni en el cliente ni en el servidor.

Si una revisión real de Apple exigiera sumar push notifications más adelante (ver spec.md § Edge Cases), ahí sí haría falta una entidad nueva (token de dispositivo por usuario) — queda fuera de alcance de esta fase y no se modela acá.
