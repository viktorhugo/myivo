/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // *.e2e-spec.ts (convención de NestJS para tests de integración, p. ej.
  // aislamiento-cuentas.e2e-spec.ts) NO calza con *.spec.ts — "-spec.ts" no
  // termina en ".spec.ts" (el carácter antes de "spec" es un guion, no un
  // punto). Hace falta el patrón aparte, no alcanza con el genérico.
  testMatch: [
    '<rootDir>/test/**/*.spec.ts',
    '<rootDir>/test/**/*.e2e-spec.ts',
    '<rootDir>/src/**/*.spec.ts',
  ],
  // better-auth (y better-call, del que depende) se publican solo como ESM
  // (.mjs, sin build CJS) — Jest en modo CommonJS no puede requerirlos tal
  // cual ("Cannot use import statement outside a module"). transform agrega
  // babel-jest para .m?js (además del propio de ts-jest para .ts, que el
  // preset ya trae); transformIgnorePatterns vacío para que Jest no se salte
  // node_modules — enumerar a mano cada paquete ESM transitivo de
  // better-auth sería fácil de romper con la próxima actualización.
  transform: {
    // isolatedModules: tsconfig.base.json usa "module": "NodeNext" (kind
    // híbrido) — ts-jest lo transpila archivo por archivo sin este flag y
    // no resuelve bien ciertos tipos entre archivos (p. ej. namespace
    // mergeado de `sharp`). No pierde cobertura real: el type-check
    // completo ya lo hace `pnpm typecheck` (tsc -p, programa completo)
    // como paso aparte, igual que en T021.
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
    '^.+\\.m?jsx?$': 'babel-jest',
  },
  transformIgnorePatterns: [],
};
