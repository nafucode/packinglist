# Packing List / 唛头表工具

一个本地网页工具，用于把装箱师傅拍的电梯装箱明细图片识别成 Excel 唛头表。

## 功能

- 上传装箱明细图片，调用 Gemini 或 OpenAI 视觉模型识别项目名、箱号、箱名、尺寸等信息。
- 在网页里人工校对识别结果。
- 只填写 Excel 模版第一页 `FJPN送货单`。
- 自动按尺寸计算单箱 CBM 和总 CBM。
- 按实际箱数删除多余唛头页，例如 16 个箱子时删除 `17#(23)` 之后的工作表。
- 保留模版格式和后续唛头页公式引用。

## 运行

```bash
pip install -r requirements.txt
npm run dev
```

打开：

```text
http://127.0.0.1:4173
```

## AI 识别

图片识别优先使用 Gemini，设置 `GOOGLE_API_KEY` 即可：

```bash
export GOOGLE_API_KEY="你的 Gemini key"
npm run dev
```

也可以设置 `GEMINI_MODEL` 切换模型，默认是 `gemini-2.0-flash-lite`。

如果没有 `GOOGLE_API_KEY`，工具会回退使用 `OPENAI_API_KEY`。

未设置 key 时，也可以在网页里手工填写或粘贴 JSON，然后导出 Excel。

## 默认文件

当前服务默认读取本机文件：

- `/Users/naf/Downloads/22号发货唛头XFJ25-108163(1).xlsx`
- `/Users/naf/Downloads/微信图片_20260626082450_103_321.jpg`

实际使用时也可以直接在页面上传新的 Excel 模版和图片。

## Vercel 部署

这个项目已经包含 Vercel 所需的 `api/*.py` serverless 接口和 `vercel.json`。

部署到 Vercel 后建议在项目环境变量里设置：

```text
GOOGLE_API_KEY=你的 Gemini key
```

可选：

```text
GEMINI_MODEL=gemini-2.0-flash-lite
OPENAI_API_KEY=你的 OpenAI key（仅作为备用）
```

线上环境没有本机 `Downloads` 里的默认 Excel 模版，所以导出前需要在页面上传 Excel 模版。
