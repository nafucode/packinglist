const fields = [
  "elevatorSpec",
  "projectName",
  "address",
  "factoryNumber",
  "shipDate",
  "contractNumber",
  "contactPhone",
  "recipient",
];

const sampleData = {
  elevatorSpec: "TKJ 800/1.0-VF",
  projectName: "苏州欣富机机电有限公司",
  address: "",
  factoryNumber: "XFJ2026-2016",
  shipDate: "",
  contractNumber: "",
  contactPhone: "",
  recipient: "",
  items: [
    { chineseName: "轿壁箱，含门板", englishName: "Car Wall Panel and Door Panel", size: "760*560*960" },
    { chineseName: "曳引机", englishName: "Motor", size: "760*460*700" },
    { chineseName: "控制柜箱", englishName: "Control Cabinet", size: "1760*510*350" },
    { chineseName: "上坎箱，含门机", englishName: "Upper Sill and Door Operator", size: "1720*520*650" },
    { chineseName: "电气部件箱", englishName: "Electric Parts", size: "1260*760*750" },
    { chineseName: "机械部件箱", englishName: "Mechanical Parts", size: "1260*750*950" },
    { chineseName: "轿底箱", englishName: "Car Bottom", size: "1700*1400*380" },
    { chineseName: "对重架", englishName: "Counterweight Frame", size: "3400*920*260" },
    { chineseName: "搁机梁", englishName: "Motor Support Beam", size: "2450*460*250" },
    { chineseName: "直梁箱", englishName: "Straight Beam", size: "3350*240*260" },
    { chineseName: "对重块", englishName: "Counterweight", size: "1000*620*500" },
    { chineseName: "对重块", englishName: "Counterweight", size: "1000*620*500" },
    { chineseName: "导轨", englishName: "Guide Rail", size: "5000*460*270" },
    { chineseName: "吊顶箱", englishName: "Ceiling", size: "1700*1400*250" },
    { chineseName: "钢丝绳", englishName: "Steel Wire Rope", size: "420*420*420" },
    { chineseName: "支架箱", englishName: "Support Bracket", size: "1750*550*460" },
  ].map((item, index) => ({
    actualBoxNo: `${index + 1}#`,
    boxNo: index + 1,
    quantity: 1,
    unit: index === 6 || index === 7 || index === 12 || index === 14 ? "件" : "箱",
    weight: "/",
    note: "",
    ...item,
  })),
};

const state = {
  templateFile: null,
  imageFile: null,
  data: structuredClone(sampleData),
  useDefaultTemplate: true,
};

const els = {
  templateInput: document.getElementById("templateInput"),
  imageInput: document.getElementById("imageInput"),
  templateName: document.getElementById("templateName"),
  imageName: document.getElementById("imageName"),
  previewImage: document.getElementById("previewImage"),
  itemsBody: document.getElementById("itemsBody"),
  extractBtn: document.getElementById("extractBtn"),
  exportBtn: document.getElementById("exportBtn"),
  addRowBtn: document.getElementById("addRowBtn"),
  syncJsonBtn: document.getElementById("syncJsonBtn"),
  jsonInput: document.getElementById("jsonInput"),
  toast: document.getElementById("toast"),
};

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2800);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readForm() {
  const data = { items: [] };
  fields.forEach((key) => {
    data[key] = document.getElementById(key).value.trim();
  });
  [...els.itemsBody.querySelectorAll("tr")].forEach((row, index) => {
    const value = (key) => row.querySelector(`[data-key="${key}"]`).value.trim();
    const item = {
      actualBoxNo: value("actualBoxNo") || `${index + 1}#`,
      boxNo: Number(value("boxNo") || index + 1),
      chineseName: value("chineseName"),
      englishName: value("englishName"),
      quantity: Number(value("quantity") || 1),
      unit: value("unit") || "箱",
      size: value("size"),
      weight: value("weight") || "/",
      note: value("note"),
    };
    if (item.chineseName || item.englishName || item.size) data.items.push(item);
  });
  state.data = data;
  return data;
}

function renderJson() {
  els.jsonInput.value = JSON.stringify(readForm(), null, 2);
}

function applyData(data) {
  const incoming = {
    ...data,
    projectName: data.projectName || data.consignee || "",
  };
  state.data = {
    ...structuredClone(sampleData),
    ...incoming,
    items: Array.isArray(incoming.items) ? incoming.items : [],
  };
  fields.forEach((key) => {
    document.getElementById(key).value = state.data[key] || "";
  });
  renderRows();
  els.jsonInput.value = JSON.stringify(state.data, null, 2);
}

function renderRows() {
  els.itemsBody.innerHTML = "";
  state.data.items.forEach((item, index) => addRow(item, index));
}

function cellInput(key, value, type = "text") {
  return `<input data-key="${key}" type="${type}" value="${String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">`;
}

function addRow(item = {}, index = els.itemsBody.children.length) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${cellInput("boxNo", item.boxNo || index + 1, "number")}</td>
    <td>${cellInput("chineseName", item.chineseName || "")}</td>
    <td>${cellInput("englishName", item.englishName || "")}</td>
    <td>${cellInput("quantity", item.quantity || 1, "number")}</td>
    <td>${cellInput("unit", item.unit || "箱")}</td>
    <td>${cellInput("size", item.size || "")}</td>
    <td>${cellInput("weight", item.weight || "/")}</td>
    <td>${cellInput("note", item.note || "")}</td>
    <td><button class="remove-row" type="button" title="删除">×</button>${cellInput("actualBoxNo", item.actualBoxNo || `${index + 1}#`)}</td>
  `;
  row.querySelector('[data-key="actualBoxNo"]').hidden = true;
  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
    readForm();
    renderJson();
  });
  row.addEventListener("input", renderJson);
  els.itemsBody.append(row);
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }
  return res;
}

els.templateInput.addEventListener("change", () => {
  state.templateFile = els.templateInput.files[0] || null;
  state.useDefaultTemplate = !state.templateFile;
  els.templateName.textContent = state.templateFile ? state.templateFile.name : "使用默认模版";
});

els.imageInput.addEventListener("change", () => {
  state.imageFile = els.imageInput.files[0] || null;
  els.imageName.textContent = state.imageFile ? state.imageFile.name : "选择图片";
  if (state.imageFile) {
    els.previewImage.src = URL.createObjectURL(state.imageFile);
  }
});

els.extractBtn.addEventListener("click", async () => {
  if (!state.imageFile) return toast("请选择装箱图片");
  try {
    els.extractBtn.disabled = true;
    els.extractBtn.textContent = "识别中";
    const imageBase64 = await fileToBase64(state.imageFile);
    const res = await postJson("/api/extract", { imageBase64, mimeType: state.imageFile.type || "image/jpeg" });
    const payload = await res.json();
    applyData(payload.data);
    toast("识别完成，请校对后导出");
  } catch (error) {
    toast(error.message);
  } finally {
    els.extractBtn.disabled = false;
    els.extractBtn.textContent = "识别图片";
  }
});

els.exportBtn.addEventListener("click", async () => {
  try {
    const data = readForm();
    const templateBase64 = state.templateFile ? await fileToBase64(state.templateFile) : null;
    const res = await postJson("/api/export", {
      data,
      templateBase64,
      useDefaultTemplate: !state.templateFile,
    });
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const filename = decodeURIComponent(disposition.match(/filename="(.+)"/)?.[1] || `${data.factoryNumber || "shipping-mark"}.xlsx`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast("Excel 已导出");
  } catch (error) {
    toast(error.message);
  }
});

els.addRowBtn.addEventListener("click", () => {
  addRow();
  renderJson();
});

els.syncJsonBtn.addEventListener("click", () => {
  try {
    applyData(JSON.parse(els.jsonInput.value));
    toast("JSON 已同步");
  } catch {
    toast("JSON 格式不正确");
  }
});

fetch("/api/defaults")
  .then((res) => res.json())
  .then((info) => {
    if (!info.templateOk) {
      state.useDefaultTemplate = false;
      els.templateName.textContent = "请选择 Excel 模版";
    }
  })
  .catch(() => {});

applyData(sampleData);
