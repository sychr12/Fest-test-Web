# Festtest Web

Aplicação web para medir a velocidade da conexão. O Flask entrega a página e os arquivos estáticos; as medições LibreSpeed são executadas diretamente no navegador do visitante.

## Como funciona

1. O Flask serve a interface em `/` e os arquivos da pasta `Frontend/static`.
2. O navegador carrega a lista de servidores LibreSpeed de `Frontend/static/server-list.json`.
3. No modo automático, o LibreSpeed mede o ping dos servidores disponíveis e escolhe o de menor latência. Também é possível selecionar um servidor manualmente.
4. O teste mede ping, download e upload no navegador e atualiza os resultados na página. A telemetria LibreSpeed está desativada.

Os anfitriões de Manaus mostrados primeiro no seletor (UNITELECOM, TIM Brasil, Vtal, I-Systems, Claro Fibra - MNS, i_mais, Xtreme Soluções, LINKAMOS e JD TELECOM) podem ser selecionados, mas ainda não iniciam uma medição: o botão fica desativado até haver endpoints compatíveis com o LibreSpeed. Eles não redirecionam para outros sites nem iniciam uma medição incorreta.

Ao carregar a página, o Flask consulta a API pública da Ookla para atualizar cidade e distância desses anfitriões. A resposta fica em cache por 15 minutos. Se a API estiver indisponível, a lista local de nomes continua sendo exibida. Essa consulta parte do servidor Flask e não abre outro site no navegador.

## Estrutura do projeto

- `Backend/app.py`: aplicação Flask e rota da página inicial.
- `Frontend/templates/index.html`: estrutura HTML da interface.
- `Frontend/static/app.js`: seleção de anfitriões, execução dos testes e atualização dos resultados.
- `Frontend/static/style.css` e `Frontend/static/motion.css`: estilos e animações.
- `Frontend/static/server-list.json`: servidores compatíveis com LibreSpeed.
- `requirements.txt`: dependências Python da aplicação.

## Requisitos

- Python instalado
- Acesso à internet para instalar o Flask e carregar os recursos e servidores públicos

## Instalação no Windows

Abra o PowerShell na pasta do projeto e execute:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python Backend\app.py
```

Depois, acesse <http://localhost:5000>. Para encerrar o servidor, pressione `Ctrl+C` no terminal.

Se o PowerShell bloquear a ativação do ambiente virtual, execute os comandos sem ativá-lo:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe Backend\app.py
```

## Instalação no macOS ou Linux

Na pasta do projeto, execute:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python Backend/app.py
```

Abra <http://localhost:5000>. A porta padrão é `5000`; para escolher outra, defina a variável `PORT` antes de iniciar. No PowerShell, por exemplo: `$env:PORT = "5001"`.

## Servidores

Os servidores LibreSpeed são configurados em `Frontend/static/server-list.json`. Cada registro precisa conter o endereço HTTPS e as rotas de ping, download, upload e consulta de IP esperadas pelo LibreSpeed. Servidores públicos são administrados por terceiros e podem ficar indisponíveis. Para ativar os anfitriões de Manaus, é necessário obter essas rotas compatíveis dos provedores; os endereços Ookla não funcionam com este mecanismo.

O endpoint interno `/api/manaus-hosts` consulta a lista da Ookla e filtra os provedores prioritários de Manaus. Esses dados servem somente para exibir os anfitriões; não são endpoints de teste LibreSpeed.

## Privacidade e precisão

O Flask não recebe nem encaminha o tráfego dos testes LibreSpeed: o navegador se comunica diretamente com o servidor escolhido, que pode receber o endereço IP do visitante. Ao iniciar uma medição, o navegador também consulta `https://ipv6-api.speedtest.net/getip` para verificar IPv6. Essa consulta recebe o endereço IP da conexão; se a API não responder, o teste LibreSpeed continua.

Os resultados variam conforme o servidor, a rota, a carga da rede e o dispositivo, e podem diferir de outros serviços de teste que usam servidores e métodos distintos.

## Arquivos de terceiros

`Frontend/static/librespeed.js` e `Frontend/static/speedtest_worker.js` são do LibreSpeed e estão distribuídos sob GNU LGPL versão 3 ou posterior. Consulte `Frontend/static/librespeed-LICENSE.txt`. A lista de servidores LibreSpeed está em `Frontend/static/server-list.json`.

O Flask incluído é um servidor de desenvolvimento. Para publicar a aplicação, use um servidor WSGI apropriado e configure HTTPS.
