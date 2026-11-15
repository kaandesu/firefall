# Get started: a real setup

The hosted demo is a scripted replay and needs nothing. This page is for the real thing on your own machine:
a Lagrange server, FIREFALL connected to it, and an agent that can call FIREFALL's tools.

```
 Step 1  Lagrange running          http://localhost:8080
 Step 2  FIREFALL connected        the Team screen lists your server
 Step 3  The tools server          12 tools on http://localhost:8765/mcp
 Step 4  An agent with the tools   it answers with numbers it computed
 Step 5  A real FDS run            it opens in the FDS tab
```

**What is real here, and what is not yet.** The agents, their messages, the tool calls and the FDS runs in this
setup are real. The review screens (plan, run, report) are still the scripted replay: connected agents do not
drive them yet.

[Lagrange](https://lagrange.3agents.dev) is the server every message goes through
([source](https://github.com/three-agent-problem/lagrange)). There is no hosted instance to sign up for yet, so
you run your own. It is one binary plus Postgres.

---

## Step 1 · Start a Lagrange server

Pick one.

### A. Without Docker (easiest on a Mac)

You need the `lagrange` binary and Postgres:

```sh
go install github.com/three-agent-problem/lagrange/cmd/lagrange@latest
brew install postgresql@16        # you do not need to start it as a service
```

Then, from the repo root:

```sh
scripts/lagrange-local.sh up
```

It creates a small Postgres in `.firefall/pg` (port 55432, its own data, nothing shared with other databases on
your machine), starts Lagrange, makes an admin account, mints an API key and saves it in `web/.env.local`.

✅ **You should see** `Lagrange is running.` with the web app address and the login. `scripts/lagrange-local.sh status`
shows both as `up`.

| Command | Does |
|---|---|
| `scripts/lagrange-local.sh up` | start (safe to run again) |
| `scripts/lagrange-local.sh down` | stop; agents, tasks and the account stay |
| `scripts/lagrange-local.sh status` / `logs` | what is running / follow the server log |
| `scripts/lagrange-local.sh reset --yes` | delete all of it |

### B. With Docker (a laptop, a VPS, Coolify)

```sh
cp .env.example .env      # set POSTGRES_PASSWORD, the admin account, LAGRANGE_PUBLIC_URL
docker compose up -d      # the first start builds Lagrange from source: a few minutes
```

`docker-compose.yml` runs Lagrange and a Postgres with a named volume (`lagrange-pg`), so the data survives
restarts and rebuilds. Only Lagrange exposes a port (8080). On a server, put it behind HTTPS and set
`LAGRANGE_PUBLIC_URL` to that address; the proxy must pass WebSockets (`/tunnel`) and must not buffer
server-sent events (`/api/events`).

✅ **You should see** `docker compose ps` list `lagrange` as healthy, and a login page at `LAGRANGE_PUBLIC_URL`.

Then get an API key: log in, **Settings → API keys → Create key** (role *member* is enough), and copy the `lgk_…` key.

### C. You already have a Lagrange server

Use its URL and one of your API keys in step 2.

---

## Step 2 · Connect FIREFALL

```sh
cd web
pnpm install
pnpm dev          # http://localhost:5180
```

On the start screen choose **Connect**. With path A the server is already saved, so it shows `Signed in as …` and
**open the team**. Otherwise paste the server URL and the key; they are checked and saved to `web/.env.local`.
The key stays on the dev server and is never sent to the browser.

✅ **You should see** the Team screen, with your server's address above an (almost) empty list.

---

## Step 3 · Start the tools server

FIREFALL's data and models as an [MCP](https://modelcontextprotocol.io) server, so an agent can use them with
its own parameters:

```sh
cd web
pnpm tools        # http://localhost:8765/mcp
```

| Tool | What an agent gets |
|---|---|
| `get_cabin` | the cabin under review: atmosphere, materials, hatch, hull limit, detectors |
| `search_studies` | NASA's combustion studies ranked for an atmosphere |
| `nearest_tests` | the closest real test points, and a warning when nothing was tested there |
| `limiting_o2`, `spread_rate` | will a material burn, and how fast, at a given O₂, flow, gravity, pressure |
| `droplet_burn` | does a droplet keep burning with CO₂ added |
| `fire_spread` | the cabin fire and pressure model, with what-ifs (atmosphere, gravity, swapped materials) |
| `smoke_alarm` | 2-D smoke CFD: time to alarm at a gravity level, and a better detector layout |
| `run_fds`, `fds_status`, `list_fds_runs` | start a real NIST FDS run and read its result |
| `search_report` | passages from the 144-page BASS-II Summary Report, with page numbers |

✅ **You should see** `firefall-tools: 12 tools on http://localhost:8765/mcp`.

`run_fds` needs NIST FDS 6.11 ([releases](https://github.com/firemodels/fds/releases)) at `~/FDS/bin/fds_openmp`,
or set `FDS=/path/to/fds`. Without it the other tools still work. `search_report` needs `scripts/prep-psi.sh` to
have run (its output is committed, so normally it has).

You can also give the tools to your own Claude Code: `claude mcp add firefall -- pnpm -C web tools --stdio`.

---

## Step 4 · Add an agent that has the tools

The agent is Claude Code, connected through a Lagrange tunnel. Once:

```sh
npm i -g @agentclientprotocol/claude-agent-acp     # and run `claude` once to log in
```

On the Team screen click **+ agent**, give it a handle (for example `sim`) and copy the
**Claude Code with FIREFALL tools** command. It looks like this:

```sh
lagrange tunnel --server http://localhost:8080 --token lgr_… \
  --acp claude-agent-acp --dir . \
  --mcp firefall=http://localhost:8765/mcp \
  --allow read,search,fetch,think,other
```

`--allow` lets it read and call tools without asking each time; it still asks before editing files or running
shell commands, and those questions land in your Lagrange inbox. Add `--model haiku` for a cheaper agent.

✅ **You should see** `tunnel connected: the agent is online` in the terminal, and the agent turn green on the
Team screen within a second. Press **test**: it answers in a few seconds.

No Claude account at hand? The **echo** command gives you an agent that repeats what it is sent, which is
enough to see addresses appear and messages travel.

Now ask it something real. From the Lagrange inbox (http://localhost:8080), or the shell:

```sh
lagrange login --server http://localhost:8080
lagrange send @sim --wait "For nylon at 34% O2, 8.2 psia, lunar gravity: does it burn and how fast? \
Then run fire_spread for that atmosphere and say whether the hull ruptures."
```

✅ **You should see** an answer with numbers (about 4 mm/s, limiting O₂ near 25 %). In Lagrange, **Runs** shows
the tool calls it made: `limiting_o2`, `spread_rate`, `fire_spread`.

---

## Step 5 · Let it run FDS

```sh
lagrange send @sim --wait "Start an FDS run of the cabin at Moon gravity with a 50 kW burner, 5 simulated \
seconds. Wait for it and tell me the peak heat release and whether anything else caught fire."
```

A 5-second run takes about 40 s on a laptop; the full 30 seconds takes 1 to 4 minutes. One run at a time.

✅ **You should see** the run under **FDS → agent runs** in FIREFALL (or open `?view=fds&run=<id>`), with the same
3-D viewer and charts as the shipped runs. The files are in `web/public/data/fds/runs/<id>/`.

---

## The data you can add

`scripts/prep-psi.sh` turns raw PSI downloads in `data/PSI-98` and `data/PSI-25` into small WebP frames and a
searchable report under `web/public/data/`. The raw folders are gitignored. In the app: **Library → Saffire-I**
and **Library → BASS-II**, tab *open test data*.

## When something is off

| You see | Do |
|---|---|
| `the lagrange binary is not on your PATH` | `go install …` above; make sure `$(go env GOPATH)/bin` is on your PATH |
| `port 8080 is taken` | `LAGRANGE_PORT=8081 scripts/lagrange-local.sh up` |
| Connect says the key was rejected | after a `reset` the old key is gone: run `up` again, then reload |
| The agent stays grey | the tunnel is not running, or it points at another server URL |
| `FDS is not installed at …` | install FDS, or set `FDS=` before `pnpm tools` |
| `FDS is busy with run …` | one run at a time: wait for it, or check `fds_status` |
| The Team screen updates only on reload (behind a proxy) | the proxy is buffering `/api/events` |
