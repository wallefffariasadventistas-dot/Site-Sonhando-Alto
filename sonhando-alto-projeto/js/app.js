/* =========================================================
   CONFIGURAÇÃO FIREBASE
   Substitua pelos dados do seu projeto Firebase
   (o mesmo projeto que você já usa nos outros sistemas
   pode ser reaproveitado, criando apenas uma nova collection)
========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyAih-t5qRgSpGkWyDtrel70sFPghzw_5z8",
  authDomain: "controle-financeiro-31aac.firebaseapp.com",
  projectId: "controle-financeiro-31aac",
  storageBucket: "controle-financeiro-31aac.firebasestorage.app",
  messagingSenderId: "756936583784",
  appId: "1:756936583784:web:cc595b2b5ae1fcb8f429dd",
  measurementId: "G-J6L2TFHM1T"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const COLLECTION = "inscricoes_sonhandoalto";
const LIDERES_COLLECTION = "lideres_sonhandoalto";
const LEADS_COLLECTION = "leads_sonhandoalto";
const ESTUDANTES_COLLECTION = "estudantes_sonhandoalto";
const FORMADOS_COLLECTION = "formados_sonhandoalto";
const CONFIG_COLLECTION = "configuracoes_sonhandoalto";
const FERIAS_COLLECTION = "inscricoes_feriasuniversitaria";

/* =========================================================
   E-MAILS AUTORIZADOS A ACESSAR O PAINEL ADMIN
   Adicione aqui o e-mail de cada líder de confiança
========================================================= */
const ALLOWED_ADMIN_EMAILS = [
  "walleff.fariasadventistas@gmail.com"
];

/* =========================================================
   ROTEAMENTO SIMPLES: ?admin=1 abre a área administrativa
========================================================= */
const isAdminRoute = new URLSearchParams(window.location.search).get('admin') === '1';

const viewForm = document.getElementById('viewForm');
const viewAdminLogin = document.getElementById('viewAdminLogin');
const viewAdmin = document.getElementById('viewAdmin');

if (isAdminRoute) {
  viewForm.classList.add('hidden');
  auth.onAuthStateChanged(user => {
    if (user && ALLOWED_ADMIN_EMAILS.includes(user.email)) {
      showAdminPanel();
    } else if (user) {
      auth.signOut();
      viewAdminLogin.classList.remove('hidden');
      document.getElementById('loginMsgArea').innerHTML =
        `<div class="msg-banner error">Esse e-mail (${user.email}) não tem acesso ao painel. Fale com o administrador.</div>`;
    } else {
      viewAdminLogin.classList.remove('hidden');
    }
  });
} else {
  // Conta uma visita cada vez que a página pública é aberta, e identifica a origem do clique
  const origemAcesso = detectarOrigemAcesso();
  const hojeStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  db.collection('stats').doc('visitas').set({
    total: firebase.firestore.FieldValue.increment(1),
    ultimaVisita: firebase.firestore.FieldValue.serverTimestamp(),
    [`porOrigem.${origemAcesso}`]: firebase.firestore.FieldValue.increment(1)
  }, { merge: true }).catch(() => {});

  db.collection('stats_diario').doc(hojeStr).set({
    data: hojeStr,
    total: firebase.firestore.FieldValue.increment(1),
    [`porOrigem.${origemAcesso}`]: firebase.firestore.FieldValue.increment(1)
  }, { merge: true }).catch(() => {});
}

/* Identifica de onde veio o clique no link: por parâmetro na URL (mais confiável,
   ex: ?origem=whatsapp) ou, na falta dele, pelo referrer do navegador. */
function detectarOrigemAcesso(){
  const params = new URLSearchParams(window.location.search);
  const porParametro = (params.get('origem') || params.get('utm_source') || '').trim().toLowerCase();
  if(porParametro) return normalizarOrigem(porParametro);

  const ref = (document.referrer || '').toLowerCase();
  if(!ref) return 'direto';
  if(ref.includes('instagram.com')) return 'instagram';
  if(ref.includes('whatsapp.com') || ref.includes('wa.me') || ref.includes('api.whatsapp')) return 'whatsapp';
  if(ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('l.messenger.com')) return 'facebook';
  if(ref.includes('google.')) return 'google';
  if(ref.includes('t.co') || ref.includes('twitter.com') || ref.includes('x.com')) return 'twitter';
  return 'outros';
}

function normalizarOrigem(valor){
  const mapa = {
    wa: 'whatsapp', whats: 'whatsapp', whatsapp: 'whatsapp',
    ig: 'instagram', insta: 'instagram', instagram: 'instagram',
    fb: 'facebook', face: 'facebook', facebook: 'facebook',
    google: 'google',
    twitter: 'twitter', x: 'twitter'
  };
  return mapa[valor] || valor.replace(/[^a-z0-9-]/g, '') || 'outros';
}

/* =========================================================
   MÁSCARAS DE CAMPOS
========================================================= */
function maskCPF(v){
  v = v.replace(/\D/g,'').slice(0,11);
  v = v.replace(/(\d{3})(\d)/,'$1.$2');
  v = v.replace(/(\d{3})(\d)/,'$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  return v;
}
function maskPhone(v){
  v = v.replace(/\D/g,'').slice(0,11);
  if(v.length > 10) v = v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');
  else if(v.length > 6) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
  else if(v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/,'($1) $2');
  else v = v.replace(/(\d*)/,'($1');
  return v;
}
function maskCEP(v){
  v = v.replace(/\D/g,'').slice(0,8);
  v = v.replace(/(\d{5})(\d{1,3})/,'$1-$2');
  return v;
}

/* Busca endereço automaticamente pelo CEP (API pública ViaCEP) e preenche
   os campos de cidade, endereço e bairro do mesmo formulário (prefix). */
async function buscarEnderecoPorCEP(prefix){
  const cepInput = document.getElementById(`${prefix}_cep`);
  const cidadeInput = document.getElementById(`${prefix}_cidade`);
  const enderecoInput = document.getElementById(`${prefix}_endereco`);
  const bairroInput = document.getElementById(`${prefix}_bairro`);
  if(!cepInput) return;

  const cepLimpo = cepInput.value.replace(/\D/g,'');
  if(cepLimpo.length !== 8) return;

  cepInput.style.opacity = '0.6';
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await resp.json();
    if(!data.erro){
      if(cidadeInput && data.localidade) cidadeInput.value = data.uf ? `${data.localidade} - ${data.uf}` : data.localidade;
      if(enderecoInput && data.logradouro) enderecoInput.value = data.logradouro;
      if(bairroInput && data.bairro) bairroInput.value = data.bairro;
    }
  } catch(err){
    // Falha silenciosa: se a busca não funcionar, a pessoa preenche manualmente
  }
  cepInput.style.opacity = '1';
}

document.getElementById('f_cpf')?.addEventListener('input', e=> e.target.value = maskCPF(e.target.value));
document.getElementById('f_whatsapp')?.addEventListener('input', e=> e.target.value = maskPhone(e.target.value));
document.getElementById('f_cep')?.addEventListener('input', e=> {
  e.target.value = maskCEP(e.target.value);
  buscarEnderecoPorCEP('f');
});

/* =========================================================
   VALIDAÇÃO E ENVIO DO FORMULÁRIO
========================================================= */
function isValidCPF(cpf){
  cpf = cpf.replace(/\D/g,'');
  if(cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum=0, rest;
  for(let i=1;i<=9;i++) sum += parseInt(cpf.substring(i-1,i)) * (11-i);
  rest = (sum*10) % 11; if(rest===10||rest===11) rest=0;
  if(rest !== parseInt(cpf.substring(9,10))) return false;
  sum=0;
  for(let i=1;i<=10;i++) sum += parseInt(cpf.substring(i-1,i)) * (12-i);
  rest = (sum*10) % 11; if(rest===10||rest===11) rest=0;
  if(rest !== parseInt(cpf.substring(10,11))) return false;
  return true;
}
function isValidEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function showFieldError(scopeId, name, show){
  const el = document.querySelector(`#${scopeId} [data-field="${name}"]`);
  if(el) el.classList.toggle('error', show);
}

function coletarDados(prefix){
  return {
    nome: document.getElementById(`${prefix}_nome`).value.trim(),
    nascimento: document.getElementById(`${prefix}_nascimento`).value,
    estadoCivil: document.getElementById(`${prefix}_estadoCivil`).value,
    cpf: document.getElementById(`${prefix}_cpf`).value.trim(),
    rg: document.getElementById(`${prefix}_rg`).value.trim(),
    escolaridade: document.getElementById(`${prefix}_escolaridade`).value,
    email: document.getElementById(`${prefix}_email`).value.trim(),
    whatsapp: document.getElementById(`${prefix}_whatsapp`).value.trim(),
    cep: document.getElementById(`${prefix}_cep`).value.trim(),
    cidade: document.getElementById(`${prefix}_cidade`).value.trim(),
    distritoPastoral: document.getElementById(`${prefix}_distritoPastoral`).value,
    endereco: document.getElementById(`${prefix}_endereco`).value.trim(),
    bairro: document.getElementById(`${prefix}_bairro`).value.trim(),
    nomePai: document.getElementById(`${prefix}_nomePai`).value.trim(),
    nomeMae: document.getElementById(`${prefix}_nomeMae`).value.trim(),
    camisa: document.getElementById(`${prefix}_camisa`).value
  };
}

function validarDados(vals){
  return [
    ['nome', vals.nome.length >= 3],
    ['nascimento', !!vals.nascimento],
    ['estadoCivil', !!vals.estadoCivil],
    ['cpf', isValidCPF(vals.cpf)],
    ['rg', vals.rg.length >= 4],
    ['escolaridade', !!vals.escolaridade],
    ['email', isValidEmail(vals.email)],
    ['whatsapp', vals.whatsapp.replace(/\D/g,'').length >= 10],
    ['cep', vals.cep.replace(/\D/g,'').length === 8],
    ['cidade', vals.cidade.length >= 2],
    ['distritoPastoral', !!vals.distritoPastoral],
    ['endereco', vals.endereco.length >= 3],
    ['bairro', vals.bairro.length >= 2],
    ['nomeMae', vals.nomeMae.length >= 3],
    ['camisa', !!vals.camisa]
  ];
}

function limparCampos(prefix){
  ['nome','nascimento','estadoCivil','cpf','rg','escolaridade','email','whatsapp','cep','cidade','distritoPastoral','endereco','bairro','nomePai','nomeMae','camisa'].forEach(f=>{
    const el = document.getElementById(`${prefix}_${f}`);
    if(el) el.value='';
  });
}

/* Gera o HTML dos campos do formulário (reaproveitado nas abas de cadastro do admin) */
function buildCamposHTML(prefix){
  return `
    <div class="section-title">Dados pessoais</div>

    <div class="field" data-field="nome">
      <label>Nome completo</label>
      <input type="text" id="${prefix}_nome" autocomplete="name">
      <div class="err-msg">Informe o nome completo.</div>
    </div>

    <div class="row2">
      <div class="field" data-field="nascimento">
        <label>Data de nascimento</label>
        <input type="date" id="${prefix}_nascimento">
        <div class="err-msg">Informe a data de nascimento.</div>
      </div>
      <div class="field" data-field="estadoCivil">
        <label>Estado civil</label>
        <select id="${prefix}_estadoCivil">
          <option value="">Selecione</option>
          <option>Solteiro(a)</option>
          <option>Casado(a)</option>
          <option>Divorciado(a)</option>
          <option>Viúvo(a)</option>
          <option>União estável</option>
        </select>
        <div class="err-msg">Selecione o estado civil.</div>
      </div>
    </div>

    <div class="row2">
      <div class="field" data-field="cpf">
        <label>CPF</label>
        <input type="text" id="${prefix}_cpf" inputmode="numeric" placeholder="000.000.000-00" maxlength="14">
        <div class="err-msg">CPF inválido. Use o formato 000.000.000-00.</div>
      </div>
      <div class="field" data-field="rg">
        <label>RG</label>
        <input type="text" id="${prefix}_rg" placeholder="00.000.000-0">
        <div class="err-msg">Informe o RG.</div>
      </div>
    </div>

    <div class="field" data-field="escolaridade">
      <label>Escolaridade</label>
      <select id="${prefix}_escolaridade">
        <option value="">Selecione</option>
        <option>Fundamental incompleto</option>
        <option>Fundamental completo</option>
        <option>Médio incompleto</option>
        <option>Médio completo</option>
        <option>Superior incompleto</option>
        <option>Superior completo</option>
        <option>Pós-graduação</option>
      </select>
      <div class="err-msg">Selecione a escolaridade.</div>
    </div>

    <div class="section-title">Contato</div>

    <div class="field" data-field="email">
      <label>E-mail</label>
      <input type="email" id="${prefix}_email" autocomplete="email" placeholder="nome@exemplo.com">
      <div class="err-msg">Informe um e-mail válido.</div>
    </div>

    <div class="field" data-field="whatsapp">
      <label>Telefone WhatsApp</label>
      <input type="text" id="${prefix}_whatsapp" inputmode="numeric" placeholder="(00) 00000-0000" maxlength="15">
      <div class="err-msg">Informe um telefone válido com DDD.</div>
    </div>

    <div class="section-title">Endereço</div>

    <div class="row2">
      <div class="field" data-field="cep">
        <label>CEP</label>
        <input type="text" id="${prefix}_cep" inputmode="numeric" placeholder="00000-000" maxlength="9">
        <div class="err-msg">Informe um CEP válido.</div>
      </div>
      <div class="field" data-field="cidade">
        <label>Cidade</label>
        <input type="text" id="${prefix}_cidade">
        <div class="err-msg">Informe a cidade.</div>
      </div>
    </div>

    <div class="field" data-field="distritoPastoral">
      <label>Distrito Pastoral</label>
      <select id="${prefix}_distritoPastoral">
        <option value="">Selecione o distrito</option>
        <option>Aeroporto – PI</option>
        <option>Agricolândia</option>
        <option>Além Rio</option>
        <option>Boa Esperança – Parnaíba</option>
        <option>Bom Jesus</option>
        <option>Campo Maior</option>
        <option>Central Teresina</option>
        <option>Dirceu Arco Verde</option>
        <option>Floriano</option>
        <option>Guadalupe</option>
        <option>José de Freitas</option>
        <option>Luzilândia</option>
        <option>Monte Castelo</option>
        <option>Parnaíba</option>
        <option>Parque Ideal</option>
        <option>Parque Piauí</option>
        <option>Passagem das Pedras – Picos</option>
        <option>Picos</option>
        <option>Piripiri</option>
        <option>Porto Alegre</option>
        <option>Primavera</option>
        <option>Promorar</option>
        <option>São Raimundo Nonato</option>
        <option>Teresina Leste</option>
      </select>
      <div class="err-msg">Selecione o distrito pastoral.</div>
    </div>

    <div class="field" data-field="endereco">
      <label>Endereço (rua, número)</label>
      <input type="text" id="${prefix}_endereco">
      <div class="err-msg">Informe o endereço.</div>
    </div>

    <div class="field" data-field="bairro">
      <label>Bairro</label>
      <input type="text" id="${prefix}_bairro">
      <div class="err-msg">Informe o bairro.</div>
    </div>

    <div class="section-title">Dados da família</div>

    <div class="field" data-field="nomePai">
      <label>Nome do pai</label>
      <input type="text" id="${prefix}_nomePai" placeholder="Deixe em branco se não souber">
    </div>

    <div class="field" data-field="nomeMae">
      <label>Nome da mãe</label>
      <input type="text" id="${prefix}_nomeMae">
      <div class="err-msg">Informe o nome da mãe.</div>
    </div>

    <div class="section-title">Outros</div>

    <div class="field" data-field="camisa">
      <label>Tamanho de camisa</label>
      <select id="${prefix}_camisa">
        <option value="">Selecione</option>
        <option>PP</option>
        <option>P</option>
        <option>M</option>
        <option>G</option>
        <option>GG</option>
        <option>XG</option>
      </select>
      <div class="err-msg">Selecione o tamanho da camisa.</div>
    </div>
  `;
}

function attachMasks(prefix){
  document.getElementById(`${prefix}_cpf`)?.addEventListener('input', e=> e.target.value = maskCPF(e.target.value));
  document.getElementById(`${prefix}_whatsapp`)?.addEventListener('input', e=> e.target.value = maskPhone(e.target.value));
  document.getElementById(`${prefix}_cep`)?.addEventListener('input', e=> {
    e.target.value = maskCEP(e.target.value);
    buscarEnderecoPorCEP(prefix);
  });
}

function calcIdade(dataNasc){
  const hoje = new Date(); const nasc = new Date(dataNasc);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if(m < 0 || (m===0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

/* =========================================================
   FORMULÁRIO PÚBLICO EM ETAPAS (uma pergunta por vez)
========================================================= */
const DISTRITOS_PASTORAIS = [
  'Aeroporto – PI','Agricolândia','Além Rio','Boa Esperança – Parnaíba','Bom Jesus','Campo Maior',
  'Central Teresina','Dirceu Arco Verde','Floriano','Guadalupe','José de Freitas','Luzilândia',
  'Monte Castelo','Parnaíba','Parque Ideal','Parque Piauí','Passagem das Pedras – Picos','Picos',
  'Piripiri','Porto Alegre','Primavera','Promorar','São Raimundo Nonato','Teresina Leste'
];

const PASTORES_POR_DISTRITO = {
  'Aeroporto – PI': 'Emerson Paulo da Silva',
  'Agricolândia': 'Gean da Silva Gonçalves',
  'Além Rio': 'Diomedio Rodrigues de Sousa Neto',
  'Boa Esperança – Parnaíba': 'José Gomes da Silva',
  'Bom Jesus': 'Paulo Henrique Anastacio Aderaldo',
  'Campo Maior': 'Otanio Caetano Damasceno',
  'Central Teresina': 'Eduardo Matheus Ferreira Chateaubriand',
  'Dirceu Arco Verde': 'Tarcisio de Lima Pereira',
  'Floriano': 'Neurismar Bento Santos',
  'Guadalupe': 'Antonio Saulo de Araujo',
  'José de Freitas': 'Carlos André Ferreira de Oliveira',
  'Luzilândia': 'Maciel Ribeiro dos Santos',
  'Monte Castelo': 'David Vieira Barros',
  'Parnaíba': 'Mizael Almeida Cavalcanti',
  'Parque Ideal': 'Pedro Saulo Jacinto da Silva',
  'Parque Piauí': 'Lucas Rodrigues da Silva Rocha',
  'Passagem das Pedras – Picos': 'Carlos Wanderlan Arruda do Nascimento',
  'Picos': 'Alison Renally Moura do Nascimento',
  'Piripiri': 'Matheus Yure dos Santos',
  'Porto Alegre': 'Kevin Elvis Rodriguez Lucano',
  'Primavera': 'Cid Gouveia',
  'Promorar': 'Marcos Delgado da Silva',
  'São Raimundo Nonato': 'Raniele Gonçalves Costa',
  'Teresina Leste': 'Mario Luiz Frere'
};

const FORM_STEPS = [
  ['projeto'],
  ['nome'],
  ['nascimento', 'estadoCivil'],
  ['cpf', 'rg'],
  ['escolaridade'],
  ['email'],
  ['whatsapp'],
  ['cep', 'cidade'],
  ['distritoPastoral'],
  ['endereco'],
  ['bairro'],
  ['nomePai'],
  ['nomeMae'],
  ['camisa']
];
let stepAtualInscricao = 1;
let jaMostrouStepInscricaoAntes = false;

/* Botões de escolha do projeto (Sonhando Alto / Férias Universitária) */
document.querySelectorAll('.projeto-opcao').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.projeto-opcao').forEach(b => b.classList.remove('selecionado'));
    btn.classList.add('selecionado');
    const select = document.getElementById('f_projeto');
    select.value = btn.dataset.valor;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
});

function mostrarStepInscricao(n){
  const steps = document.querySelectorAll('#inscricaoForm .form-step');
  const total = steps.length;
  steps.forEach(s => s.classList.toggle('hidden', parseInt(s.dataset.step, 10) !== n));
  steps.forEach(s => s.classList.remove('avancando'));
  document.getElementById('formProgressSpinner')?.classList.remove('ativo');

  const bar = document.getElementById('formProgressBar');
  if(bar) bar.style.width = (n / total * 100) + '%';

  const btnVoltar = document.getElementById('btnStepVoltar');
  const btnEnviar = document.getElementById('btnSubmit');
  const ultimo = (n === total);
  if(btnVoltar) btnVoltar.style.visibility = (n === 1) ? 'hidden' : 'visible';
  if(btnEnviar) btnEnviar.classList.toggle('hidden', !ultimo);

  document.getElementById('formMsgArea').innerHTML = '';
  const form = document.getElementById('inscricaoForm');
  /* só rola a tela até o formulário quando o usuário já está interagindo
     (avançando/voltando etapas) — não na primeira vez que a página carrega */
  if(form && jaMostrouStepInscricaoAntes) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  jaMostrouStepInscricaoAntes = true;

  if(!ultimo) conectarAutoAvancoDoStep(n, 'inscricao');
}

function validarStepInscricao(n){
  const camposDoStep = FORM_STEPS[n - 1];
  const vals = coletarDados('f');
  const checks = validarDados(vals).filter(([nome]) => camposDoStep.includes(nome));
  if(camposDoStep.includes('projeto')){
    checks.push(['projeto', !!document.getElementById('f_projeto')?.value]);
  }
  let valido = true;
  checks.forEach(([nome, ok]) => { showFieldError('inscricaoForm', nome, !ok); if(!ok) valido = false; });
  if(!valido){
    document.querySelector('#inscricaoForm .form-step:not(.hidden) .field.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return valido;
}

function stepInscricaoValidoSilencioso(n){
  const camposDoStep = FORM_STEPS[n - 1];
  const vals = coletarDados('f');
  let ok = validarDados(vals).filter(([nome]) => camposDoStep.includes(nome)).every(([, valido]) => valido);
  if(camposDoStep.includes('projeto')){
    ok = ok && !!document.getElementById('f_projeto')?.value;
  }
  return ok;
}

document.getElementById('btnStepVoltar')?.addEventListener('click', () => {
  cancelarAutoAvanco();
  if(stepAtualInscricao > 1){
    stepAtualInscricao--;
    mostrarStepInscricao(stepAtualInscricao);
  }
});

/* =========================================================
   AVANÇO AUTOMÁTICO ENTRE PERGUNTAS
   Ao terminar de responder, o sistema aguarda um instante
   (dando a impressão de "carregando") e passa sozinho para
   a próxima pergunta — sem precisar de botão "Próxima".
========================================================= */
let timerAutoAvanco = null;

function cancelarAutoAvanco(){
  clearTimeout(timerAutoAvanco);
  document.querySelectorAll('.form-step.avancando').forEach(s => s.classList.remove('avancando'));
  document.querySelectorAll('.form-progress-spinner.ativo').forEach(s => s.classList.remove('ativo'));
}

function conectarAutoAvancoDoStep(n, tipo){
  const scope = tipo === 'inscricao' ? '#inscricaoForm' : '.leads-card';
  const stepEl = document.querySelector(`${scope} .form-step[data-step="${n}"]`);
  if(!stepEl || stepEl.dataset.jaConectou === '1') return;
  stepEl.dataset.jaConectou = '1';

  const campos = Array.from(stepEl.querySelectorAll('input, select'));
  campos.forEach(campo => {
    const eventoFinal = (campo.tagName === 'SELECT' || campo.type === 'date') ? 'change' : 'input';
    campo.addEventListener(eventoFinal, () => {
      const stepAtual = tipo === 'inscricao' ? stepAtualInscricao : stepAtualLead;
      if(stepAtual !== n) return;
      cancelarAutoAvanco();

      const valido = tipo === 'inscricao' ? stepInscricaoValidoSilencioso(n) : stepLeadValidoSilencioso(n);
      if(!valido) return;

      const bar = document.getElementById(tipo === 'inscricao' ? 'formProgressBar' : 'leadProgressBar');
      const spinner = document.getElementById(tipo === 'inscricao' ? 'formProgressSpinner' : 'leadProgressSpinner');
      stepEl.classList.add('avancando');
      if(spinner && bar){
        spinner.style.left = bar.style.width;
        spinner.classList.add('ativo');
      }
      const atraso = 2000;
      timerAutoAvanco = setTimeout(() => {
        stepEl.classList.remove('avancando');
        spinner?.classList.remove('ativo');
        if(tipo === 'inscricao'){
          if(stepAtualInscricao === n && stepAtualInscricao < FORM_STEPS.length){
            stepAtualInscricao++;
            mostrarStepInscricao(stepAtualInscricao);
          }
        } else {
          if(stepAtualLead === n && stepAtualLead < LEAD_STEPS.length){
            stepAtualLead++;
            mostrarStepLead(stepAtualLead);
          }
        }
      }, atraso);
    });
  });
}

/* Enter no teclado avança imediatamente para a próxima pergunta (sem esperar) */
document.getElementById('inscricaoForm')?.addEventListener('keydown', e => {
  if(e.key === 'Enter' && e.target.tagName !== 'TEXTAREA'){
    e.preventDefault();
    cancelarAutoAvanco();
    if(stepAtualInscricao < FORM_STEPS.length){
      if(validarStepInscricao(stepAtualInscricao)){
        stepAtualInscricao++;
        mostrarStepInscricao(stepAtualInscricao);
      }
    } else {
      document.getElementById('btnSubmit')?.click();
    }
  }
});

if(document.getElementById('inscricaoForm')){
  mostrarStepInscricao(1);
}

const inscricaoForm = document.getElementById('inscricaoForm');
if(inscricaoForm){
  inscricaoForm.addEventListener('submit', async function(e){
    e.preventDefault();
    const vals = coletarDados('f');
    const projeto = document.getElementById('f_projeto').value;
    const checks = validarDados(vals);
    checks.push(['projeto', !!projeto]);
    let valid = true;
    checks.forEach(([name, ok]) => { showFieldError('inscricaoForm', name, !ok); if(!ok) valid = false; });

    const msgArea = document.getElementById('formMsgArea');
    msgArea.innerHTML = '';
    if(!valid){
      const primeiroInvalido = checks.find(([, ok]) => !ok)?.[0];
      const stepComErro = FORM_STEPS.findIndex(campos => campos.includes(primeiroInvalido)) + 1;
      if(stepComErro > 0 && stepComErro !== stepAtualInscricao){
        stepAtualInscricao = stepComErro;
        mostrarStepInscricao(stepAtualInscricao);
      }
      msgArea.innerHTML = `<div class="msg-banner error">Corrija os campos destacados antes de enviar.</div>`;
      document.querySelector('#inscricaoForm .field.error')?.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }

    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    /* de acordo com o projeto escolhido, os dados vão para uma coleção diferente
       (área diferente no painel admin) */
    const colecaoDestino = (projeto === 'Férias Universitária') ? FERIAS_COLLECTION : COLLECTION;

    try {
      await db.collection(colecaoDestino).add({
        ...vals,
        idade: calcIdade(vals.nascimento),
        status: 'Inscrito',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      document.getElementById('inscricaoForm').classList.add('hidden');
      document.getElementById('formIntro').classList.add('hidden');
      document.getElementById('formSuccess').classList.remove('hidden');
    } catch(err){
      msgArea.innerHTML = `<div class="msg-banner error">Erro ao enviar: ${err.message}</div>`;
      btn.disabled = false;
      btn.textContent = 'Enviar inscrição';
    }
  });
}

/* =========================================================
   LOGIN ADMIN
========================================================= */
document.getElementById('btnLogin')?.addEventListener('click', async () => {
  const msgArea = document.getElementById('loginMsgArea');
  msgArea.innerHTML = '';
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    if (!ALLOWED_ADMIN_EMAILS.includes(result.user.email)) {
      await auth.signOut();
      msgArea.innerHTML = `<div class="msg-banner error">Esse e-mail (${result.user.email}) não tem acesso ao painel. Fale com o administrador.</div>`;
    }
    // Se autorizado, o onAuthStateChanged acima já cuida de mostrar o painel
  } catch(err){
    msgArea.innerHTML = `<div class="msg-banner error">Falha no login: ${err.message}</div>`;
  }
});

document.getElementById('btnLogout')?.addEventListener('click', () => auth.signOut());

/* =========================================================
   PAINEL ADMIN
========================================================= */
let allRegs = [];
let unsubscribe = null;
let allLideres = [];
let unsubscribeLideres = null;
let allLeads = [];
let unsubscribeLeads = null;
let allFerias = [];
let unsubscribeFerias = null;
let camposCadastroInicializados = false;

function inicializarAbasCadastro(){
  if(camposCadastroInicializados) return;
  document.getElementById('camposCadastroParticipante').innerHTML = buildCamposHTML('ap');
  document.getElementById('camposCadastroLider').innerHTML = buildCamposHTML('al');
  attachMasks('ap');
  attachMasks('al');
  camposCadastroInicializados = true;
}

function inicializarTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.remove('hidden');
    });
  });
}

function showAdminPanel(){
  viewAdminLogin.classList.add('hidden');
  viewAdmin.classList.remove('hidden');
  inicializarAbasCadastro();
  inicializarTabs();

  if(unsubscribe) unsubscribe();
  unsubscribe = db.collection(COLLECTION).orderBy('criadoEm','desc')
    .onSnapshot(snap => {
      allRegs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderInscritosView();
    }, err => {
      document.getElementById('tableBody').innerHTML = `<tr><td colspan="7">Erro ao carregar: ${err.message}</td></tr>`;
    });

  if(unsubscribeLideres) unsubscribeLideres();
  unsubscribeLideres = db.collection(LIDERES_COLLECTION).orderBy('criadoEm','desc')
    .onSnapshot(snap => {
      allLideres = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLideresList();
      renderInscritosView();
    }, err => {
      document.getElementById('listaLideres').innerHTML = `<div class="msg-banner error">Erro ao carregar líderes: ${err.message}</div>`;
    });

  if(unsubscribeLeads) unsubscribeLeads();
  unsubscribeLeads = db.collection(LEADS_COLLECTION).orderBy('criadoEm','desc')
    .onSnapshot(snap => {
      allLeads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLeadsView();
    }, err => {
      document.getElementById('leadsTableBody').innerHTML = `<tr><td colspan="8">Erro ao carregar: ${err.message}</td></tr>`;
    });

  if(unsubscribeFerias) unsubscribeFerias();
  unsubscribeFerias = db.collection(FERIAS_COLLECTION).orderBy('criadoEm','desc')
    .onSnapshot(snap => {
      allFerias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFeriasView();
    }, err => {
      document.getElementById('feriasTableBody').innerHTML = `<tr><td colspan="7">Erro ao carregar: ${err.message}</td></tr>`;
    });

  db.collection('stats').doc('visitas').onSnapshot(doc => {
    const dados = doc.exists ? doc.data() : {};
    const total = dados.total || 0;
    document.getElementById('visitasStatsArea').innerHTML =
      `<div class="stat-card"><div class="num">${total}</div><div class="lbl">Visitas ao link público</div></div>`;

    const porOrigem = dados.porOrigem || {};
    const rotulos = {
      whatsapp: 'WhatsApp',
      instagram: 'Instagram',
      facebook: 'Facebook',
      google: 'Google',
      twitter: 'Twitter/X',
      direto: 'Direto / outro'
    };
    const origensOrdenadas = Object.keys(porOrigem).sort((a, b) => porOrigem[b] - porOrigem[a]);
    const origemHtml = document.getElementById('origemStatsArea');
    if(origensOrdenadas.length === 0){
      origemHtml.innerHTML = '<p style="color:var(--gray);font-size:12.5px;">Ainda não há dados de origem dos acessos.</p>';
    } else {
      origemHtml.innerHTML = origensOrdenadas.map(chave => `
        <div class="stat-card">
          <div class="num">${porOrigem[chave]}</div>
          <div class="lbl">${rotulos[chave] || (chave.charAt(0).toUpperCase() + chave.slice(1))}</div>
        </div>
      `).join('');
    }
  }, () => {
    document.getElementById('visitasStatsArea').innerHTML = '';
    document.getElementById('origemStatsArea').innerHTML = '';
  });

  carregarGraficoCliques(parseInt(document.getElementById('periodoGraficoSelect')?.value || '14', 10));
}

/* =========================================================
   GRÁFICO DE CLIQUES POR DIA (admin)
========================================================= */
let chartCliquesInstance = null;

async function carregarGraficoCliques(dias){
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - (dias - 1));
  const inicioStr = inicio.toISOString().slice(0, 10);

  const mapaPorData = {};
  try {
    const snap = await db.collection('stats_diario').where('data', '>=', inicioStr).get();
    snap.forEach(doc => { mapaPorData[doc.id] = doc.data().total || 0; });
  } catch(err){
    console.error('Erro ao carregar cliques por dia:', err.message);
  }

  const labels = [];
  const valores = [];
  for(let i = dias - 1; i >= 0; i--){
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const dataStr = d.toISOString().slice(0, 10);
    const [, mes, dia] = dataStr.split('-');
    labels.push(`${dia}/${mes}`);
    valores.push(mapaPorData[dataStr] || 0);
  }

  desenharGraficoCliques(labels, valores);
}

function desenharGraficoCliques(labels, valores){
  const ctx = document.getElementById('graficoCliquesDiarios');
  if(!ctx || typeof Chart === 'undefined') return;
  if(chartCliquesInstance) chartCliquesInstance.destroy();
  chartCliquesInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cliques',
        data: valores,
        backgroundColor: 'rgba(242,183,5,0.75)',
        hoverBackgroundColor: 'rgba(242,183,5,1)',
        borderRadius: 4,
        maxBarThickness: 32
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#b8c2cc', font: { size: 10.5 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: '#b8c2cc', precision: 0 }, grid: { color: 'rgba(255,255,255,.08)' } }
      }
    }
  });
}

document.getElementById('periodoGraficoSelect')?.addEventListener('change', e => {
  carregarGraficoCliques(parseInt(e.target.value, 10));
});


/* Combina líderes + participantes numa única lista, líderes sempre primeiro */
function getUnifiedList(){
  const lideresTagged = allLideres.map(l => ({ ...l, _tipo: 'lider' }));
  const regsTagged = allRegs.map(r => ({ ...r, _tipo: 'participante' }));
  return [...lideresTagged, ...regsTagged];
}

function renderInscritosView(){
  renderStats();
  populateCidadeFilter();
  renderTable();
  renderDistritosView();
}

/* =========================================================
   ABA DISTRITOS — cobertura de distritos pastorais
========================================================= */
function renderDistritosView(){
  const tbody = document.getElementById('distritosTableBody');
  const resumoEl = document.getElementById('distritosResumoArea');
  if(!tbody || !resumoEl) return;

  let comConfirmado = 0;

  const linhas = DISTRITOS_PASTORAIS.map(distrito => {
    const doDistrito = allRegs.filter(r => r.distritoPastoral === distrito);
    const confirmados = doDistrito.filter(r => r.status === 'Confirmado').length;
    const totalInscritos = doDistrito.length;
    const ok = confirmados > 0;
    if(ok) comConfirmado++;
    return `
      <tr>
        <td>${distrito}</td>
        <td>${PASTORES_POR_DISTRITO[distrito] || '—'}</td>
        <td>${ok
          ? '<span style="color:var(--success);font-weight:600;">✅ OK</span>'
          : '<span style="color:var(--warn);font-weight:600;">⏳ Pendente</span>'}</td>
        <td>${confirmados}</td>
        <td>${totalInscritos}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = linhas;

  const semNenhum = DISTRITOS_PASTORAIS.length - comConfirmado;
  resumoEl.innerHTML = `
    <div class="stat-card"><div class="num">${DISTRITOS_PASTORAIS.length}</div><div class="lbl">Total de distritos</div></div>
    <div class="stat-card"><div class="num" style="color:var(--success);">${comConfirmado}</div><div class="lbl">Com jovem confirmado</div></div>
    <div class="stat-card"><div class="num" style="color:var(--warn);">${semNenhum}</div><div class="lbl">Ainda pendentes</div></div>
  `;
}

function renderStats(){
  const unified = getUnifiedList();
  const total = unified.length;
  const byStatus = {};
  allRegs.forEach(r => byStatus[r.status] = (byStatus[r.status]||0)+1);
  const statuses = ['Inscrito','Em análise','Aprovado','Reprovado','Confirmado'];
  let html = `<div class="stat-card"><div class="num">${total}</div><div class="lbl">Total (líderes + participantes)</div></div>`;
  html += `<div class="stat-card"><div class="num">${allLideres.length}</div><div class="lbl">Líderes</div></div>`;
  statuses.forEach(s => {
    html += `<div class="stat-card"><div class="num">${byStatus[s]||0}</div><div class="lbl">${s}</div></div>`;
  });
  document.getElementById('statsArea').innerHTML = html;
}

function populateCidadeFilter(){
  const sel = document.getElementById('filterCidade');
  const current = sel.value;
  const unified = getUnifiedList();
  const cidades = [...new Set(unified.map(r => r.cidade).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todas as cidades</option>' + cidades.map(c => `<option value="${c}">${c}</option>`).join('');
  sel.value = current;
}

function statusClass(s){ return 'status-' + s.replace(' ','_'); }

function renderTable(){
  const search = document.getElementById('searchInput').value.toLowerCase();
  const fStatus = document.getElementById('filterStatus').value;
  const fCidade = document.getElementById('filterCidade').value;

  let filtered = getUnifiedList().filter(r => {
    if(fStatus && r._tipo !== 'lider' && r.status !== fStatus) return false;
    if(fStatus && r._tipo === 'lider') return false; // líder não tem status, não aparece em filtro de status específico
    if(fCidade && r.cidade !== fCidade) return false;
    if(search){
      const hay = `${r.nome} ${r.cpf} ${r.cidade} ${r.whatsapp}`.toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  });

  // líderes sempre no topo (ordenação estável preserva o restante)
  filtered.sort((a, b) => (a._tipo === 'lider' ? -1 : 0) - (b._tipo === 'lider' ? -1 : 0));

  const tbody = document.getElementById('tableBody');
  if(filtered.length === 0){
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--gray);text-align:center;padding:24px;">Nenhuma inscrição encontrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const data = r.criadoEm?.toDate ? r.criadoEm.toDate().toLocaleDateString('pt-BR') : '—';
    const statusCell = r._tipo === 'lider'
      ? `<span class="status-pill status-Confirmado">★ Líder</span>`
      : `<span class="status-pill ${statusClass(r.status||'Inscrito')}">${r.status||'Inscrito'}</span>`;
    return `<tr>
      <td>${r.nome||''}</td>
      <td>${r.idade ?? '—'}</td>
      <td>${r.cidade||''}</td>
      <td>${r.whatsapp||''}</td>
      <td>${statusCell}</td>
      <td>${data}</td>
      <td><button class="btn small secondary" onclick="openModal('${r.id}','${r._tipo}')">Ver</button></td>
    </tr>`;
  }).join('');
}

document.getElementById('searchInput')?.addEventListener('input', renderTable);
document.getElementById('filterStatus')?.addEventListener('change', renderTable);
document.getElementById('filterCidade')?.addEventListener('change', renderTable);

/* ---------- MODAL DE DETALHE (participante ou líder) ---------- */
const MODAL_FIELDS = [
  ['Nome', 'nome', 'text'], ['Data de nascimento', 'nascimento', 'date'], ['Idade', 'idade', null],
  ['CPF', 'cpf', 'text'], ['RG', 'rg', 'text'], ['Estado civil', 'estadoCivil', 'select-estadoCivil'],
  ['Escolaridade', 'escolaridade', 'select-escolaridade'], ['E-mail', 'email', 'email'], ['WhatsApp', 'whatsapp', 'text'],
  ['CEP', 'cep', 'text'], ['Cidade', 'cidade', 'text'], ['Distrito Pastoral', 'distritoPastoral', 'select-distritoPastoral'], ['Endereço', 'endereco', 'text'], ['Bairro', 'bairro', 'text'],
  ['Nome do pai', 'nomePai', 'text'], ['Nome da mãe', 'nomeMae', 'text'],
  ['Tamanho de camisa', 'camisa', 'select-camisa']
];

let currentRegId = null;
let currentTipo = null;

function getCurrentRecord(){
  const arr = currentTipo === 'lider' ? allLideres : allRegs;
  return arr.find(x => x.id === currentRegId);
}

function getCurrentCollectionName(){
  return currentTipo === 'lider' ? LIDERES_COLLECTION : COLLECTION;
}

function renderModalView(r){
  document.getElementById('modalBody').innerHTML = MODAL_FIELDS.map(([label, field]) =>
    `<div class="detail-row"><span>${label}</span><span>${r[field] ?? '—'}</span></div>`
  ).join('');
}

function renderModalEdit(r){
  document.getElementById('modalBody').innerHTML = MODAL_FIELDS.map(([label, field, type]) => {
    if(field === 'idade') return ''; // idade é recalculada automaticamente
    if(type === 'select-estadoCivil'){
      const opts = ['Solteiro(a)','Casado(a)','Divorciado(a)','Viúvo(a)','União estável'];
      return `<div class="detail-row"><span>${label}</span>
        <select id="edit_${field}" style="background:var(--card);border:1px solid #2c2c30;color:var(--white);padding:6px 8px;border-radius:6px;">
          ${opts.map(o => `<option ${r[field]===o?'selected':''}>${o}</option>`).join('')}
        </select></div>`;
    }
    if(type === 'select-escolaridade'){
      const opts = ['Fundamental incompleto','Fundamental completo','Médio incompleto','Médio completo','Superior incompleto','Superior completo','Pós-graduação'];
      return `<div class="detail-row"><span>${label}</span>
        <select id="edit_${field}" style="background:var(--card);border:1px solid #2c2c30;color:var(--white);padding:6px 8px;border-radius:6px;">
          ${opts.map(o => `<option ${r[field]===o?'selected':''}>${o}</option>`).join('')}
        </select></div>`;
    }
    if(type === 'select-camisa'){
      const opts = ['PP','P','M','G','GG','XG'];
      return `<div class="detail-row"><span>${label}</span>
        <select id="edit_${field}" style="background:var(--card);border:1px solid #2c2c30;color:var(--white);padding:6px 8px;border-radius:6px;">
          ${opts.map(o => `<option ${r[field]===o?'selected':''}>${o}</option>`).join('')}
        </select></div>`;
    }
    if(type === 'select-distritoPastoral'){
      const opts = DISTRITOS_PASTORAIS;
      return `<div class="detail-row"><span>${label}</span>
        <select id="edit_${field}" style="background:var(--card);border:1px solid #2c2c30;color:var(--white);padding:6px 8px;border-radius:6px;">
          <option value="" ${!r[field]?'selected':''}>Selecione</option>
          ${opts.map(o => `<option ${r[field]===o?'selected':''}>${o}</option>`).join('')}
        </select></div>`;
    }
    return `<div class="detail-row"><span>${label}</span>
      <input type="${type}" id="edit_${field}" value="${(r[field]??'').toString().replace(/"/g,'&quot;')}" style="background:var(--card);border:1px solid #2c2c30;color:var(--white);padding:6px 8px;border-radius:6px;max-width:60%;">
    </div>`;
  }).join('');
}

window.openModal = function(id, tipo){
  currentTipo = tipo || 'participante';
  currentRegId = id;
  const r = getCurrentRecord();
  if(!r) return;

  document.getElementById('modalTitle').textContent = currentTipo === 'lider' ? 'Detalhes do líder' : 'Detalhes da inscrição';
  renderModalView(r);

  document.getElementById('modalActionsView').classList.remove('hidden');
  document.getElementById('modalActionsEdit').classList.add('hidden');

  const statusWrap = document.getElementById('modalStatusSelect');
  const btnSaveStatus = document.getElementById('btnSaveStatus');
  const btnEnviarConfirmacao = document.getElementById('btnEnviarConfirmacao');
  const btnObservacao = document.getElementById('btnObservacao');
  if(currentTipo === 'lider'){
    statusWrap.style.display = 'none';
    btnSaveStatus.style.display = 'none';
    btnEnviarConfirmacao.style.display = 'none';
    btnObservacao.style.display = 'none';
  } else {
    statusWrap.style.display = '';
    btnSaveStatus.style.display = '';
    statusWrap.value = r.status || 'Inscrito';
    btnEnviarConfirmacao.style.display = (r.status === 'Confirmado') ? '' : 'none';
    btnObservacao.style.display = '';
    btnObservacao.textContent = r.observacao ? '📝 Observação ✓' : '📝 Observação';
  }

  document.getElementById('modalBg').classList.add('open');
};

document.getElementById('modalClose').addEventListener('click', () => document.getElementById('modalBg').classList.remove('open'));
document.getElementById('modalBg').addEventListener('click', e => { if(e.target.id === 'modalBg') e.currentTarget.classList.remove('open'); });

document.getElementById('btnSaveStatus').addEventListener('click', async () => {
  if(!currentRegId || currentTipo === 'lider') return;
  const novoStatus = document.getElementById('modalStatusSelect').value;
  await db.collection(COLLECTION).doc(currentRegId).update({ status: novoStatus });
  const r = getCurrentRecord();
  if(r) r.status = novoStatus;
  document.getElementById('btnEnviarConfirmacao').style.display = (novoStatus === 'Confirmado') ? '' : 'none';
  document.getElementById('modalBg').classList.remove('open');
});

/* ---------- ENVIO DE MENSAGEM DE CONFIRMAÇÃO PELO WHATSAPP ---------- */
function montarLinkWhatsApp(whatsapp, mensagem){
  const digits = (whatsapp || '').replace(/\D/g, '');
  const comDDI = digits.startsWith('55') ? digits : '55' + digits;
  return `https://wa.me/${comDDI}?text=${encodeURIComponent(mensagem)}`;
}

document.getElementById('btnEnviarConfirmacao').addEventListener('click', () => {
  if(!currentRegId || currentTipo === 'lider') return;
  const r = getCurrentRecord();
  if(!r || !r.whatsapp){
    alert('Este inscrito não possui um número de WhatsApp cadastrado.');
    return;
  }
  const primeiroNome = (r.nome || '').trim().split(' ')[0];
  const mensagem = `Olá${primeiroNome ? ', ' + primeiroNome : ''}! 🎉\n\nSeja muito bem-vindo(a) ao *Sonhando Alto*! Sua inscrição foi *confirmada* com sucesso.\n\nParabéns pela escolha de fazer parte desse projeto — em breve você vai viver uma experiência única de crescimento pessoal, espiritual e profissional. 🙌\n\nEm breve nossa equipe entrará em contato com mais informações. Até lá! ✨`;
  window.open(montarLinkWhatsApp(r.whatsapp, mensagem), '_blank');
});

document.getElementById('btnObservacao').addEventListener('click', () => {
  if(!currentRegId || currentTipo === 'lider') return;
  window.abrirNota(currentRegId, 'inscrito');
});

/* ---------- OBSERVAÇÃO SOBRE O CONTATO (leads e inscritos) ---------- */
let notaTargetId = null;
let notaTargetTipo = null; // 'lead', 'inscrito' ou 'ferias'

window.abrirNota = function(id, tipo){
  notaTargetId = id;
  notaTargetTipo = tipo;
  const registro = tipo === 'lead' ? allLeads.find(x => x.id === id)
    : tipo === 'ferias' ? allFerias.find(x => x.id === id)
    : allRegs.find(x => x.id === id);
  document.getElementById('notaModalTitle').textContent = tipo === 'lead'
    ? 'Observação sobre o lead'
    : tipo === 'ferias' ? 'Observação sobre o inscrito (Férias Universitária)'
    : 'Observação sobre o inscrito';
  document.getElementById('notaTextarea').value = (registro && registro.observacao) || '';
  document.getElementById('notaModalBg').classList.add('open');
};

function fecharNotaModal(){
  document.getElementById('notaModalBg').classList.remove('open');
  notaTargetId = null;
  notaTargetTipo = null;
}

document.getElementById('notaModalClose').addEventListener('click', fecharNotaModal);
document.getElementById('btnCancelarNota').addEventListener('click', fecharNotaModal);
document.getElementById('notaModalBg').addEventListener('click', e => { if(e.target.id === 'notaModalBg') fecharNotaModal(); });

document.getElementById('btnSalvarNota').addEventListener('click', async () => {
  if(!notaTargetId) return;
  const texto = document.getElementById('notaTextarea').value.trim();
  const collectionName = notaTargetTipo === 'lead' ? LEADS_COLLECTION
    : notaTargetTipo === 'ferias' ? FERIAS_COLLECTION
    : COLLECTION;
  try {
    await db.collection(collectionName).doc(notaTargetId).update({ observacao: texto });
    if(notaTargetTipo === 'lead'){
      const l = allLeads.find(x => x.id === notaTargetId);
      if(l){ l.observacao = texto; renderLeadsTable(); }
    } else if(notaTargetTipo === 'ferias'){
      const r = allFerias.find(x => x.id === notaTargetId);
      if(r){ r.observacao = texto; renderFeriasTable(); }
    } else {
      const r = allRegs.find(x => x.id === notaTargetId);
      if(r){
        r.observacao = texto;
        if(currentRegId === notaTargetId){
          document.getElementById('btnObservacao').textContent = texto ? '📝 Observação ✓' : '📝 Observação';
        }
      }
    }
    fecharNotaModal();
  } catch(err){
    alert('Erro ao salvar observação: ' + err.message);
  }
});

document.getElementById('btnDeleteReg').addEventListener('click', async () => {
  if(!currentRegId) return;
  const msg = currentTipo === 'lider'
    ? 'Tem certeza que deseja remover este líder? Esta ação não pode ser desfeita.'
    : 'Tem certeza que deseja excluir esta inscrição? Esta ação não pode ser desfeita.';
  if(!confirm(msg)) return;
  await db.collection(getCurrentCollectionName()).doc(currentRegId).delete();
  document.getElementById('modalBg').classList.remove('open');
});

document.getElementById('btnEditReg').addEventListener('click', () => {
  const r = getCurrentRecord();
  if(!r) return;
  renderModalEdit(r);
  document.getElementById('modalActionsView').classList.add('hidden');
  document.getElementById('modalActionsEdit').classList.remove('hidden');
});

document.getElementById('btnCancelEdit').addEventListener('click', () => {
  const r = getCurrentRecord();
  if(!r) return;
  renderModalView(r);
  document.getElementById('modalActionsView').classList.remove('hidden');
  document.getElementById('modalActionsEdit').classList.add('hidden');
});

document.getElementById('btnSaveEdit').addEventListener('click', async () => {
  if(!currentRegId) return;
  const updates = {};
  MODAL_FIELDS.forEach(([label, field]) => {
    if(field === 'idade') return;
    const el = document.getElementById(`edit_${field}`);
    if(el) updates[field] = el.value.trim ? el.value.trim() : el.value;
  });
  if(updates.nascimento){
    updates.idade = calcIdade(updates.nascimento);
  }
  const btn = document.getElementById('btnSaveEdit');
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  try {
    await db.collection(getCurrentCollectionName()).doc(currentRegId).update(updates);
    document.getElementById('modalBg').classList.remove('open');
  } catch(err){
    alert('Erro ao salvar alterações: ' + err.message);
  }
  btn.disabled = false;
  btn.textContent = 'Salvar alterações';
});

/* ---------- EXPORTAÇÃO EXCEL (líderes + participantes) ---------- */
document.getElementById('btnExportExcel')?.addEventListener('click', () => {
  const unified = getUnifiedList();
  unified.sort((a, b) => (a._tipo === 'lider' ? -1 : 0) - (b._tipo === 'lider' ? -1 : 0));
  const data = unified.map(r => ({
    Tipo: r._tipo === 'lider' ? 'Líder' : 'Participante',
    Nome: r.nome, 'Data de nascimento': r.nascimento, Idade: r.idade, CPF: r.cpf, RG: r.rg,
    'Estado civil': r.estadoCivil, Escolaridade: r.escolaridade, Email: r.email,
    WhatsApp: r.whatsapp, CEP: r.cep, Cidade: r.cidade, Endereço: r.endereco, Bairro: r.bairro,
    'Nome do pai': r.nomePai, 'Nome da mãe': r.nomeMae, 'Tamanho camisa': r.camisa,
    Status: r._tipo === 'lider' ? 'Líder' : r.status
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inscritos');
  XLSX.writeFile(wb, `sonhando-alto-inscritos-${new Date().toISOString().slice(0,10)}.xlsx`);
});

/* =========================================================
   ABA: CADASTRAR PARTICIPANTE (admin cadastra manualmente)
========================================================= */
document.getElementById('btnCadastrarParticipante')?.addEventListener('click', async () => {
  const vals = coletarDados('ap');
  const checks = validarDados(vals);
  let valid = true;
  checks.forEach(([name, ok]) => { showFieldError('camposCadastroParticipante', name, !ok); if(!ok) valid = false; });

  const msgArea = document.getElementById('msgCadastroParticipante');
  msgArea.innerHTML = '';
  if(!valid){
    msgArea.innerHTML = `<div class="msg-banner error">Corrija os campos destacados antes de cadastrar.</div>`;
    document.querySelector('#camposCadastroParticipante .field.error')?.scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }

  const btn = document.getElementById('btnCadastrarParticipante');
  btn.disabled = true;
  btn.textContent = 'Cadastrando...';

  try {
    await db.collection(COLLECTION).add({
      ...vals,
      idade: calcIdade(vals.nascimento),
      status: 'Inscrito',
      cadastradoPorAdmin: true,
      cadastradoPor: auth.currentUser?.email || null,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgArea.innerHTML = `<div class="msg-banner ok">Participante cadastrado com sucesso! Já aparece na aba "Inscritos".</div>`;
    limparCampos('ap');
  } catch(err){
    msgArea.innerHTML = `<div class="msg-banner error">Erro ao cadastrar: ${err.message}</div>`;
  }
  btn.disabled = false;
  btn.textContent = 'Cadastrar participante';
});

/* =========================================================
   ABA: CADASTRAR LÍDER (máximo 2)
========================================================= */
function renderLideresList(){
  const card = document.getElementById('liderStatusCard');
  const wrap = document.getElementById('listaLideres');
  const limitMsg = document.getElementById('liderLimitMsg');
  const campos = document.getElementById('camposCadastroLider');
  const btn = document.getElementById('btnCadastrarLider');

  card.innerHTML = `<div class="num">${allLideres.length}/2</div><div class="lbl">Líderes cadastrados</div>`;

  if(allLideres.length === 0){
    wrap.innerHTML = `<p style="color:var(--gray);font-size:13.5px;">Nenhum líder cadastrado ainda.</p>`;
  } else {
    wrap.innerHTML = allLideres.map(l => `
      <div class="stat-card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
        <div>
          <div style="font-family:'Anton',sans-serif;font-size:15px;color:var(--white);">${l.nome || ''}</div>
          <div style="color:var(--gray);font-size:12.5px;margin-top:2px;">${l.cidade || ''}${l.cidade && l.whatsapp ? ' · ' : ''}${l.whatsapp || ''}</div>
        </div>
        <button class="btn small danger" onclick="removerLider('${l.id}')">Remover</button>
      </div>
    `).join('');
  }

  const limitReached = allLideres.length >= 2;
  limitMsg.classList.toggle('hidden', !limitReached);
  if(limitReached){
    limitMsg.innerHTML = `<div class="msg-banner error">Limite de 2 líderes atingido. Remova um líder acima para poder cadastrar outro.</div>`;
  }
  campos.style.display = limitReached ? 'none' : '';
  btn.style.display = limitReached ? 'none' : '';
}

window.removerLider = async function(id){
  if(!confirm('Tem certeza que deseja remover este líder?')) return;
  try {
    await db.collection(LIDERES_COLLECTION).doc(id).delete();
  } catch(err){
    alert('Erro ao remover: ' + err.message);
  }
};

document.getElementById('btnCadastrarLider')?.addEventListener('click', async () => {
  if(allLideres.length >= 2){
    document.getElementById('msgCadastroLider').innerHTML = `<div class="msg-banner error">Limite de 2 líderes já atingido.</div>`;
    return;
  }

  const vals = coletarDados('al');
  const checks = validarDados(vals);
  let valid = true;
  checks.forEach(([name, ok]) => { showFieldError('camposCadastroLider', name, !ok); if(!ok) valid = false; });

  const msgArea = document.getElementById('msgCadastroLider');
  msgArea.innerHTML = '';
  if(!valid){
    msgArea.innerHTML = `<div class="msg-banner error">Corrija os campos destacados antes de cadastrar.</div>`;
    document.querySelector('#camposCadastroLider .field.error')?.scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }

  const btn = document.getElementById('btnCadastrarLider');
  btn.disabled = true;
  btn.textContent = 'Cadastrando...';

  try {
    await db.collection(LIDERES_COLLECTION).add({
      ...vals,
      idade: calcIdade(vals.nascimento),
      cadastradoPor: auth.currentUser?.email || null,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgArea.innerHTML = `<div class="msg-banner ok">Líder cadastrado com sucesso!</div>`;
    limparCampos('al');
  } catch(err){
    msgArea.innerHTML = `<div class="msg-banner error">Erro ao cadastrar: ${err.message}</div>`;
  }
  btn.disabled = false;
  btn.textContent = 'Cadastrar líder';
});

/* =========================================================
   FORMULÁRIO DE LEADS ("Quero receber mais informações")
========================================================= */
document.getElementById('lead_telefone')?.addEventListener('input', e => e.target.value = maskPhone(e.target.value));

/* =========================================================
   FORMULÁRIO DE LEADS EM ETAPAS (uma pergunta por vez)
========================================================= */
const LEAD_STEPS = [
  ['leadNome'],
  ['leadTelefone', 'leadIdade'],
  ['leadCidade', 'leadDistrito'],
  ['leadEnsinoMedio']
];
let stepAtualLead = 1;

function coletarDadosLead(){
  return {
    nome: document.getElementById('lead_nome').value.trim(),
    telefone: document.getElementById('lead_telefone').value.trim(),
    idade: document.getElementById('lead_idade').value.trim(),
    cidade: document.getElementById('lead_cidade').value.trim(),
    distrito: document.getElementById('lead_distrito').value.trim(),
    ensinoMedio: document.getElementById('lead_ensinoMedio').value
  };
}

function validarDadosLead(vals){
  return [
    ['leadNome', vals.nome.length >= 3],
    ['leadTelefone', vals.telefone.replace(/\D/g, '').length >= 10],
    ['leadIdade', !!vals.idade && Number(vals.idade) > 0],
    ['leadCidade', vals.cidade.length >= 2],
    ['leadDistrito', vals.distrito.length >= 2],
    ['leadEnsinoMedio', !!vals.ensinoMedio]
  ];
}

function mostrarStepLead(n){
  const steps = document.querySelectorAll('.leads-card .form-step');
  const total = steps.length;
  steps.forEach(s => s.classList.toggle('hidden', parseInt(s.dataset.step, 10) !== n));
  steps.forEach(s => s.classList.remove('avancando'));
  document.getElementById('leadProgressSpinner')?.classList.remove('ativo');

  const bar = document.getElementById('leadProgressBar');
  if(bar) bar.style.width = (n / total * 100) + '%';

  const btnVoltar = document.getElementById('btnLeadVoltar');
  const btnEnviar = document.getElementById('btnEnviarLead');
  const ultimo = (n === total);
  if(btnVoltar) btnVoltar.style.visibility = (n === 1) ? 'hidden' : 'visible';
  if(btnEnviar) btnEnviar.classList.toggle('hidden', !ultimo);

  const msgArea = document.getElementById('leadMsgArea');
  if(msgArea) msgArea.innerHTML = '';

  if(!ultimo) conectarAutoAvancoDoStep(n, 'lead');
}

function validarStepLead(n){
  const camposDoStep = LEAD_STEPS[n - 1];
  const vals = coletarDadosLead();
  const checks = validarDadosLead(vals).filter(([nome]) => camposDoStep.includes(nome));
  let valido = true;
  checks.forEach(([nome, ok]) => {
    const el = document.querySelector(`.leads-card [data-field="${nome}"]`);
    if(el) el.classList.toggle('error', !ok);
    if(!ok) valido = false;
  });
  return valido;
}

function stepLeadValidoSilencioso(n){
  const camposDoStep = LEAD_STEPS[n - 1];
  const vals = coletarDadosLead();
  return validarDadosLead(vals).filter(([nome]) => camposDoStep.includes(nome)).every(([, ok]) => ok);
}

document.getElementById('btnLeadVoltar')?.addEventListener('click', () => {
  cancelarAutoAvanco();
  if(stepAtualLead > 1){
    stepAtualLead--;
    mostrarStepLead(stepAtualLead);
  }
});

/* Enter no teclado avança imediatamente para a próxima pergunta (sem esperar) */
document.querySelector('.leads-card')?.addEventListener('keydown', e => {
  if(e.key === 'Enter' && e.target.tagName !== 'TEXTAREA'){
    e.preventDefault();
    cancelarAutoAvanco();
    if(stepAtualLead < LEAD_STEPS.length){
      if(validarStepLead(stepAtualLead)){
        stepAtualLead++;
        mostrarStepLead(stepAtualLead);
      }
    } else {
      document.getElementById('btnEnviarLead')?.click();
    }
  }
});

if(document.querySelector('.leads-card .form-step')){
  mostrarStepLead(1);
}

document.getElementById('btnEnviarLead')?.addEventListener('click', async () => {
  const vals = {
    nome: document.getElementById('lead_nome').value.trim(),
    telefone: document.getElementById('lead_telefone').value.trim(),
    cidade: document.getElementById('lead_cidade').value.trim(),
    distrito: document.getElementById('lead_distrito').value.trim(),
    idade: document.getElementById('lead_idade').value.trim(),
    ensinoMedio: document.getElementById('lead_ensinoMedio').value
  };

  const checks = [
    ['leadNome', vals.nome.length >= 3],
    ['leadTelefone', vals.telefone.replace(/\D/g,'').length >= 10],
    ['leadCidade', vals.cidade.length >= 2],
    ['leadDistrito', vals.distrito.length >= 2],
    ['leadIdade', vals.idade && Number(vals.idade) > 0],
    ['leadEnsinoMedio', !!vals.ensinoMedio]
  ];
  let valid = true;
  let primeiroInvalido = null;
  checks.forEach(([name, ok]) => {
    const el = document.querySelector(`.leads-card [data-field="${name}"]`);
    if(el) el.classList.toggle('error', !ok);
    if(!ok){ valid = false; if(!primeiroInvalido) primeiroInvalido = name; }
  });

  const msgArea = document.getElementById('leadMsgArea');
  msgArea.innerHTML = '';
  if(!valid){
    const stepComErro = LEAD_STEPS.findIndex(campos => campos.includes(primeiroInvalido)) + 1;
    if(stepComErro > 0){
      stepAtualLead = stepComErro;
      mostrarStepLead(stepAtualLead);
    }
    msgArea.innerHTML = `<div class="msg-banner error">Corrija os campos destacados.</div>`;
    return;
  }

  const btn = document.getElementById('btnEnviarLead');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    await db.collection(LEADS_COLLECTION).add({
      ...vals,
      idade: Number(vals.idade),
      status: 'Pendente',
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    ['lead_nome','lead_telefone','lead_cidade','lead_distrito','lead_idade'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('lead_ensinoMedio').value = '';
    stepAtualLead = 1;
    mostrarStepLead(1);
    msgArea.innerHTML = `<div class="msg-banner ok">Recebemos seus dados! Em breve alguém da nossa equipe vai entrar em contato.</div>`;
  } catch(err){
    msgArea.innerHTML = `<div class="msg-banner error">Erro ao enviar: ${err.message}</div>`;
  }
  btn.disabled = false;
  btn.textContent = 'Quero saber mais';
});

/* =========================================================
   BOTÃO "PREENCHA OS DADOS ABAIXO PARA SE INSCREVER"
========================================================= */
document.getElementById('btnScrollToForm')?.addEventListener('click', () => {
  document.getElementById('f_nome')?.scrollIntoView({behavior:'smooth', block:'center'});
  setTimeout(() => document.getElementById('f_nome')?.focus(), 350);
});

/* =========================================================
   VÍDEO PROMOCIONAL — PLAY NO FUTURO
========================================================= */
(function(){
  const video = document.getElementById('promoVideo');
  const playBtn = document.getElementById('videoPlayBtn');
  if(!video || !playBtn) return;

  playBtn.addEventListener('click', () => {
    video.setAttribute('controls', '');
    video.play();
    playBtn.classList.add('hidden');
  });
  video.addEventListener('pause', () => playBtn.classList.remove('hidden'));
  video.addEventListener('ended', () => playBtn.classList.remove('hidden'));
})();

/* =========================================================
   VÍDEO DO PROJETO — SEÇÃO "O QUE É O SONHANDO ALTO"
========================================================= */
(function(){
  const video = document.getElementById('projectVideo');
  const playBtn = document.getElementById('projectPlayBtn');
  if(!video || !playBtn) return;

  playBtn.addEventListener('click', () => {
    video.setAttribute('controls', '');
    video.play();
    playBtn.classList.add('hidden');
  });
  video.addEventListener('pause', () => playBtn.classList.remove('hidden'));
  video.addEventListener('ended', () => playBtn.classList.remove('hidden'));
})();

/* =========================================================
   ABA LEADS (admin) — interessados a contatar
========================================================= */
function leadStatusClass(s){
  if(s === 'Contatado') return 'status-Aprovado';
  if(s === 'Aguardando resposta') return 'status-Em_análise';
  return 'status-Inscrito'; // Pendente
}

function renderLeadsView(){
  renderLeadsStats();
  renderLeadsTable();
}

function renderLeadsStats(){
  const total = allLeads.length;
  const byStatus = {};
  allLeads.forEach(l => byStatus[l.status] = (byStatus[l.status]||0)+1);
  const statuses = ['Pendente','Contatado','Aguardando resposta'];
  let html = `<div class="stat-card"><div class="num">${total}</div><div class="lbl">Total de leads</div></div>`;
  statuses.forEach(s => {
    html += `<div class="stat-card"><div class="num">${byStatus[s]||0}</div><div class="lbl">${s}</div></div>`;
  });
  document.getElementById('leadsStatsArea').innerHTML = html;
}

function renderLeadsTable(){
  const searchEl = document.getElementById('leadsSearchInput');
  const statusEl = document.getElementById('leadsFilterStatus');
  if(!searchEl || !statusEl) return;
  const search = searchEl.value.toLowerCase();
  const fStatus = statusEl.value;

  let filtered = allLeads.filter(l => {
    if(fStatus && l.status !== fStatus) return false;
    if(search){
      const hay = `${l.nome} ${l.telefone} ${l.cidade}`.toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  });

  const tbody = document.getElementById('leadsTableBody');
  if(filtered.length === 0){
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--gray);text-align:center;padding:24px;">Nenhum lead encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(l => `
    <tr>
      <td>${l.nome||''}</td>
      <td>${l.telefone||''}</td>
      <td>${l.cidade||''}</td>
      <td>${l.distrito||''}</td>
      <td>${l.idade ?? '—'}</td>
      <td>${l.ensinoMedio||'—'}</td>
      <td>
        <select onchange="atualizarStatusLead('${l.id}', this.value)" style="background:var(--card);border:1px solid #2c2c30;color:var(--white);padding:5px 8px;border-radius:6px;font-size:12.5px;">
          <option ${l.status==='Pendente'?'selected':''}>Pendente</option>
          <option ${l.status==='Contatado'?'selected':''}>Contatado</option>
          <option ${l.status==='Aguardando resposta'?'selected':''}>Aguardando resposta</option>
        </select>
        <button class="btn small secondary" style="margin-top:6px;" onclick="abrirNota('${l.id}','lead')">📝 Observação${l.observacao ? ' ✓' : ''}</button>
      </td>
      <td><button class="btn small danger" onclick="excluirLead('${l.id}')">Excluir</button></td>
    </tr>
  `).join('');
}

document.getElementById('leadsSearchInput')?.addEventListener('input', renderLeadsTable);
document.getElementById('leadsFilterStatus')?.addEventListener('change', renderLeadsTable);

window.atualizarStatusLead = async function(id, novoStatus){
  try {
    await db.collection(LEADS_COLLECTION).doc(id).update({ status: novoStatus });
  } catch(err){
    alert('Erro ao atualizar status: ' + err.message);
  }
};

window.excluirLead = async function(id){
  if(!confirm('Tem certeza que deseja excluir este lead?')) return;
  try {
    await db.collection(LEADS_COLLECTION).doc(id).delete();
  } catch(err){
    alert('Erro ao excluir: ' + err.message);
  }
};

/* =========================================================
   ABA FÉRIAS UNIVERSITÁRIA (admin) — inscritos que escolheram
   esse projeto no formulário público
========================================================= */
function renderFeriasView(){
  renderFeriasStats();
  renderFeriasTable();
}

function renderFeriasStats(){
  const total = allFerias.length;
  const byStatus = {};
  allFerias.forEach(r => byStatus[r.status] = (byStatus[r.status]||0)+1);
  const statuses = ['Inscrito','Em análise','Aprovado','Reprovado','Confirmado'];
  let html = `<div class="stat-card"><div class="num">${total}</div><div class="lbl">Total de inscritos</div></div>`;
  statuses.forEach(s => {
    html += `<div class="stat-card"><div class="num">${byStatus[s]||0}</div><div class="lbl">${s}</div></div>`;
  });
  document.getElementById('feriasStatsArea').innerHTML = html;
}

function renderFeriasTable(){
  const searchEl = document.getElementById('feriasSearchInput');
  const statusEl = document.getElementById('feriasFilterStatus');
  if(!searchEl || !statusEl) return;
  const search = searchEl.value.toLowerCase();
  const fStatus = statusEl.value;

  let filtered = allFerias.filter(r => {
    if(fStatus && r.status !== fStatus) return false;
    if(search){
      const hay = `${r.nome||''} ${r.email||''} ${r.whatsapp||''} ${r.cidade||''}`.toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  });

  const tbody = document.getElementById('feriasTableBody');
  if(filtered.length === 0){
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--gray);text-align:center;padding:24px;">Nenhum inscrito encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${r.nome||''}</td>
      <td>${r.whatsapp||''}</td>
      <td>${r.cidade||''}</td>
      <td>${r.idade ?? '—'}</td>
      <td>${r.escolaridade||'—'}</td>
      <td>
        <select onchange="atualizarStatusFerias('${r.id}', this.value)" style="background:var(--card);border:1px solid #2c2c30;color:var(--white);padding:5px 8px;border-radius:6px;font-size:12.5px;">
          <option ${r.status==='Inscrito'?'selected':''}>Inscrito</option>
          <option ${r.status==='Em análise'?'selected':''}>Em análise</option>
          <option ${r.status==='Aprovado'?'selected':''}>Aprovado</option>
          <option ${r.status==='Reprovado'?'selected':''}>Reprovado</option>
          <option ${r.status==='Confirmado'?'selected':''}>Confirmado</option>
        </select>
        <button class="btn small secondary" style="margin-top:6px;" onclick="abrirNota('${r.id}','ferias')">📝 Observação${r.observacao ? ' ✓' : ''}</button>
      </td>
      <td><button class="btn small danger" onclick="excluirFerias('${r.id}')">Excluir</button></td>
    </tr>
  `).join('');
}

document.getElementById('feriasSearchInput')?.addEventListener('input', renderFeriasTable);
document.getElementById('feriasFilterStatus')?.addEventListener('change', renderFeriasTable);

window.atualizarStatusFerias = async function(id, novoStatus){
  try {
    await db.collection(FERIAS_COLLECTION).doc(id).update({ status: novoStatus });
  } catch(err){
    alert('Erro ao atualizar status: ' + err.message);
  }
};

window.excluirFerias = async function(id){
  if(!confirm('Tem certeza que deseja excluir este inscrito?')) return;
  try {
    await db.collection(FERIAS_COLLECTION).doc(id).delete();
  } catch(err){
    alert('Erro ao excluir: ' + err.message);
  }
};

/* =========================================================
   GALERIA DE FOTOS — Jovens estudando / Galeria de Formados
   Usado tanto no painel admin (upload/edição/remoção)
   quanto na página pública (exibição em tempo real)
========================================================= */
function processarFotoGaleria(file){
  return new Promise((resolve, reject) => {
    if(!file){ resolve(null); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 640;
        let w = img.width, h = img.height;
        if(w >= h && w > maxDim){ h = Math.round(h * maxDim / w); w = maxDim; }
        else if(h > w && h > maxDim){ w = Math.round(w * maxDim / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.75), width: w, height: h });
      };
      img.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

function clampGaleria(v, min, max){ return Math.max(min, Math.min(max, v)); }

/* Aplica background-size (zoom) e background-position (enquadramento) a um elemento
   .foto-enquadrada com base nos data-attributes fotow/fotoh/zoom/posx/posy */
function aplicarEnquadramento(el){
  const w = parseFloat(el.dataset.fotow) || 0;
  const h = parseFloat(el.dataset.fotoh) || 0;
  if(!w || !h) return;
  const zoom = parseFloat(el.dataset.zoom) || 1;
  const posX = el.dataset.posx !== undefined ? parseFloat(el.dataset.posx) : 50;
  const posY = el.dataset.posy !== undefined ? parseFloat(el.dataset.posy) : 50;
  const cw = el.clientWidth, ch = el.clientHeight;
  if(!cw || !ch) return;
  const baseScale = Math.max(cw / w, ch / h);
  const scale = baseScale * zoom;
  el.style.backgroundSize = (w * scale).toFixed(1) + 'px ' + (h * scale).toFixed(1) + 'px';
  el.style.backgroundPosition = posX + '% ' + posY + '%';
}
function aplicarEnquadramentosEm(container){
  container.querySelectorAll('.foto-enquadrada[data-fotow]').forEach(aplicarEnquadramento);
}
window.addEventListener('resize', () => {
  document.querySelectorAll('.foto-enquadrada[data-fotow]').forEach(aplicarEnquadramento);
});

/* =========================================================
   ARRASTAR PARA REORDENAR (admin) — define a ordem de exibição
   das fotos na página pública
========================================================= */
function encontrarAlvoDeSolturaGaleria(container, x, y, arrastado){
  const itens = Array.from(container.querySelectorAll('.galeria-admin-item')).filter(el => el !== arrastado);
  let maisProximo = null;
  let menorDistancia = Infinity;
  itens.forEach(item => {
    const box = item.getBoundingClientRect();
    const centroX = box.left + box.width / 2;
    const centroY = box.top + box.height / 2;
    const distancia = Math.hypot(x - centroX, y - centroY);
    if(distancia < menorDistancia){
      menorDistancia = distancia;
      maisProximo = { el: item, centroX, centroY, box };
    }
  });
  if(!maisProximo) return null;
  const mesmaLinha = Math.abs(y - maisProximo.centroY) < maisProximo.box.height / 2;
  const antes = mesmaLinha ? (x < maisProximo.centroX) : (y < maisProximo.centroY);
  return { el: maisProximo.el, antes };
}

function tornarListaArrastavel(listaEl, aoReordenar){
  listaEl.querySelectorAll('.galeria-admin-item .drag-handle').forEach(handle => {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      const item = handle.closest('.galeria-admin-item');
      if(!item) return;
      item.classList.add('arrastando');

      const onMove = ev => {
        const alvo = encontrarAlvoDeSolturaGaleria(listaEl, ev.clientX, ev.clientY, item);
        listaEl.querySelectorAll('.arraste-alvo').forEach(el => el.classList.remove('arraste-alvo'));
        if(!alvo) return;
        alvo.el.classList.add('arraste-alvo');
        if(alvo.antes) listaEl.insertBefore(item, alvo.el);
        else listaEl.insertBefore(item, alvo.el.nextSibling);
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        item.classList.remove('arrastando');
        listaEl.querySelectorAll('.arraste-alvo').forEach(el => el.classList.remove('arraste-alvo'));
        const novaOrdem = Array.from(listaEl.querySelectorAll('.galeria-admin-item')).map(el => el.dataset.id);
        aoReordenar(novaOrdem);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  });
}

async function salvarNovaOrdem(collectionName, idsEmOrdem){
  try {
    const batch = db.batch();
    idsEmOrdem.forEach((id, index) => {
      batch.update(db.collection(collectionName).doc(id), { ordem: index });
    });
    await batch.commit();
  } catch(err){
    alert('Erro ao salvar a nova ordem: ' + err.message);
  }
}

/* =========================================================
   CARROSSEL DAS GALERIAS PÚBLICAS
   Permite rolar/arrastar para o lado, com setas e roda do mouse
========================================================= */
function idGridDoCarrossel(prefix){
  return prefix === 'ge' ? 'galeriaEstudantesPublicGrid' : 'galeriaFormadosPublicGrid';
}

/* Calcula e aplica a largura exata dos cards (em pixels) para caber sempre
   3 fotos completas por tela — feito via JS para garantir o mesmo resultado
   em qualquer navegador, sem depender de calc() dentro de flex-basis. */
const GAP_CARROSSEL = 14;
const CARDS_POR_TELA = 3;

function ajustarLarguraCards(prefix){
  const grid = document.getElementById(idGridDoCarrossel(prefix));
  if(!grid) return;
  const largura = grid.clientWidth;
  if(!largura) return;
  const larguraCard = Math.floor((largura - GAP_CARROSSEL * (CARDS_POR_TELA - 1)) / CARDS_POR_TELA);
  grid.querySelectorAll(':scope > .galeria-card').forEach(card => {
    card.style.flex = `0 0 ${larguraCard}px`;
    card.style.width = larguraCard + 'px';
    /* define a altura da foto explicitamente (4:3), sem depender do aspect-ratio do CSS */
    const foto = card.querySelector('.foto-enquadrada, .galeria-foto-wrap');
    if(foto){
      const larguraFoto = larguraCard - 32; /* padding horizontal do card: 16px de cada lado */
      foto.style.width = larguraFoto + 'px';
      foto.style.height = Math.round(larguraFoto * 3 / 4) + 'px';
    }
  });
}

function atualizarSetasCarrossel(prefix){
  const grid = document.getElementById(idGridDoCarrossel(prefix));
  const prev = document.getElementById(prefix + '_navPrev');
  const next = document.getElementById(prefix + '_navNext');
  if(!grid) return;
  const max = grid.scrollWidth - grid.clientWidth;
  const podeRolar = max > 8;
  if(prev) prev.classList.toggle('hidden', !podeRolar || grid.scrollLeft <= 4);
  if(next) next.classList.toggle('hidden', !podeRolar || grid.scrollLeft >= max - 4);
}

function configurarCarrossel(prefix){
  const grid = document.getElementById(idGridDoCarrossel(prefix));
  const prev = document.getElementById(prefix + '_navPrev');
  const next = document.getElementById(prefix + '_navNext');
  if(!grid) return;

  function rolar(dir){
    const amount = Math.max(grid.clientWidth * 0.75, 210) * dir;
    grid.scrollBy({ left: amount, behavior: 'smooth' });
  }
  prev?.addEventListener('click', () => rolar(-1));
  next?.addEventListener('click', () => rolar(1));

  /* a navegação horizontal da galeria fica só pelas setinhas e por toque/arraste —
     a roda do mouse não é mais interceptada, então a rolagem da página nunca
     fica presa em cima das fotos */

  grid.addEventListener('scroll', () => atualizarSetasCarrossel(prefix));
  window.addEventListener('resize', () => {
    ajustarLarguraCards(prefix);
    aplicarEnquadramentosEm(grid);
    atualizarSetasCarrossel(prefix);
  });
  atualizarSetasCarrossel(prefix);
}

function initGaleria(config){
  const { collectionName, prefix, publicSectionId, publicGridId, destaque } = config;
  let editingId = null;
  let items = [];
  let posX = 50, posY = 50, zoom = 1;
  let fotoAtual = null; // { dataUrl, width, height } — preenchido quando um novo arquivo é selecionado

  const fotoInput = document.getElementById(prefix + '_foto');
  const nomeInput = document.getElementById(prefix + '_nome');
  const cursoInput = document.getElementById(prefix + '_curso');
  const cidadeInput = document.getElementById(prefix + '_cidade');
  const distritoInput = document.getElementById(prefix + '_distrito');
  const previewWrap = document.getElementById(prefix + '_previewWrap');
  const previewBox = document.getElementById(prefix + '_previewBox');
  const zoomLabel = document.getElementById(prefix + '_zoomLabel');
  const btnZoomIn = document.getElementById(prefix + '_zoomIn');
  const btnZoomOut = document.getElementById(prefix + '_zoomOut');
  const btnSalvar = document.getElementById('btnSalvar_' + prefix);
  const btnCancelar = document.getElementById('btnCancelar_' + prefix);
  const btnCentralizar = document.getElementById(prefix + '_centralizar');
  const msgEl = document.getElementById('msg_' + prefix);
  const listaEl = document.getElementById('lista_' + prefix);
  if(!fotoInput || !btnSalvar) return;

  function dimensoesAtuais(){
    if(fotoAtual) return { w: fotoAtual.width, h: fotoAtual.height };
    const item = editingId ? items.find(x => x.id === editingId) : null;
    if(item && item.fotoW && item.fotoH) return { w: item.fotoW, h: item.fotoH };
    return null;
  }

  function atualizarPreview(){
    const dims = dimensoesAtuais();
    if(!dims) return;
    previewBox.dataset.fotow = dims.w;
    previewBox.dataset.fotoh = dims.h;
    previewBox.dataset.zoom = zoom;
    previewBox.dataset.posx = posX;
    previewBox.dataset.posy = posY;
    aplicarEnquadramento(previewBox);
    if(zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }

  function definirZoom(novoZoom){
    if(!dimensoesAtuais()) return;
    zoom = clampGaleria(novoZoom, 1, 4);
    atualizarPreview();
  }

  previewBox.addEventListener('wheel', e => {
    if(!dimensoesAtuais()) return;
    e.preventDefault();
    definirZoom(zoom * (1 - e.deltaY * 0.01));
  }, { passive: false });

  btnZoomIn?.addEventListener('click', () => definirZoom(zoom * 1.15));
  btnZoomOut?.addEventListener('click', () => definirZoom(zoom / 1.15));

  /* ---------- arrastar a foto dentro da moldura para ajustar o enquadramento ---------- */
  let arrastando = false, inicioX = 0, inicioY = 0, posInicial = { x: 50, y: 50 };

  previewBox.addEventListener('pointerdown', e => {
    if(!dimensoesAtuais()) return;
    arrastando = true;
    inicioX = e.clientX;
    inicioY = e.clientY;
    posInicial = { x: posX, y: posY };
    previewBox.setPointerCapture(e.pointerId);
  });
  previewBox.addEventListener('pointermove', e => {
    if(!arrastando) return;
    const dims = dimensoesAtuais();
    if(!dims) return;
    const cw = previewBox.clientWidth, ch = previewBox.clientHeight;
    const baseScale = Math.max(cw / dims.w, ch / dims.h);
    const scale = baseScale * zoom;
    const bgW = dims.w * scale, bgH = dims.h * scale;
    const dx = e.clientX - inicioX;
    const dy = e.clientY - inicioY;
    const rangeX = cw - bgW;
    const rangeY = ch - bgH;
    posX = rangeX !== 0 ? clampGaleria(posInicial.x + (dx * 100 / rangeX), 0, 100) : 50;
    posY = rangeY !== 0 ? clampGaleria(posInicial.y + (dy * 100 / rangeY), 0, 100) : 50;
    atualizarPreview();
  });
  previewBox.addEventListener('pointerup', () => { arrastando = false; });
  previewBox.addEventListener('pointercancel', () => { arrastando = false; });

  btnCentralizar?.addEventListener('click', () => {
    posX = 50; posY = 50; zoom = 1;
    atualizarPreview();
  });

  fotoInput.addEventListener('change', async () => {
    const file = fotoInput.files[0];
    if(!file) return;
    btnSalvar.disabled = true;
    if(msgEl) msgEl.innerHTML = '<p style="color:var(--gray);font-size:12.5px;margin:6px 0;">Processando imagem...</p>';
    try {
      fotoAtual = await processarFotoGaleria(file);
      posX = 50; posY = 50; zoom = 1;
      previewBox.style.backgroundImage = `url(${fotoAtual.dataUrl})`;
      previewWrap.classList.remove('hidden');
      atualizarPreview();
      if(msgEl) msgEl.innerHTML = '';
    } catch(err){
      alert('Erro ao processar imagem: ' + err.message);
    } finally {
      btnSalvar.disabled = false;
    }
  });

  function limparForm(){
    editingId = null;
    fotoAtual = null;
    posX = 50; posY = 50; zoom = 1;
    fotoInput.value = '';
    nomeInput.value = '';
    cursoInput.value = '';
    cidadeInput.value = '';
    distritoInput.value = '';
    previewWrap.classList.add('hidden');
    previewBox.style.backgroundImage = '';
    delete previewBox.dataset.fotow;
    delete previewBox.dataset.fotoh;
    btnSalvar.textContent = 'Adicionar foto';
    btnCancelar.classList.add('hidden');
  }

  btnCancelar.addEventListener('click', limparForm);

  btnSalvar.addEventListener('click', async () => {
    btnSalvar.disabled = true;
    try {
      const dados = {
        nome: nomeInput.value.trim(),
        curso: cursoInput.value.trim(),
        cidade: cidadeInput.value.trim(),
        distrito: distritoInput.value.trim(),
        posX, posY, zoom
      };
      if(fotoAtual){
        dados.foto = fotoAtual.dataUrl;
        dados.fotoW = fotoAtual.width;
        dados.fotoH = fotoAtual.height;
      }
      if(!editingId && !dados.foto && !dados.nome){
        alert('Adicione ao menos uma foto ou um nome antes de salvar.');
        btnSalvar.disabled = false;
        return;
      }
      if(editingId){
        await db.collection(collectionName).doc(editingId).update(dados);
        if(msgEl) msgEl.innerHTML = '<p style="color:var(--success);font-size:13px;margin:10px 0;">Atualizado com sucesso.</p>';
      } else {
        dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        dados.ordem = items.length;
        await db.collection(collectionName).add(dados);
        if(msgEl) msgEl.innerHTML = '<p style="color:var(--success);font-size:13px;margin:10px 0;">Foto adicionada com sucesso.</p>';
      }
      limparForm();
      setTimeout(() => { if(msgEl) msgEl.innerHTML = ''; }, 3500);
    } catch(err){
      alert('Erro ao salvar: ' + err.message);
    } finally {
      btnSalvar.disabled = false;
    }
  });

  window['editarGaleria_' + prefix] = function(id){
    const item = items.find(x => x.id === id);
    if(!item) return;
    editingId = id;
    fotoAtual = null;
    nomeInput.value = item.nome || '';
    cursoInput.value = item.curso || '';
    cidadeInput.value = item.cidade || '';
    distritoInput.value = item.distrito || '';
    fotoInput.value = '';
    posX = item.posX ?? 50;
    posY = item.posY ?? 50;
    zoom = item.zoom ?? 1;
    if(item.foto && item.fotoW && item.fotoH){
      previewBox.style.backgroundImage = `url(${item.foto})`;
      previewWrap.classList.remove('hidden');
      atualizarPreview();
    } else if(item.foto){
      /* foto antiga, salva antes do recurso de zoom — calcular dimensões agora
         para já habilitar arrastar/zoom sem precisar reenviar o arquivo */
      previewBox.style.backgroundImage = `url(${item.foto})`;
      previewBox.style.backgroundSize = 'cover';
      previewBox.style.backgroundPosition = 'center';
      previewWrap.classList.remove('hidden');
      const imgTemp = new Image();
      imgTemp.onload = () => {
        if(editingId !== id) return; // usuário já trocou de item enquanto carregava
        fotoAtual = { dataUrl: item.foto, width: imgTemp.naturalWidth, height: imgTemp.naturalHeight };
        posX = 50; posY = 50; zoom = 1;
        atualizarPreview();
      };
      imgTemp.src = item.foto;
    } else {
      previewWrap.classList.add('hidden');
    }
    btnSalvar.textContent = 'Salvar alterações';
    btnCancelar.classList.remove('hidden');
    document.getElementById(prefix + '_form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window['excluirGaleria_' + prefix] = async function(id){
    if(!confirm('Tem certeza que deseja excluir esta foto?')) return;
    try {
      await db.collection(collectionName).doc(id).delete();
      if(editingId === id) limparForm();
    } catch(err){
      alert('Erro ao excluir: ' + err.message);
    }
  };

  function markupFoto(it, alt){
    if(it.foto && it.fotoW && it.fotoH){
      return `<div class="foto-enquadrada" data-fotow="${it.fotoW}" data-fotoh="${it.fotoH}" data-zoom="${it.zoom ?? 1}" data-posx="${it.posX ?? 50}" data-posy="${it.posY ?? 50}" style="background-image:url('${it.foto}');" title="${alt}"></div>`;
    }
    if(it.foto){
      return `<div class="foto-enquadrada"><img src="${it.foto}" alt="${alt}" style="width:100%;height:100%;object-fit:cover;display:block;"></div>`;
    }
    return null;
  }

  function renderAdminList(){
    if(!listaEl) return;
    if(items.length === 0){
      listaEl.innerHTML = '<p style="color:var(--gray);font-size:13px;">Nenhuma foto adicionada ainda.</p>';
      return;
    }
    listaEl.innerHTML = items.map(it => `
      <div class="galeria-admin-item" data-id="${it.id}">
        <div class="drag-handle" title="Arraste para reordenar">⠿</div>
        ${markupFoto(it, it.nome || '') || '<div class="avatar-fallback"></div>'}
        <div class="nome">${it.nome || '(sem nome)'}</div>
        <div class="info">${[it.curso, it.cidade, it.distrito].filter(Boolean).join(' · ') || '—'}</div>
        <div class="acoes">
          <button class="btn small secondary" onclick="editarGaleria_${prefix}('${it.id}')">Editar</button>
          <button class="btn small danger" onclick="excluirGaleria_${prefix}('${it.id}')">Excluir</button>
        </div>
      </div>
    `).join('');
    aplicarEnquadramentosEm(listaEl);
    tornarListaArrastavel(listaEl, novaOrdemIds => salvarNovaOrdem(collectionName, novaOrdemIds));
  }

  function renderPublicGrid(){
    const grid = document.getElementById(publicGridId);
    const section = document.getElementById(publicSectionId);
    if(!grid || !section) return;
    if(items.length === 0){
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    grid.innerHTML = items.map(it => {
      const alt = (it.nome || 'Jovem do projeto').replace(/"/g, '&quot;');
      const fotoHtml = markupFoto(it, alt) || `
        <div class="galeria-foto-wrap">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        </div>`;
      const seloHtml = destaque ? `
        <div class="selo-formado" title="Formado(a) através do projeto">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="2"><path d="M12 3L1 8l11 5 9-4.1V15"/><path d="M5 10.5V16c0 1.5 3 3.5 7 3.5s7-2 7-3.5v-5.5"/></svg>
        </div>` : '';
      return `
        <div class="galeria-card${destaque ? ' galeria-card--formado' : ''}">
          ${seloHtml}
          ${fotoHtml}
          ${it.nome ? `<div class="galeria-nome">${it.nome}</div>` : ''}
          ${it.curso ? `<div class="galeria-curso">${it.curso}</div>` : ''}
          ${(it.cidade || it.distrito) ? `<div class="galeria-local">${[it.cidade, it.distrito].filter(Boolean).join(' · ')}</div>` : ''}
        </div>
      `;
    }).join('');
    ajustarLarguraCards(prefix);
    aplicarEnquadramentosEm(grid);
    atualizarSetasCarrossel(prefix);
  }

  db.collection(collectionName).onSnapshot(snap => {
    items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => {
      const oa = a.ordem ?? Number.MAX_SAFE_INTEGER;
      const ob = b.ordem ?? Number.MAX_SAFE_INTEGER;
      if(oa !== ob) return oa - ob;
      return (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0);
    });
    renderAdminList();
    renderPublicGrid();
  }, err => {
    if(listaEl) listaEl.innerHTML = `<p style="color:#ffb3a8;font-size:13px;">Erro ao carregar: ${err.message}</p>`;
  });
}

initGaleria({
  collectionName: ESTUDANTES_COLLECTION,
  prefix: 'ge',
  publicSectionId: 'secaoEstudantesPublic',
  publicGridId: 'galeriaEstudantesPublicGrid',
  destaque: false
});
configurarCarrossel('ge');

initGaleria({
  collectionName: FORMADOS_COLLECTION,
  prefix: 'gf',
  publicSectionId: 'secaoFormadosPublic',
  publicGridId: 'galeriaFormadosPublicGrid',
  destaque: true
});
configurarCarrossel('gf');

/* =========================================================
   TÍTULOS DAS SEÇÕES DE GALERIA (editáveis pelo admin)
   Ficam salvos no Firestore e atualizam a página pública
   em tempo real.
========================================================= */
const TITULO_PADRAO_GE = 'Jovens estudando através do Projeto';
const TITULO_PADRAO_GF = 'Galeria de Formados através do Projeto';
const DESCRICAO_PADRAO_GE = 'Conheça jovens que estão na faculdade por meio do Projeto Sonhando Alto.';
const DESCRICAO_PADRAO_GF = 'Conheça jovens que já realizaram seu sonho da formatura através do Projeto Sonhando Alto.';

/* Monta o HTML do título destacando a última palavra em dourado,
   igual ao efeito visual já usado (ex: "...através do <b>Projeto</b>") */
function montarHtmlTitulo(texto){
  const partes = (texto || '').trim().split(/\s+/);
  if(partes.length <= 1) return `<span class="grad-text">${texto || ''}</span>`;
  const ultima = partes.pop();
  return `${partes.join(' ')} <span class="grad-text">${ultima}</span>`;
}

function aplicarTitulosPublicos(dados){
  const tituloGe = (dados && dados.tituloEstudantes) || TITULO_PADRAO_GE;
  const tituloGf = (dados && dados.tituloFormados) || TITULO_PADRAO_GF;
  const descricaoGe = (dados && dados.descricaoEstudantes) || DESCRICAO_PADRAO_GE;
  const descricaoGf = (dados && dados.descricaoFormados) || DESCRICAO_PADRAO_GF;

  const elGe = document.getElementById('tituloEstudantesPublic');
  if(elGe) elGe.innerHTML = montarHtmlTitulo(tituloGe);

  const elGf = document.getElementById('tituloFormadosPublic');
  if(elGf) elGf.innerHTML = montarHtmlTitulo(tituloGf);

  const descGeEl = document.getElementById('descricaoEstudantesPublic');
  if(descGeEl) descGeEl.textContent = descricaoGe;

  const descGfEl = document.getElementById('descricaoFormadosPublic');
  if(descGfEl) descGfEl.textContent = descricaoGf;

  const inputGe = document.getElementById('titulo_ge');
  if(inputGe && document.activeElement !== inputGe) inputGe.value = tituloGe;

  const inputGf = document.getElementById('titulo_gf');
  if(inputGf && document.activeElement !== inputGf) inputGf.value = tituloGf;

  const descInputGe = document.getElementById('descricao_ge');
  if(descInputGe && document.activeElement !== descInputGe) descInputGe.value = descricaoGe;

  const descInputGf = document.getElementById('descricao_gf');
  if(descInputGf && document.activeElement !== descInputGf) descInputGf.value = descricaoGf;
}

db.collection(CONFIG_COLLECTION).doc('galeria').onSnapshot(snap => {
  aplicarTitulosPublicos(snap.exists ? snap.data() : null);
}, () => {
  aplicarTitulosPublicos(null);
});

document.getElementById('btnSalvarTitulos')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnSalvarTitulos');
  const msg = document.getElementById('msg_titulos');
  const tituloGe = document.getElementById('titulo_ge').value.trim() || TITULO_PADRAO_GE;
  const tituloGf = document.getElementById('titulo_gf').value.trim() || TITULO_PADRAO_GF;
  const descricaoGe = document.getElementById('descricao_ge').value.trim() || DESCRICAO_PADRAO_GE;
  const descricaoGf = document.getElementById('descricao_gf').value.trim() || DESCRICAO_PADRAO_GF;

  btn.disabled = true;
  const textoOriginal = btn.textContent;
  btn.textContent = 'Salvando...';
  try {
    await db.collection(CONFIG_COLLECTION).doc('galeria').set({
      tituloEstudantes: tituloGe,
      tituloFormados: tituloGf,
      descricaoEstudantes: descricaoGe,
      descricaoFormados: descricaoGf
    }, { merge: true });
    if(msg){
      msg.innerHTML = '<p style="color:var(--success);font-size:13px;margin:10px 0;">Títulos atualizados com sucesso.</p>';
      setTimeout(() => { msg.innerHTML = ''; }, 3500);
    }
  } catch(err){
    if(msg) msg.innerHTML = `<p style="color:#ffb3a8;font-size:13px;margin:10px 0;">Erro ao salvar: ${err.message}</p>`;
  }
  btn.disabled = false;
  btn.textContent = textoOriginal;
});
