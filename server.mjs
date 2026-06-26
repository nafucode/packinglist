import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const tmpDir = path.join(__dirname, "tmp");
const exportDir = path.join(__dirname, "exports");
const pythonPath = "/Users/naf/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const defaultTemplatePath = "/Users/naf/Downloads/22号发货唛头XFJ25-108163(1).xlsx";
const defaultImagePath = "/Users/naf/Downloads/微信图片_20260626082450_103_321.jpg";
const port = Number(process.env.PORT || 4173);
const execFileAsync = promisify(execFile);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

await fs.mkdir(tmpDir, { recursive: true });
await fs.mkdir(exportDir, { recursive: true });

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), { "content-type": MIME[".json"] });
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 35 * 1024 * 1024) throw new Error("请求太大，请压缩图片或换一张较小的照片。");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function cleanDimension(value) {
  return String(value || "")
    .replace(/[×Xx＊*]/g, "*")
    .replace(/\s+/g, "")
    .replace(/[，,。]/g, "")
    .trim();
}

function normalizePayload(payload) {
  const data = payload || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const projectName = String(data.projectName || data.consignee || "").trim();
  return {
    elevatorSpec: String(data.elevatorSpec || "").trim(),
    projectName,
    consignee: projectName,
    address: String(data.address || "").trim(),
    factoryNumber: String(data.factoryNumber || "").trim(),
    shipDate: String(data.shipDate || "").trim(),
    contractNumber: String(data.contractNumber || "").trim(),
    contactPhone: String(data.contactPhone || "").trim(),
    recipient: String(data.recipient || "").trim(),
    items: items.slice(0, 33).map((item, index) => ({
      actualBoxNo: String(item.actualBoxNo || `${index + 1}#`).trim(),
      boxNo: Number(item.boxNo || index + 1),
      chineseName: String(item.chineseName || "").trim(),
      englishName: String(item.englishName || "").trim(),
      quantity: Number(item.quantity || 1),
      unit: String(item.unit || "箱").trim(),
      size: cleanDimension(item.size),
      weight: String(item.weight || "/").trim() || "/",
      note: String(item.note || "").trim(),
    })),
  };
}

const extractionPrompt = "请识别这张电梯装箱明细表照片，提取第一页送货单需要填写的信息。收货单位位置请作为项目名 projectName 提取。只输出符合 schema 的 JSON。尺寸统一为 2850*550*960 这种格式；看不清的字段留空；包装状态不用提取；每一行箱子都保留。";

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    elevatorSpec: { type: "string" },
    projectName: { type: "string" },
    address: { type: "string" },
    factoryNumber: { type: "string" },
    shipDate: { type: "string" },
    contractNumber: { type: "string" },
    contactPhone: { type: "string" },
    recipient: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          actualBoxNo: { type: "string" },
          boxNo: { type: "number" },
          chineseName: { type: "string" },
          englishName: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          size: { type: "string" },
          weight: { type: "string" },
          note: { type: "string" },
        },
        required: ["actualBoxNo", "boxNo", "chineseName", "englishName", "quantity", "unit", "size", "weight", "note"],
      },
    },
  },
  required: ["elevatorSpec", "projectName", "address", "factoryNumber", "shipDate", "contractNumber", "contactPhone", "recipient", "items"],
};

function geminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const converted = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    if (key === "type" && typeof value === "string") {
      converted[key] = value.toUpperCase();
    } else {
      converted[key] = geminiSchema(value);
    }
  }
  return converted;
}

async function writeBase64File(base64, ext) {
  const id = crypto.randomUUID();
  const filePath = path.join(tmpDir, `${id}${ext}`);
  await fs.writeFile(filePath, Buffer.from(base64, "base64"));
  return filePath;
}

async function fillWorkbook(templatePath, data) {
  const safeFactory = (data.factoryNumber || "shipping-mark").replace(/[^\w.-]+/g, "_");
  const outPath = path.join(exportDir, `${safeFactory}-${Date.now()}.xlsx`);
  const dataPath = path.join(tmpDir, `${crypto.randomUUID()}-data.json`);
  await fs.writeFile(dataPath, JSON.stringify(data), "utf8");
  await execFileAsync(pythonPath, [
    path.join(__dirname, "scripts", "fill_workbook.py"),
    templatePath,
    dataPath,
    outPath,
  ]);
  return outPath;
}

async function extractWithGemini(imageBase64, mimeType) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: extractionPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: geminiSchema(extractionSchema),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini 识别失败：${response.status} ${text.slice(0, 500)}`);
  }
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!text) throw new Error("Gemini 识别结果为空。");
  return normalizePayload(JSON.parse(text));
}

async function extractWithOpenAI(imageBase64, mimeType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("未设置 GOOGLE_API_KEY 或 OPENAI_API_KEY。可以先手工填写/粘贴 JSON，再导出 Excel。");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: extractionPrompt
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "shipping_mark_data",
          strict: true,
          schema: extractionSchema,
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`识别失败：${response.status} ${text.slice(0, 500)}`);
  }
  const result = await response.json();
  const text = result.output_text || result.output?.flatMap((item) => item.content || []).find((part) => part.type === "output_text")?.text;
  if (!text) throw new Error("识别结果为空。");
  return normalizePayload(JSON.parse(text));
}

async function extractImageData(imageBase64, mimeType) {
  const geminiData = await extractWithGemini(imageBase64, mimeType);
  if (geminiData) return geminiData;
  return extractWithOpenAI(imageBase64, mimeType);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const relPath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.normalize(path.join(publicDir, relPath));
  if (!filePath.startsWith(publicDir)) return send(res, 403, "Forbidden");
  try {
    const body = await fs.readFile(filePath);
    send(res, 200, body, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
  } catch {
    send(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/api/defaults") {
      const [templateOk, imageOk] = await Promise.all([
        fs.access(defaultTemplatePath).then(() => true).catch(() => false),
        fs.access(defaultImagePath).then(() => true).catch(() => false),
      ]);
      return sendJson(res, 200, { templateOk, imageOk, defaultTemplatePath, defaultImagePath });
    }

    if (req.method === "POST" && url.pathname === "/api/extract") {
      const body = await readJson(req);
      const data = await extractImageData(body.imageBase64, body.mimeType || "image/jpeg");
      return sendJson(res, 200, { data });
    }

    if (req.method === "POST" && url.pathname === "/api/export") {
      const body = await readJson(req);
      const data = normalizePayload(body.data);
      const templatePath = body.useDefaultTemplate
        ? defaultTemplatePath
        : await writeBase64File(body.templateBase64, ".xlsx");
      const outPath = await fillWorkbook(templatePath, data);
      const file = await fs.readFile(outPath);
      return send(res, 200, file, {
        "content-type": MIME[".xlsx"],
        "content-disposition": `attachment; filename="${encodeURIComponent(path.basename(outPath))}"`,
        "x-output-path": outPath,
      });
    }

    return serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Shipping mark tool: http://127.0.0.1:${port}`);
});
