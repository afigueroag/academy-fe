# Cantera (academy-fe)

Frontend de **Cantera**, SaaS para gestión de academias (deportes, artes marciales, música, arte, escuelas pequeñas, kínders/guarderías).

## Stack

React 18 · Vite · TypeScript · React Router 6. Sin librerías de UI ni de íconos.

## Comandos

```bash
npm install
npm run dev         # servidor local (Vite)
npm run typecheck   # solo TS, sin emitir
npm run build       # typecheck + bundle a dist/
npm run preview     # sirve el bundle generado
```

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores.

## Arquitectura y convenciones

- **Estilo, componentes y patrones** → [STYLE_GUIDE.md](STYLE_GUIDE.md)
- **Onboarding para Claude Code** → [CLAUDE.md](CLAUDE.md)
- **Plantilla para pedir un módulo nuevo** → [PROMPT_TEMPLATE.md](PROMPT_TEMPLATE.md)
- **Contrato del backend** → [openapi.json](openapi.json)
