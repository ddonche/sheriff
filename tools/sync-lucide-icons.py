"""Import a fixed lucide-static release. No npm scripts or package code run."""
import argparse, base64, hashlib, io, json, re, tarfile, urllib.request
from pathlib import Path
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument("version", help="Exact lucide-static version")
parser.add_argument("--archive", type=Path, help="Optional previously downloaded tarball")
args = parser.parse_args()
if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", args.version):
    parser.error("Use an exact numeric version")
root = Path(__file__).resolve().parents[1]
icons = root / "sheriff-core/assets/icons"
metadata = json.load(urllib.request.urlopen("https://registry.npmjs.org/lucide-static/" + args.version, timeout=30))
archive = args.archive.read_bytes() if args.archive else urllib.request.urlopen(metadata["dist"]["tarball"], timeout=60).read()
integrity = "sha512-" + base64.b64encode(hashlib.sha512(archive).digest()).decode()
if integrity != metadata["dist"]["integrity"]:
    raise ValueError("Lucide tarball integrity mismatch")
files = {}
with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
    license_text = bundle.extractfile("package/LICENSE").read()
    for member in bundle.getmembers():
        if not member.name.startswith("package/icons/") or not member.name.endswith(".svg"):
            continue
        name = member.name.removeprefix("package/icons/")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*\.svg", name) or not member.isfile():
            raise ValueError("Unexpected icon member: " + member.name)
        svg = bundle.extractfile(member).read()
        document = ET.fromstring(svg)
        allowed = {"svg", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect", "g", "title", "desc"}
        for node in document.iter():
            if node.tag.rsplit("}", 1)[-1] not in allowed or any(key.lower().startswith("on") or key.rsplit("}", 1)[-1] in {"href", "src"} for key in node.attrib):
                raise ValueError("Unexpected SVG content: " + name)
        files[name] = svg
aliases = {"warning": "triangle-alert"}
previous = {p.name for p in icons.glob("*.svg")}
missing = previous - files.keys() - {key + ".svg" for key in aliases}
if missing:
    raise ValueError("Map removed names before updating: " + ", ".join(sorted(missing)))
for alias, target in aliases.items():
    files[alias + ".svg"] = files[target + ".svg"]
icons.mkdir(parents=True, exist_ok=True)
for name, svg in files.items():
    (icons / name).write_bytes(svg)
notice = icons.parent / "lucide"
notice.mkdir(exist_ok=True)
(notice / "LICENSE.txt").write_bytes(license_text)
(notice / "catalog.json").write_text(json.dumps({"package": "lucide-static", "version": args.version, "integrity": integrity, "source": metadata["dist"]["tarball"], "icons": len(files) - len(aliases), "aliases": aliases}, indent=2) + "\n", encoding="utf-8")
print(f"Imported {len(files) - len(aliases)} Lucide icons + {len(aliases)} compatibility alias; version {args.version}; license retained.")
