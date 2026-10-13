# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Um organizador de vôlei recreativo (o próprio dono do projeto) e a sua turma. O organizador usa o app **na quadra, no celular**, em pé, enquanto o pessoal vai chegando — muitas vezes ao ar livre. O trabalho dele é: marcar quem veio, gerar times parelhos em segundos, mostrar a escalação para o grupo, ajustar na hora e, no fim, anotar o placar.

Ferramenta pessoal, não distribuída publicamente (pode mudar no futuro; não é objetivo agora).

## Product Purpose

Tirar a montagem de times do "achismo" do organizador e torná-la consistente, transparente e progressivamente mais inteligente. Sucesso = jogos parelhos desde a primeira vez, estimativas que melhoram com o histórico, e o organizador sempre no controle (pode mover, fixar e corrigir tudo).

## Positioning

Combina avaliação manual de habilidades com aprendizado real a partir dos placares: força individual ajustada pelos resultados e sinergia entre pares, sempre com nível de confiança explícito e explicação de por que cada escalação foi sugerida. Funciona 100% offline, sem conta nem servidor.

## Operating Context

- Uso principal: celular, na quadra, com pressa, uma mão, possivelmente sob sol forte e com rede ruim ou inexistente.
- Fluxo: perfis cadastrados uma vez e reutilizados (turmas salvas, "repetir última lista") → selecionar presentes → gerar → ajustar tocando nos jogadores → salvar → registrar placar por set depois do jogo.
- A escalação gerada é mostrada para o grupo na tela do celular.
- Backup é manual (arquivo JSON) porque não existe sincronização entre aparelhos.

## Capabilities and Constraints

- PWA instalável, offline após o primeiro carregamento; dados só em `localStorage` no dispositivo.
- React 19 + Vite + TypeScript, zero dependências de runtime além do React.
- Voleibol recreativo primeiro (formatos 6x6, 4x4, livre; posições e atributos configuráveis); estrutura permite outras modalidades depois.
- Resultados determinísticos: mesma semente + mesmos dados = mesmos times.
- Estimativas são sempre apresentadas como estimativas, nunca garantias; poucos dados devem ser sinalizados.
- Terminologia: jogador/perfil, turma, partida, jogo, set, força, sinergia, confiança, semente.

## Brand Commitments

- Nome fixo: **Equilibrinho**.
- Voz leve, informal, brasileira — clima de pelada/jogo entre amigos — sem perder clareza. Interface em pt-BR.

## Evidence on Hand

Nenhum depoimento, logo oficial ou dado real de partidas ainda. Não inventar números de uso, usuários ou resultados.

## Product Principles

1. Poucos toques na quadra: a tarefa frequente (presentes → times) vence qualquer recurso secundário.
2. O organizador manda: toda sugestão pode ser movida, fixada ou corrigida, e ajustes manuais são preservados.
3. Transparência honesta: mostrar por que, com que confiança e quando ainda faltam dados.
4. Offline e local por padrão; nada depende de rede.
5. Cadastre uma vez, reuse sempre: perfis e turmas são o ponto de partida de cada partida.

## Accessibility & Inclusion

Legibilidade sob luz solar forte e alvos de toque grandes para uso com uma mão em pé; sem requisito formal de norma além disso.
