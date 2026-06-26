# Packing List / 唛头表工具

一个本地网页工具，用于把装箱师傅拍的电梯装箱明细图片识别成 Excel 唛头表。

## 功能

- 上传装箱明细图片，调用 OpenAI 视觉模型识别项目名、箱号、箱名、尺寸等信息。
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

图片识别需要设置 `OPENAI_API_KEY`：

```bash
export OPENAI_API_KEY="你的 key"
npm run dev
```

未设置 key 时，也可以在网页里手工填写或粘贴 JSON，然后导出 Excel。

## 默认文件

当前服务默认读取本机文件：

- `/Users/naf/Downloads/22号发货唛头XFJ25-108163(1).xlsx`
- `/Users/naf/Downloads/微信图片_20260626082450_103_321.jpg`

实际使用时也可以直接在页面上传新的 Excel 模版和图片。
