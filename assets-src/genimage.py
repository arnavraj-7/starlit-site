#!/usr/bin/env python3
"""Generate an image via Vertex AI and write it to disk.

Vertex is used deliberately instead of the AI Studio Gemini API: the AI Studio
endpoint bills against separate "prepayment credits" that the GCP free credit does
NOT cover, whereas Vertex bills through normal GCP billing.

    python scripts/genimage.py --prompt "..." --out frontend/public/hero-bg.png
"""
from __future__ import annotations

import argparse
import base64
import json
import pathlib
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

import os

# Set VERTEX_PROJECT, or replace the fallback with your project id.
PROJECT = os.environ.get("VERTEX_PROJECT") or "CHANGE-ME"
LOCATION = "global"
MODEL = "gemini-3.1-flash-image"
ENDPOINT = (
    f"https://aiplatform.googleapis.com/v1/projects/{PROJECT}"
    f"/locations/{LOCATION}/publishers/google/models/{MODEL}:generateContent"
)


if PROJECT == "CHANGE-ME":
    raise SystemExit(
        "Set VERTEX_PROJECT=<your-gcp-project> (or edit PROJECT in this file)."
    )


def _token() -> str:
    # On Windows gcloud is a .cmd shim, so a bare "gcloud" is not resolvable by
    # CreateProcess. Resolve the real executable first.
    exe = shutil.which("gcloud") or shutil.which("gcloud.cmd")
    if not exe:
        sys.exit("gcloud not found on PATH")
    out = subprocess.run(
        [exe, "auth", "print-access-token"],
        capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()


def generate(prompt: str, out_path: pathlib.Path, aspect: str | None = None) -> pathlib.Path:
    config = {"responseModalities": ["IMAGE"]}
    if aspect:
        config["imageConfig"] = {"aspectRatio": aspect}
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": config,
    }
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {_token()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as e:
        sys.exit(f"Vertex error {e.code}: {e.read().decode()[:500]}")

    for cand in payload.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            blob = part.get("inlineData", {}).get("data")
            if blob:
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_bytes(base64.b64decode(blob))
                return out_path
    sys.exit(f"No image in response: {json.dumps(payload)[:500]}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--out", required=True, type=pathlib.Path)
    ap.add_argument("--aspect", default=None, help="e.g. 16:9, 21:9, 9:16")
    a = ap.parse_args()
    p = generate(a.prompt, a.out, a.aspect)
    print(f"wrote {p} ({p.stat().st_size:,} bytes)")
