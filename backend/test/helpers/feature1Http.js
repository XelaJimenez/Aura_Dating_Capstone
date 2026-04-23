const http = require("http");
const { once } = require("events");
const path = require("path");
const express = require("express");

function loadFeature1Env() {
    require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env") });
    require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
}

function feature1PostgresEnvReady() {
    const h = String(process.env.DB_HOST || "").trim();
    if (!h) return false;
    if (h.includes("\u2026")) return false;
    if (h === "…" || h === "...") return false;
    if (/^<[^>]+>$/.test(h)) return false;
    return true;
}

function makeFeature1App() {
    const app = express();
    app.use(express.json({ limit: "15mb" }));
    app.use("/matches", require("../../routes/match"));
    app.use("/auth", require("../../routes/auth"));
    app.use("/profile", require("../../routes/profile"));
    return app;
}

async function withFeature1Server(app, fn) {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
        await fn(baseUrl);
    } finally {
        server.close();
        await Promise.race([
            once(server, "close"),
            new Promise((r) => setTimeout(r, 2000)),
        ]);
    }
}

async function feature1Fetch(baseUrl, pathname, options = {}) {
    const { method = "GET", body, headers = {} } = options;
    const url = `${baseUrl}${pathname}`;
    const h = { ...headers };
    let reqBody;
    if (body !== undefined) {
        reqBody = JSON.stringify(body);
        h["Content-Type"] = "application/json";
    }
    const res = await fetch(url, { method, headers: h, body: reqBody });
    let text;
    if (typeof res.text === "function") {
        text = await res.text();
    } else if (typeof res.json === "function") {
        const bodyVal = await res.json();
        text = typeof bodyVal === "string" ? bodyVal : JSON.stringify(bodyVal);
    } else {
        text = "";
    }
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        json = { _raw: text };
    }
    const status = typeof res.status === "number" ? res.status : 0;
    return { status, json, text };
}

module.exports = {
    loadFeature1Env,
    feature1PostgresEnvReady,
    makeFeature1App,
    withFeature1Server,
    feature1Fetch,
};
