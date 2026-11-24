/*
   CONFIGURAÇÕES
*/
const API_URL = 'https://pokeapi.co/api/v2/pokemon';
const TOTAL_GEN1 = 151;       // 1ª geração: do #001 Bulbasaur ao #151 Mew
const POR_PAGINA = 20;        // quantos cards carregar por vez
const CHAVE_FAVORITOS = 'pokedex-favoritos';

/*
   ELEMENTOS DO HTML
*/
const lista = document.getElementById('lista-cards');
const mensagem = document.getElementById('mensagem');
const btnCarregar = document.getElementById('btn-carregar');
const campoBusca = document.getElementById('campo-busca');
const infoBusca = document.getElementById('info-busca');
const modal = document.getElementById('modal');
const modalConteudo = document.getElementById('modal-conteudo');
const modalFechar = document.getElementById('modal-fechar');

/*
   ESTADO DA APLICAÇÃO
*/
let listaGen1 = [];        // os 151 com { nome, url, id } (vem da 1ª requisição)
let exibidos = 0;          // quantos Pokémon já foram carregados na lista normal
let carregando = false;    // evita clicar duas vezes em "Carregar mais"
const cache = {};          // dados completos de cada Pokémon, guardados pelo id
let favoritos = lerFavoritos();
let buscaAtual = 0;        // número da busca mais recente (ignora respostas antigas)
let timerBusca = null;
let elementoAntesDoModal = null;

// Traduções simples para exibir em português
const TIPOS_PT = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico',
  grass: 'Planta', ice: 'Gelo', fighting: 'Lutador', poison: 'Venenoso',
  ground: 'Terrestre', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto',
  rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão', dark: 'Sombrio',
  steel: 'Aço', fairy: 'Fada'
};

const STATS_PT = {
  'hp': 'HP',
  'attack': 'Ataque',
  'defense': 'Defesa',
  'special-attack': 'Ataque Esp.',
  'special-defense': 'Defesa Esp.',
  'speed': 'Velocidade'
};

/*
   FUNÇÕES AUXILIARES
*/
function formatarNumero(id) {
  return '#' + String(id).padStart(3, '0'); // 25 -> #025
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// A URL vem assim: https://pokeapi.co/api/v2/pokemon/25/ -> pegamos o 25
function pegarIdDaUrl(url) {
  const partes = url.split('/').filter(function (parte) { return parte !== ''; });
  return Number(partes[partes.length - 1]);
}

// A API manda altura em decímetros e peso em hectogramas, então dividimos por 10
function formatarAltura(alturaDm) {
  return (alturaDm / 10).toLocaleString('pt-BR') + ' m';
}

function formatarPeso(pesoHg) {
  return (pesoHg / 10).toLocaleString('pt-BR') + ' kg';
}

function pegarImagem(pokemon) {
  const oficial = pokemon.sprites.other && pokemon.sprites.other['official-artwork'];
  if (oficial && oficial.front_default) {
    return oficial.front_default;
  }
  return pokemon.sprites.front_default; // imagem pequena, caso a oficial não exista
}

function estaBuscando() {
  return campoBusca.value.trim() !== '';
}

/*
   MENSAGENS DE CARREGAMENTO E ERRO
*/
function mostrarMensagem(texto, tipo) {
  mensagem.innerHTML = '';
  mensagem.className = 'mensagem';
  if (tipo) {
    mensagem.classList.add('mensagem-' + tipo);
  }
  const p = document.createElement('p');
  p.textContent = texto;
  mensagem.appendChild(p);
}

function limparMensagem() {
  mensagem.innerHTML = '';
  mensagem.className = 'mensagem';
}

// Mostra o erro com um botão para tentar de novo
function mostrarErro(texto, funcaoTentarNovamente) {
  mostrarMensagem(texto + ' Verifique sua conexão.', 'erro');
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'btn';
  botao.textContent = 'Tentar novamente';
  botao.addEventListener('click', funcaoTentarNovamente);
  mensagem.appendChild(botao);
}

/*
   CONSUMO DA API (fetch + .then)
*/

// Faz o fetch e já converte a resposta em JSON.
// O fetch só dá erro sozinho se a rede cair, então checamos resposta.ok
// para tratar também erros como 404 ou 500.
function buscarJSON(url) {
  return fetch(url).then(function (resposta) {
    if (!resposta.ok) {
      throw new Error('Erro HTTP ' + resposta.status + ' em ' + url);
    }
    return resposta.json();
  });
}

// Busca os dados completos de um Pokémon (imagem, tipos, altura, peso...).
// Se já buscamos antes, usa o cache e não faz outra requisição.
function buscarDetalhes(item) {
  if (cache[item.id]) {
    return Promise.resolve(cache[item.id]);
  }
  return buscarJSON(item.url).then(function (dados) {
    cache[item.id] = dados;
    return dados;
  });
}

// 1ª requisição: pega a lista dos 151 (só vem nome + url de cada um)
function iniciar() {
  mostrarMensagem('Carregando a Pokédex...', 'carregando');

  buscarJSON(API_URL + '?limit=' + TOTAL_GEN1)
    .then(function (dados) {
      listaGen1 = dados.results.map(function (pokemon) {
        return {
          nome: pokemon.name,
          url: pokemon.url,
          id: pegarIdDaUrl(pokemon.url)
        };
      });

      // Se a pessoa já digitou algo enquanto carregava, faz a busca; senão carrega a 1ª página
      if (estaBuscando()) {
        executarBusca();
      } else {
        carregarProximaPagina();
      }
    })
    .catch(function (erro) {
      console.error(erro);
      mostrarErro('Não foi possível conectar à PokéAPI.', iniciar);
    });
}

// Carrega os próximos 20 Pokémon da lista
function carregarProximaPagina() {
  if (carregando || exibidos >= listaGen1.length) {
    return;
  }

  carregando = true;
  btnCarregar.disabled = true;
  mostrarMensagem('Carregando Pokémon...', 'carregando');

  const lote = listaGen1.slice(exibidos, exibidos + POR_PAGINA);

  // Promise.all dispara as 20 requisições ao mesmo tempo
  // e espera todas terminarem, mantendo a ordem do lote
  Promise.all(lote.map(buscarDetalhes))
    .then(function (pokemons) {
      exibidos += pokemons.length;

      // Se a pessoa começou a buscar no meio do carregamento, não mistura os cards.
      // Os dados ficam no cache e aparecem quando a busca for limpa.
      if (!estaBuscando()) {
        pokemons.forEach(function (pokemon) {
          lista.appendChild(criarCard(pokemon));
        });
        limparMensagem();
        atualizarBotaoCarregar();
      }
    })
    .catch(function (erro) {
      console.error(erro);
      mostrarErro('Erro ao carregar os Pokémon.', carregarProximaPagina);
    })
    .finally(function () {
      carregando = false;
      btnCarregar.disabled = false;
    });
}

function atualizarBotaoCarregar() {
  const acabou = exibidos >= listaGen1.length;
  btnCarregar.hidden = acabou || estaBuscando();

  if (acabou && !estaBuscando()) {
    mostrarMensagem('Você chegou ao fim: esses são todos os 151 Pokémon da 1ª geração!');
  }
}

/*
   CRIAÇÃO DOS CARDS (createElement + appendChild)
*/
function criarBadgesTipos(tipos) {
  const container = document.createElement('div');
  container.className = 'card-tipos';

  tipos.forEach(function (item) {
    const nomeTipo = item.type.name;
    const badge = document.createElement('span');
    badge.className = 'badge tipo-' + nomeTipo;
    badge.textContent = TIPOS_PT[nomeTipo] || nomeTipo;
    container.appendChild(badge);
  });

  return container;
}

function criarCard(pokemon) {
  const tipoPrincipal = pokemon.types[0].type.name;

  // <article class="card tipo-fire">
  const card = document.createElement('article');
  card.className = 'card tipo-' + tipoPrincipal;
  card.tabIndex = 0; // permite abrir com o teclado (Tab + Enter)
  card.setAttribute('aria-label', 'Ver detalhes de ' + capitalizar(pokemon.name));

  // Número no canto esquerdo
  const numero = document.createElement('span');
  numero.className = 'card-numero';
  numero.textContent = formatarNumero(pokemon.id);

  // Coração no canto direito
  const btnFavorito = criarBotaoFavorito(pokemon);

  // Nome
  const nome = document.createElement('h3');
  nome.className = 'card-nome';
  nome.textContent = capitalizar(pokemon.name);

  // Imagem oficial
  const caixaImagem = document.createElement('div');
  caixaImagem.className = 'card-img-box';
  const imagem = document.createElement('img');
  imagem.src = pegarImagem(pokemon);
  imagem.alt = 'Imagem de ' + capitalizar(pokemon.name);
  imagem.loading = 'lazy';
  caixaImagem.appendChild(imagem);

  // Tipos (status)
  const tipos = criarBadgesTipos(pokemon.types);

  // Altura e peso
  const medidas = document.createElement('p');
  medidas.className = 'card-medidas';
  medidas.textContent = 'Altura: ' + formatarAltura(pokemon.height) + ' · Peso: ' + formatarPeso(pokemon.weight);

  // Monta o card colocando cada parte dentro dele
  card.appendChild(numero);
  card.appendChild(btnFavorito);
  card.appendChild(nome);
  card.appendChild(caixaImagem);
  card.appendChild(tipos);
  card.appendChild(medidas);

  // Clique (ou Enter) abre o modal com os dados que já temos
  card.addEventListener('click', function () {
    abrirModal(pokemon);
  });
  card.addEventListener('keydown', function (evento) {
    if (evento.key === 'Enter' && evento.target === card) {
      abrirModal(pokemon);
    }
  });

  return card;
}

/*
   FAVORITOS (localStorage)
*/
function lerFavoritos() {
  try {
    const salvos = localStorage.getItem(CHAVE_FAVORITOS);
    return salvos ? JSON.parse(salvos) : [];
  } catch (erro) {
    // Alguns navegadores bloqueiam o localStorage (ex: modo privado)
    console.warn('Não foi possível ler os favoritos:', erro);
    return [];
  }
}

function salvarFavoritos() {
  try {
    localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(favoritos));
  } catch (erro) {
    console.warn('Não foi possível salvar os favoritos:', erro);
  }
}

function ehFavorito(id) {
  return favoritos.includes(id);
}

function alternarFavorito(id) {
  if (ehFavorito(id)) {
    favoritos = favoritos.filter(function (favId) { return favId !== id; });
  } else {
    favoritos.push(id);
  }
  salvarFavoritos();

  // Atualiza todos os corações desse Pokémon (o do card e o do modal, se estiver aberto)
  document.querySelectorAll('.btn-favorito[data-id="' + id + '"]').forEach(atualizarVisualFavorito);
}

function atualizarVisualFavorito(botao) {
  const id = Number(botao.dataset.id);
  const ativo = ehFavorito(id);
  botao.classList.toggle('ativo', ativo);
  botao.setAttribute('aria-pressed', ativo);
  botao.title = ativo ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
}

function criarBotaoFavorito(pokemon) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'btn-favorito';
  botao.dataset.id = pokemon.id;
  botao.textContent = '♥';
  botao.setAttribute('aria-label', 'Favoritar ' + capitalizar(pokemon.name));
  atualizarVisualFavorito(botao);

  botao.addEventListener('click', function (evento) {
    evento.stopPropagation(); // impede que o clique no coração abra o modal
    alternarFavorito(pokemon.id);
  });

  return botao;
}

/*
   BUSCA POR NOME OU NÚMERO
*/

// Espera a pessoa parar de digitar por 300ms antes de buscar
campoBusca.addEventListener('input', function () {
  clearTimeout(timerBusca);
  timerBusca = setTimeout(executarBusca, 300);
});

function executarBusca() {
  const termo = campoBusca.value.trim().toLowerCase();
  buscaAtual++;
  const estaBusca = buscaAtual;

  if (termo === '') {
    voltarParaLista();
    return;
  }

  // A lista dos 151 ainda não chegou: a busca roda quando ela chegar (ver iniciar)
  if (listaGen1.length === 0) {
    return;
  }

  // Aceita nome parcial ("char") ou número ("25", "025", "#25")
  const numero = Number(termo.replace('#', ''));
  const encontrados = listaGen1.filter(function (item) {
    return item.nome.includes(termo) || item.id === numero;
  });

  lista.innerHTML = '';
  btnCarregar.hidden = true;

  if (encontrados.length === 0) {
    infoBusca.textContent = '';
    mostrarMensagem('Nenhum Pokémon da 1ª geração encontrado para "' + termo + '".');
    return;
  }

  // Mostra no máximo 20 resultados para não disparar requisições demais
  const resultados = encontrados.slice(0, POR_PAGINA);
  if (encontrados.length > POR_PAGINA) {
    infoBusca.textContent = 'Mostrando ' + POR_PAGINA + ' de ' + encontrados.length + ' resultados. Digite mais letras para refinar.';
  } else {
    infoBusca.textContent = encontrados.length + ' resultado(s) encontrado(s).';
  }

  mostrarMensagem('Buscando...', 'carregando');

  Promise.all(resultados.map(buscarDetalhes))
    .then(function (pokemons) {
      // Se a pessoa já digitou outra coisa, essa resposta é antiga: ignora
      if (estaBusca !== buscaAtual) {
        return;
      }
      limparMensagem();
      pokemons.forEach(function (pokemon) {
        lista.appendChild(criarCard(pokemon));
      });
    })
    .catch(function (erro) {
      if (estaBusca !== buscaAtual) {
        return;
      }
      console.error(erro);
      mostrarErro('Erro ao buscar os Pokémon.', executarBusca);
    });
}

// Ao limpar a busca, remonta a lista normal usando o cache (sem novas requisições)
function voltarParaLista() {
  infoBusca.textContent = '';
  limparMensagem();
  lista.innerHTML = '';

  if (exibidos === 0) {
    carregarProximaPagina();
    return;
  }

  listaGen1.slice(0, exibidos).forEach(function (item) {
    lista.appendChild(criarCard(cache[item.id]));
  });
  atualizarBotaoCarregar();
}

/*
   MODAL DE DETALHES
   (reaproveita os dados que já estão no cache)
*/
function criarLinhaStat(stat) {
  const linha = document.createElement('div');
  linha.className = 'stat';

  const nome = document.createElement('span');
  nome.textContent = STATS_PT[stat.stat.name] || stat.stat.name;

  const valor = document.createElement('span');
  valor.className = 'stat-valor';
  valor.textContent = stat.base_stat;

  const barra = document.createElement('div');
  barra.className = 'stat-barra';
  const preenchimento = document.createElement('div');
  preenchimento.className = 'stat-preenchimento';
  // 200 como referência de "barra cheia" (o máximo real é 255, mas quase nenhum da 1ª geração chega perto)
  preenchimento.style.width = Math.min((stat.base_stat / 200) * 100, 100) + '%';
  barra.appendChild(preenchimento);

  linha.appendChild(nome);
  linha.appendChild(valor);
  linha.appendChild(barra);
  return linha;
}

function criarInfo(rotulo, texto) {
  const caixa = document.createElement('div');
  const span = document.createElement('span');
  span.textContent = rotulo;
  const strong = document.createElement('strong');
  strong.textContent = texto;
  caixa.appendChild(span);
  caixa.appendChild(strong);
  return caixa;
}

function abrirModal(pokemon) {
  modalConteudo.innerHTML = '';
  const tipoPrincipal = pokemon.types[0].type.name;

  // Parte de cima: número e imagem grande
  const topo = document.createElement('div');
  topo.className = 'modal-topo tipo-' + tipoPrincipal;

  const numero = document.createElement('p');
  numero.className = 'modal-numero';
  numero.textContent = formatarNumero(pokemon.id);

  const imagem = document.createElement('img');
  imagem.src = pegarImagem(pokemon);
  imagem.alt = 'Imagem de ' + capitalizar(pokemon.name);

  topo.appendChild(numero);
  topo.appendChild(imagem);

  // Corpo: nome, tipos, medidas, habilidades e status
  const corpo = document.createElement('div');
  corpo.className = 'modal-corpo';

  const linhaTitulo = document.createElement('div');
  linhaTitulo.className = 'modal-titulo-linha';
  const titulo = document.createElement('h2');
  titulo.id = 'modal-titulo';
  titulo.textContent = capitalizar(pokemon.name);
  linhaTitulo.appendChild(titulo);
  linhaTitulo.appendChild(criarBotaoFavorito(pokemon));

  const info = document.createElement('div');
  info.className = 'modal-info';
  info.appendChild(criarInfo('Altura', formatarAltura(pokemon.height)));
  info.appendChild(criarInfo('Peso', formatarPeso(pokemon.weight)));

  const tituloHabilidades = document.createElement('h3');
  tituloHabilidades.textContent = 'Habilidades';
  const habilidades = document.createElement('p');
  habilidades.className = 'modal-habilidades';
  habilidades.textContent = pokemon.abilities.map(function (item) {
    const nome = item.ability.name.split('-').join(' ');
    return item.is_hidden ? nome + ' (oculta)' : nome;
  }).join(', ');

  const tituloStats = document.createElement('h3');
  tituloStats.textContent = 'Status base';
  const stats = document.createElement('div');
  pokemon.stats.forEach(function (stat) {
    stats.appendChild(criarLinhaStat(stat));
  });

  corpo.appendChild(linhaTitulo);
  corpo.appendChild(criarBadgesTipos(pokemon.types));
  corpo.appendChild(info);
  corpo.appendChild(tituloHabilidades);
  corpo.appendChild(habilidades);
  corpo.appendChild(tituloStats);
  corpo.appendChild(stats);

  modalConteudo.appendChild(topo);
  modalConteudo.appendChild(corpo);

  // Guarda quem estava focado para devolver o foco ao fechar
  elementoAntesDoModal = document.activeElement;
  modal.hidden = false;
  document.body.classList.add('sem-rolagem');
  modalFechar.focus();
}

function fecharModal() {
  modal.hidden = true;
  document.body.classList.remove('sem-rolagem');
  if (elementoAntesDoModal) {
    elementoAntesDoModal.focus();
  }
}

// Formas de fechar: botão X, clique fora da caixa e tecla Esc
modalFechar.addEventListener('click', fecharModal);

modal.addEventListener('click', function (evento) {
  if (evento.target === modal) {
    fecharModal();
  }
});

document.addEventListener('keydown', function (evento) {
  if (evento.key === 'Escape' && !modal.hidden) {
    fecharModal();
  }
});

/*
   INÍCIO
*/
btnCarregar.addEventListener('click', carregarProximaPagina);

iniciar();
