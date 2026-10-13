# Equilibrinho

PWA offline para montar times equilibrados de vôlei recreativo e aprender com os resultados.

```sh
npm run dev      # desenvolvimento
npm test         # testes do motor (node:test, sem deps)
npm run build    # build de produção em dist/ (com service worker e precache)
npm run preview  # servir o build; offline funciona após o 1º carregamento
```

- Dados ficam só no dispositivo (`localStorage`). Backup/restauração em **Dados**.
- `src/engine/rating.ts`: força + aprendizado (replay determinístico de todas as partidas → editar/excluir resultado recalcula tudo).
- `src/engine/balance.ts`: função de custo (força, habilidades, posições, dependência, incerteza, restrições) + busca local com semente.
