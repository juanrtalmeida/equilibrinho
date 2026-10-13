---
target: Montar times
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/yukito/projects/equilibrinho/src/screens/Build.tsx"
target_fingerprint: "sha256:55d213b41589901b2916503e932cd7f12966b05369af4a255f6ae84f70b326e8"
target_path: /home/yukito/projects/equilibrinho/src/screens/Build.tsx
timestamp: 2026-10-13T21-22-55Z
slug: src-screens-build-tsx
---
# Critique: Montar times (src/screens/Build.tsx) — pré-shadcn

Method: dual-agent (A: design review · B: detector + CDP browser evidence)

Heuristics: 1 Status 1 · 2 Real world 2 · 3 Control 2 · 4 Consistency 3 · 5 Error prevention 2 · 6 Recognition 2 · 7 Efficiency 3 · 8 Minimalist 2 · 9 Recovery 2 · 10 Help 3 → 22/40 (Acceptable)

Detector: CLI 0 findings. Browser overlay: low-contrast white on #e8590c 3.6:1 (primary + selected chips), chip subtext 2.62:1, active tab 3.58:1; 58/66 targets < 44px; line-length > 80ch on desktop; cream-palette (style, false positive); text-occlusion only in empty state (false positive).

Priority issues:
- [P0] Resultado gerado aparece fora da tela (board ~1370px abaixo do botão, sem scroll/feedback).
- [P1] "Gerar de novo" apaga ajustes manuais sem aviso/desfazer; semente exposta no caminho principal.
- [P1] Sem modo de apresentação para o grupo; notas numéricas expostas para todos.
- [P1] Legibilidade ao sol e alvos de toque (<44px, contraste 3.6:1, cadeado emoji opacity .4).
- [P2] Explicação densa (tabela 14 linhas, penalidades cruas), opções indistinguíveis (todas 100/100), plural "Levantadors".

Status: P0/P1 e contraste/alvos endereçados na migração shadcn (2026-10-13): setup recolhe e o resultado vai ao topo, desfazer via toast, "Mostrar" tela cheia sem notas, laranja oklch(0.55 0.19 40), botões/inputs ≥44px, explicação recolhida, semente movida para detalhes.
