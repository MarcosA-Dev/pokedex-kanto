# Pokédex Kanto

Aplicação front-end estática que consome a [PokéAPI](https://pokeapi.co/) e exibe os 151 Pokémon da 1ª geração em cards criados dinamicamente com JavaScript.

🔗 **Acesse:** https://marcosa-dev.github.io/pokedex-kanto/

Projeto desenvolvido para a disciplina de **Web Development Front-End** da **UniFECAF**.

## Funcionalidades

- Cards gerados dinamicamente com `createElement` e `appendChild` (nenhum card fixo no HTML)
- Cada card mostra número, nome, imagem oficial, tipos e altura/peso
- Paginação de 20 em 20 com o botão "Carregar mais"
- Busca por nome ou número (ex: `pikachu`, `25`)
- Favoritos com o coração, salvos no `localStorage`
- Modal com detalhes: habilidades e status base
- Mensagens de carregamento e de erro (com botão para tentar novamente)
- Layout responsivo (celular, tablet e desktop)

## Tecnologias

- HTML5
- CSS3 (Grid, Flexbox e media queries)
- JavaScript puro (`fetch` com `.then()`)
- Nenhum framework ou biblioteca

## Como funciona o consumo da API

1. Uma primeira requisição busca a lista dos 151 Pokémon (`/pokemon?limit=151`), que retorna apenas o nome e a URL de cada um.
2. Para cada lote de 20, o `Promise.all` busca os detalhes de cada Pokémon (imagem, tipos, medidas e status).
3. Os dados ficam guardados em cache, então o modal e a busca reaproveitam o que já foi carregado sem fazer novas requisições.

A PokéAPI é gratuita e não exige cadastro nem token.

## Estrutura

```
pokedex-kanto/
├── index.html
├── css/
│   └── style.css
└── js/
    └── script.js
```

## Como rodar localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/marcosa-dev/pokedex-kanto.git
   ```
2. Abra o `index.html` no navegador (ou use a extensão Live Server no VS Code).

## Créditos

Dados e imagens fornecidos pela [PokéAPI](https://pokeapi.co/). Pokémon e seus personagens são marcas registradas da Nintendo, Game Freak e The Pokémon Company. Este é um projeto acadêmico, sem fins comerciais.