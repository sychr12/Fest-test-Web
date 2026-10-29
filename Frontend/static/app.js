const $ = (id) => document.getElementById(id);

const ui = {
  button: $("run-test"),
  buttonLabel: $("button-label"),
  card: $("results-card"),
  description: $("analysis-copy"),
  download: $("download-value"),
  downloadFill: $("download-fill"),
  error: $("test-error"),
  host: $("host-select"),
  hostDescription: $("host-description"),
  hostPicker: $("host-picker"),
  hostPickerButton: $("open-host-picker"),
  hostPickerEmpty: $("host-picker-empty"),
  hostPickerList: $("host-picker-list"),
  hostResult: $("measured-host"),
  hostSearch: $("host-search"),
  ip: $("user-ip"),
  jitter: $("jitter-value"),
  phase: $("phase-label"),
  ping: $("ping-value"),
  selectedHostName: $("selected-host-name"),
  selectAutoHost: $("select-auto-host"),
  closeHostPicker: $("close-host-picker"),
  state: $("test-state"),
  statusPill: document.querySelector(".status-pill"),
  steps: [...document.querySelectorAll(".test-step")],
  upload: $("upload-value"),
  uploadFill: $("upload-fill"),
};

const config = {
  ipv6Url: "https://ipv6-api.speedtest.net/getip",
  ipv6TimeoutMs: 3000,
  manausHostsUrl: "/api/manaus-hosts",
  serverListUrl: "/static/server-list.json",
};

const dash = "\u2014";
const fallbackManausHosts = [
  "UNITELECOM", "TIM Brasil", "Vtal", "I-Systems", "i_mais",
  "Xtreme Solu\u00e7\u00f5es", "LINKAMOS", "JD TELECOM",
];
const appState = {
  compatibleHosts: [],
  currentStage: -1,
  manausHosts: [],
  running: false,
  speedTest: null,
};

function format(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(number)
    : dash;
}

function normaliseServer(server, index) {
  const source = String(server.server || "");
  const base = source.startsWith("//") ? `https:${source}` : source.replace(/^http:\/\//i, "https://");
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error("Host must use HTTPS");
  return {
    ...server,
    localId: String(index),
    server: base.endsWith("/") ? base : `${base}/`,
  };
}

function parseCompatibleHosts(data) {
  return data
    .filter((server) => server && server.name && server.server && server.dlURL && server.ulURL && server.pingURL && server.getIpURL)
    .map((server, index) => {
      try { return normaliseServer(server, index); } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseManausHosts(data) {
  const fromApi = Array.isArray(data?.hosts) ? data.hosts : [];
  const comparable = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const known = new Map(fromApi.map((host) => [comparable(host.name), host]));
  return fallbackManausHosts.map((name, index) => known.get(comparable(name)) || {
    id: `fallback-${index}`,
    name,
    city: "Manaus",
    distanceMiles: 1,
  });
}

function distanceText(host) {
  const miles = Number(host.distanceMiles);
  if (!Number.isFinite(miles)) return "Manaus";
  const rounded = Math.max(0, Math.round(miles));
  return `${rounded} ${rounded === 1 ? "mile" : "miles"}`;
}

function hostByValue(value) {
  if (!value.startsWith("manaus:")) return null;
  const id = value.slice("manaus:".length);
  return appState.manausHosts.find((host) => String(host.id) === id) || null;
}

function renderHostPicker(query = ui.hostSearch.value) {
  const filter = String(query || "").trim().toLocaleLowerCase();
  const hosts = appState.manausHosts.filter((host) => host.name.toLocaleLowerCase().includes(filter));
  ui.hostPickerList.replaceChildren();

  hosts.forEach((host) => {
    const item = document.createElement("button");
    item.className = "host-picker-item";
    item.dataset.hostValue = `manaus:${host.id}`;
    item.type = "button";

    const name = document.createElement("span");
    name.className = "host-picker-name";
    name.textContent = host.name;
    const metadata = document.createElement("span");
    metadata.className = "host-picker-meta";
    const city = document.createElement("span");
    city.textContent = host.city || "Manaus";
    const distance = document.createElement("span");
    distance.textContent = distanceText(host);
    metadata.append(city, distance);
    item.append(name, metadata);
    ui.hostPickerList.append(item);
  });
  ui.hostPickerEmpty.hidden = hosts.length > 0;
}

function renderHostOptions() {
  const manausGroup = document.createElement("optgroup");
  manausGroup.label = "Manaus";
  appState.manausHosts.forEach((host) => manausGroup.append(new Option(host.name, `manaus:${host.id}`)));

  const compatibleGroup = document.createElement("optgroup");
  compatibleGroup.label = "Outros anfitrioes compativeis";
  appState.compatibleHosts.forEach((host) => compatibleGroup.append(new Option(host.name, host.localId)));

  ui.host.replaceChildren(new Option("Selecionar automaticamente", "auto"), manausGroup, compatibleGroup);
  ui.host.disabled = false;
  ui.button.disabled = false;
  ui.buttonLabel.textContent = "Iniciar teste";
  ui.selectedHostName.textContent = "Selecionar automaticamente";
  ui.hostDescription.textContent = `${appState.manausHosts.length} anfitrioes em Manaus`;
  renderHostPicker();
}

function renderLoadError() {
  ui.host.replaceChildren(new Option("Lista indisponivel", ""));
  ui.hostDescription.textContent = "Nao foi possivel carregar os anfitrioes";
  ui.selectedHostName.textContent = "Lista indisponivel";
  ui.buttonLabel.textContent = "Lista indisponivel";
  ui.error.textContent = "Nao foi possivel carregar a lista de anfitrioes. Atualize a pagina e tente novamente.";
  ui.error.hidden = false;
}

async function loadHosts() {
  try {
    const [compatibleResponse, manausResponse] = await Promise.all([
      fetch(config.serverListUrl, { cache: "no-store" }),
      fetch(config.manausHostsUrl, { cache: "no-store" }),
    ]);
    if (!compatibleResponse.ok) throw new Error("Host catalog unavailable");
    appState.compatibleHosts = parseCompatibleHosts(await compatibleResponse.json());
    appState.manausHosts = parseManausHosts(manausResponse.ok ? await manausResponse.json() : null);
    if (!appState.compatibleHosts.length) throw new Error("No compatible hosts");
    renderHostOptions();
  } catch {
    renderLoadError();
  }
}

function setStage(stage, label) {
  if (Number.isInteger(stage) && stage >= 0 && stage < 3) appState.currentStage = stage;
  document.querySelector(".download-metric")?.classList.toggle("is-measuring", stage === 1);
  document.querySelector(".upload-metric")?.classList.toggle("is-measuring", stage === 2);
  ui.steps.forEach((step, index) => {
    step.classList.toggle("is-complete", index < appState.currentStage);
    step.classList.toggle("is-active", index === appState.currentStage && appState.running);
  });
  if (label) ui.phase.textContent = label;
}

function setRunning(running) {
  appState.running = running;
  ui.button.disabled = running || !appState.compatibleHosts.length || Boolean(hostByValue(ui.host.value));
  ui.hostPickerButton.disabled = running;
  ui.statusPill.classList.toggle("is-running", running);
  ui.card.classList.toggle("is-running", running);
  ui.buttonLabel.textContent = running ? "Analisando conexao..." : "Refazer teste";
  ui.state.textContent = running ? "ANALISANDO SUA INTERNET" : "ANALISE CONCLUIDA";
  if (!running) {
    document.querySelector(".download-metric")?.classList.remove("is-measuring");
    document.querySelector(".upload-metric")?.classList.remove("is-measuring");
  }
}

function resetResults() {
  ui.error.hidden = true;
  ui.download.textContent = ui.upload.textContent = dash;
  ui.ping.textContent = ui.jitter.textContent = dash;
  ui.downloadFill.style.width = ui.uploadFill.style.width = "0";
  ui.hostResult.textContent = dash;
  ui.steps.forEach((step) => step.classList.remove("is-active", "is-complete"));
  appState.currentStage = -1;
}

function failTest(message) {
  ui.error.textContent = message;
  ui.error.hidden = false;
  setRunning(false);
  ui.state.textContent = "FALHA NA MEDICAO";
  ui.phase.textContent = "TESTE INTERROMPIDO";
}

function updateSelectedHost() {
  if (appState.running) return;
  resetResults();
  const manausHost = hostByValue(ui.host.value);
  const compatibleHost = appState.compatibleHosts.find((host) => host.localId === ui.host.value);
  ui.description.textContent = "Meça a velocidade real da sua conexao neste dispositivo.";
  ui.ip.textContent = "IPv6 publico: sera verificado no teste";

  if (manausHost) {
    ui.selectedHostName.textContent = manausHost.name;
    ui.hostDescription.textContent = `${manausHost.city || "Manaus"} · ${distanceText(manausHost)} · requer SDK Ookla`;
    ui.hostResult.textContent = manausHost.name;
    ui.button.disabled = true;
    ui.buttonLabel.textContent = "SDK Ookla necessario";
    ui.phase.textContent = "ANFITRIAO SELECIONADO";
    ui.state.textContent = "AGUARDANDO SDK OOKLA";
    return;
  }

  ui.selectedHostName.textContent = compatibleHost?.name || "Selecionar automaticamente";
  ui.hostDescription.textContent = ui.host.value === "auto"
    ? `${appState.compatibleHosts.length} anfitrioes; menor ping sera escolhido`
    : compatibleHost?.name || "Escolha um anfitriao";
  ui.button.disabled = false;
  ui.buttonLabel.textContent = "Iniciar teste";
  ui.phase.textContent = "AGUARDANDO TESTE";
  ui.state.textContent = "PRONTO PARA ANALISAR";
}

function openHostPicker() {
  if (appState.running) return;
  ui.hostSearch.value = "";
  renderHostPicker("");
  if (typeof ui.hostPicker.showModal === "function") ui.hostPicker.showModal();
  else ui.hostPicker.setAttribute("open", "");
  ui.hostSearch.focus();
}

function closeHostPicker() {
  if (typeof ui.hostPicker.close === "function") ui.hostPicker.close();
  else ui.hostPicker.removeAttribute("open");
}

function chooseHost(value) {
  ui.host.value = value;
  closeHostPicker();
  updateSelectedHost();
}

async function detectPublicIPv6() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ipv6TimeoutMs);
  try {
    const response = await fetch(config.ipv6Url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const value = (await response.text()).trim().replace(/^\[|\]$/g, "");
    return value.includes(":") ? value : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function paint(data) {
  const state = Number(data.testState);
  const download = Number(data.dlStatus);
  const upload = Number(data.ulStatus);
  if (Number.isFinite(download)) ui.download.textContent = format(download);
  if (Number.isFinite(upload)) ui.upload.textContent = format(upload);
  if (Number.isFinite(Number(data.pingStatus))) ui.ping.textContent = format(data.pingStatus);
  if (Number.isFinite(Number(data.jitterStatus))) ui.jitter.textContent = format(data.jitterStatus);
  if (Number.isFinite(Number(data.dlProgress))) ui.downloadFill.style.width = `${Math.min(100, Math.max(0, data.dlProgress * 100))}%`;
  if (Number.isFinite(Number(data.ulProgress))) ui.uploadFill.style.width = `${Math.min(100, Math.max(0, data.ulProgress * 100))}%`;
  if (state === 1) setStage(1, "MEDINDO DOWNLOAD");
  else if (state === 2) setStage(0, "MEDINDO PING");
  else if (state === 3) setStage(2, "MEDINDO UPLOAD");
}

function startMeasurement(host, test) {
  if (!host) return failTest("Nenhum anfitriao respondeu. Escolha outro e tente novamente.");
  ui.hostResult.textContent = host.name;
  ui.hostDescription.textContent = `${host.name}${Number.isFinite(host.pingT) ? ` · ${format(host.pingT)} ms` : ""}`;
  test.start();
}

async function startTest() {
  if (appState.running || hostByValue(ui.host.value)) return;
  if (!navigator.onLine) return failTest("Este dispositivo esta sem conexao com a internet.");
  resetResults();
  setRunning(true);
  ui.phase.textContent = "VERIFICANDO IPV6";
  ui.ip.textContent = "Consultando API de IPv6...";
  const ipv6 = await detectPublicIPv6();
  ui.ip.textContent = ipv6 ? `IPv6 publico: ${ipv6}` : "IPv6 nao confirmado";
  try {
    const test = new Speedtest();
    appState.speedTest = test;
    test.setParameter("test_order", "P_D_U");
    test.setParameter("telemetry_level", 0);
    test.addTestPoints(appState.compatibleHosts);
    test.onupdate = paint;
    test.onend = (aborted) => {
      if (aborted) return failTest("O teste foi interrompido. Tente novamente.");
      setRunning(false);
      ui.phase.textContent = "TESTE CONCLUIDO";
      ui.steps.forEach((step) => { step.classList.remove("is-active"); step.classList.add("is-complete"); });
    };
    if (ui.host.value === "auto") {
      setStage(0, "PROCURANDO MENOR PING");
      test.selectServer((host) => startMeasurement(host, test));
    } else {
      const host = appState.compatibleHosts.find((item) => item.localId === ui.host.value);
      test.setSelectedServer(host);
      startMeasurement(host, test);
    }
  } catch {
    failTest("Nao foi possivel iniciar o teste. Atualize a pagina e tente novamente.");
  }
}

ui.hostPickerButton.addEventListener("click", openHostPicker);
ui.closeHostPicker.addEventListener("click", closeHostPicker);
ui.selectAutoHost.addEventListener("click", () => chooseHost("auto"));
ui.hostSearch.addEventListener("input", () => renderHostPicker());
ui.hostPickerList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-host-value]");
  if (item) chooseHost(item.dataset.hostValue);
});
ui.button.addEventListener("click", startTest);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && appState.running && appState.speedTest?.getState() === 3) appState.speedTest.abort();
});

loadHosts();
