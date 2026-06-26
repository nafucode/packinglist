import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

MAX_BODY_BYTES = 35 * 1024 * 1024


def send_json(request, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request.send_response(status)
    request.send_header("Content-Type", "application/json; charset=utf-8")
    request.send_header("Content-Length", str(len(body)))
    request.end_headers()
    request.wfile.write(body)


def openai_extract(image_base64, mime_type):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("未设置 OPENAI_API_KEY。可以先手工填写/粘贴 JSON，再导出 Excel。")

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "elevatorSpec": {"type": "string"},
            "projectName": {"type": "string"},
            "address": {"type": "string"},
            "factoryNumber": {"type": "string"},
            "shipDate": {"type": "string"},
            "contractNumber": {"type": "string"},
            "contactPhone": {"type": "string"},
            "recipient": {"type": "string"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "actualBoxNo": {"type": "string"},
                        "boxNo": {"type": "number"},
                        "chineseName": {"type": "string"},
                        "englishName": {"type": "string"},
                        "quantity": {"type": "number"},
                        "unit": {"type": "string"},
                        "size": {"type": "string"},
                        "weight": {"type": "string"},
                        "note": {"type": "string"},
                    },
                    "required": [
                        "actualBoxNo",
                        "boxNo",
                        "chineseName",
                        "englishName",
                        "quantity",
                        "unit",
                        "size",
                        "weight",
                        "note",
                    ],
                },
            },
        },
        "required": [
            "elevatorSpec",
            "projectName",
            "address",
            "factoryNumber",
            "shipDate",
            "contractNumber",
            "contactPhone",
            "recipient",
            "items",
        ],
    }
    payload = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": "请识别这张电梯装箱明细表照片，提取第一页送货单需要填写的信息。收货单位位置请作为项目名 projectName 提取。只输出符合 schema 的 JSON。尺寸统一为 2850*550*960 这种格式；看不清的字段留空；包装状态不用提取；每一行箱子都保留。",
                    },
                    {
                        "type": "input_image",
                        "image_url": f"data:{mime_type};base64,{image_base64}",
                    },
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "shipping_mark_data",
                "strict": True,
                "schema": schema,
            }
        },
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8")[:500]
        raise RuntimeError(f"识别失败：{error.code} {detail}") from error

    output_text = result.get("output_text")
    if not output_text:
        for item in result.get("output", []):
            for part in item.get("content", []):
                if part.get("type") == "output_text":
                    output_text = part.get("text")
                    break
            if output_text:
                break
    if not output_text:
        raise RuntimeError("识别结果为空。")
    return json.loads(output_text)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY_BYTES:
                raise ValueError("请求太大，请压缩图片或换一张较小的照片。")
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            data = openai_extract(body.get("imageBase64", ""), body.get("mimeType") or "image/jpeg")
            send_json(self, 200, {"data": data})
        except Exception as error:
            send_json(self, 500, {"error": str(error)})
