#!/usr/bin/env node
// Runs ml_service commands inside its Python virtualenv.
//   node scripts/ml.mjs install   create .venv and install requirements
//   node scripts/ml.mjs serve     uvicorn on :8000 (downloads the model first if needed)
//   node scripts/ml.mjs test      download test (fake Drive) + service test (needs the model)
//   node scripts/ml.mjs download  fetch/refresh the model from Google Drive
import { spawnSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ml = join(root, "ml_service");
const isWin = process.platform === "win32";
const venvPy = join(ml, ".venv", isWin ? "Scripts/python.exe" : "bin/python");

function findPython() {
  for (const cand of ["python3.11", "python3.12", "python3", "python"]) {
    try {
      const v = execSync(`${cand} -c "import sys;print(sys.version_info[:2]>=(3,10))"`, { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
      if (v === "True") return cand;
    } catch {}
  }
  console.error("Python 3.10+ not found. Install Python 3.11 and re-run.");
  process.exit(1);
}

function py(args, extraEnv = {}) {
  if (!existsSync(venvPy)) {
    console.error("ml_service/.venv is missing. Run: npm run setup  (or node scripts/ml.mjs install)");
    process.exit(1);
  }
  const r = spawnSync(venvPy, args, { cwd: ml, stdio: "inherit", env: { ...process.env, PYTHONUNBUFFERED: "1", ...extraEnv } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const cmd = process.argv[2];
if (cmd === "install") {
  if (!existsSync(venvPy)) execSync(`${findPython()} -m venv .venv`, { cwd: ml, stdio: "inherit" });
  py(["-m", "pip", "install", "-q", "--upgrade", "pip"]);
  py(["-m", "pip", "install", "-q", "-r", "requirements.txt"]);
} else if (cmd === "serve") {
  py(["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", process.env.ML_PORT ?? "8000"]);
} else if (cmd === "test") {
  py(["test_download_artifacts.py"]);
  py(["test_ranking.py"]);
  py(["test_generator.py"]);
  py(["test_service.py"]);
} else if (cmd === "download") {
  py(["download_artifacts.py", ...process.argv.slice(3)]);
} else {
  console.error("usage: node scripts/ml.mjs install|serve|test|download");
  process.exit(1);
}
