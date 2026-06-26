import base64
import json
import re
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from fill_workbook import fill_workbook  # noqa: E402

TMP_DIR = Path("/tmp/packinglist")
MAX_BODY_BYTES = 35 * 1024 * 1024
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def clean_dimension(value):
    return (
        str(value or "")
        .replace("×", "*")
        .replace("X", "*")
        .replace("x", "*")
        .replace("＊", "*")
        .replace(" ", "")
        .replace("\t", "")
        .replace("，", "")
        .replace(",", "")
        .replace("。", "")
        .strip()
    )


def normalize_payload(payload):
    data = payload or {}
    raw_items = data.get("items") if isinstance(data.get("items"), list) else []
    project_name = str(data.get("projectName") or data.get("consignee") or "").strip()
    items = []
    for index, item in enumerate(raw_items[:33]):
        items.append(
            {
                "actualBoxNo": str(item.get("actualBoxNo") or f"{index + 1}#").strip(),
                "boxNo": int(item.get("boxNo") or index + 1),
                "chineseName": str(item.get("chineseName") or "").strip(),
                "englishName": str(item.get("englishName") or "").strip(),
                "quantity": float(item.get("quantity") or 1),
                "unit": str(item.get("unit") or "箱").strip(),
                "size": clean_dimension(item.get("size")),
                "weight": str(item.get("weight") or "/").strip() or "/",
                "note": str(item.get("note") or "").strip(),
            }
        )
    return {
        "elevatorSpec": str(data.get("elevatorSpec") or "").strip(),
        "projectName": project_name,
        "consignee": project_name,
        "address": str(data.get("address") or "").strip(),
        "factoryNumber": str(data.get("factoryNumber") or "").strip(),
        "shipDate": str(data.get("shipDate") or "").strip(),
        "contractNumber": str(data.get("contractNumber") or "").strip(),
        "contactPhone": str(data.get("contactPhone") or "").strip(),
        "recipient": str(data.get("recipient") or "").strip(),
        "items": items,
    }


def send_json(request, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request.send_response(status)
    request.send_header("Content-Type", "application/json; charset=utf-8")
    request.send_header("Content-Length", str(len(body)))
    request.end_headers()
    request.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY_BYTES:
                raise ValueError("请求太大，请压缩图片或换一张较小的文件。")
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            if not body.get("templateBase64"):
                raise ValueError("Vercel 部署环境没有本机默认模版，请先上传 Excel 模版。")

            TMP_DIR.mkdir(parents=True, exist_ok=True)
            template_path = TMP_DIR / f"{uuid.uuid4()}-template.xlsx"
            output_path = TMP_DIR / f"{uuid.uuid4()}-output.xlsx"
            template_path.write_bytes(base64.b64decode(body["templateBase64"]))

            data = normalize_payload(body.get("data"))
            fill_workbook(template_path, output_path, data)
            file_bytes = output_path.read_bytes()
            safe_factory = re.sub(r"[^\w.-]+", "_", data.get("factoryNumber") or "shipping-mark")
            filename = f"{safe_factory}-{int(time.time() * 1000)}.xlsx"

            self.send_response(200)
            self.send_header("Content-Type", XLSX_MIME)
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(file_bytes)))
            self.end_headers()
            self.wfile.write(file_bytes)
        except Exception as error:
            send_json(self, 500, {"error": str(error)})
