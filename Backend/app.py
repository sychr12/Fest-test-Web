"""Serve the Festtest interface; speed measurements run in the visitor's browser."""

import json
import os
import threading
import time
from urllib.request import Request, urlopen

from flask import Flask, jsonify, redirect, render_template, url_for

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
speedtest_servers_url = "https://www.speedtest.net/api/js/servers?engine=js&https_functional=1&limit=10000"
manaus_cache_seconds = 900
manaus_error_cache_seconds = 60
manaus_sponsors = {
    "unitelecom": "UNITELECOM",
    "tim brasil": "TIM Brasil",
    "vtal": "Vtal",
    "i-systems": "I-Systems",
    "i_mais": "i_mais",
    "xtreme soluções": "Xtreme Soluções",
    "linkamos": "LINKAMOS",
    "jd telecom": "JD TELECOM",
}
manaus_host_order = tuple(manaus_sponsors.values())
manaus_hosts_cache = []
manaus_hosts_cache_expires = 0.0
manaus_hosts_cache_lock = threading.Lock()

app = Flask(
    __name__,
    template_folder=os.path.join(project_root, "Frontend", "templates"),
    static_folder=os.path.join(project_root, "Frontend", "static"),
)
app.config.update(TEMPLATES_AUTO_RELOAD=True, SEND_FILE_MAX_AGE_DEFAULT=0)


def get_manaus_hosts():
    global manaus_hosts_cache, manaus_hosts_cache_expires

    with manaus_hosts_cache_lock:
        now = time.monotonic()
        if now < manaus_hosts_cache_expires:
            return manaus_hosts_cache

        try:
            request = Request(
                speedtest_servers_url,
                headers={"Accept": "application/json", "User-Agent": "Festtest Web"},
            )
            with urlopen(request, timeout=3) as response:
                servers = json.loads(response.read().decode("utf-8"))

            hosts_by_sponsor = {}
            for server in servers:
                if not isinstance(server, dict):
                    continue
                city = server.get("name")
                sponsor_name = server.get("sponsor")
                if (
                    server.get("cc") != "BR"
                    or not isinstance(city, str)
                    or city.casefold() != "manaus"
                    or not isinstance(sponsor_name, str)
                ):
                    continue

                sponsor = manaus_sponsors.get(sponsor_name.strip().casefold())
                if not sponsor:
                    continue

                try:
                    distance = float(server["distance"])
                except (KeyError, TypeError, ValueError):
                    distance = None

                host = {
                    "name": sponsor,
                    "city": city,
                    "distanceMiles": distance,
                    "id": str(server.get("id", "")),
                }
                existing = hosts_by_sponsor.get(sponsor)
                if existing is None or (
                    distance is not None
                    and (existing["distanceMiles"] is None or distance < existing["distanceMiles"])
                ):
                    hosts_by_sponsor[sponsor] = host

            hosts = [hosts_by_sponsor[name] for name in manaus_host_order if name in hosts_by_sponsor]
            if not hosts:
                raise ValueError("A API não retornou anfitriões compatíveis de Manaus.")
        except (OSError, TypeError, ValueError):
            manaus_hosts_cache = []
            manaus_hosts_cache_expires = now + manaus_error_cache_seconds
            return manaus_hosts_cache

        manaus_hosts_cache = hosts
        manaus_hosts_cache_expires = now + manaus_cache_seconds
        return hosts


@app.after_request
def disable_stale_page_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/manaus-hosts")
def manaus_hosts():
    hosts = get_manaus_hosts()
    source = "ookla" if hosts else "fallback"
    return jsonify({"hosts": hosts, "source": source})


@app.get("/favicon.ico")
def favicon():
    return redirect(url_for("static", filename="favicon.svg"))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
