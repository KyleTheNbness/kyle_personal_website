const modules = document.querySelector('#modules');
const fields = document.querySelector('#fields');
const notice = document.querySelector('#notice');
const save = document.querySelector('#save');
const download = document.querySelector('#download');
let page, original, fileHandle, dirty = false;
const blocks = [];

function changed() {
  dirty = true;
  notice.textContent = '有未保存的修改';
}
function field(parent, name, value, update, multiline = false) {
  const label = document.createElement('label');
  label.textContent = name;
  const input = document.createElement(multiline ? 'textarea' : 'input');
  if (multiline) input.rows = Math.min(6, Math.max(2, Math.ceil(value.length / 65)));
  input.value = value;
  input.oninput = () => { update(input.value); changed(); };
  label.append(input);
  parent.append(label);
}
function button(parent, name, action, disabled = false) {
  const control = document.createElement('button');
  control.textContent = name;
  control.onclick = action;
  control.disabled = disabled;
  parent.append(control);
}
function editBlock(parent, block) {
  const labels = {H1:'姓名', H3:'标题', P:'正文', FIGCAPTION:'图注', A:'链接文字', DIV:'状态', I:'斜体文字'};
  const walker = page.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node;
    if (!text.textContent.trim()) continue;
    const element = text.parentElement;
    field(parent, labels[element.tagName] || '文字', text.textContent,
      value => { text.textContent = value; }, element.tagName === 'P');
    if (element.matches('a')) {
      field(parent, '链接地址', element.getAttribute('href'), value => element.setAttribute('href', value.trim()));
    }
  }
}
function render() {
  fields.replaceChildren();
  const block = blocks[Number(modules.value)];
  const articles = [...block.querySelectorAll('article')];
  for (const item of articles.length ? articles : [block]) {
    const box = document.createElement('fieldset');
    fields.append(box);
    for (const el of item.querySelectorAll('h1,h3,p,.status,figcaption,.contacts a,article > a')) editBlock(box, el);
    if (articles.length) {
      const index = articles.indexOf(item);
      button(box, '上移', () => { articles[index-1].before(item); changed(); render(); }, index === 0);
      button(box, '下移', () => { articles[index+1].after(item); changed(); render(); }, index === articles.length-1);
      button(box, '删除条目', () => {
        if (confirm('删除这个条目？')) { item.remove(); changed(); render(); }
      });
    }
  }
  if (block.matches('section:not(#about)')) button(fields, '添加条目', () => {
    const item = page.createElement('article');
    if (block.id === 'research') {
      const status = page.createElement('div');
      status.className = 'status';
      status.textContent = 'In progress';
      item.append(status);
    }
    for (const [tag, value] of [['h3','Title'], ['p','Description']]) {
      const el = page.createElement(tag);
      el.textContent = value;
      item.append(el);
    }
    block.querySelector(':scope > div').append(item);
    changed(); render();
  });
}
function serialize() {
  for (const link of page.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (!href || !['https:', 'http:', 'mailto:'].includes(new URL(href, location.href).protocol)) {
      throw Error('请检查链接地址。');
    }
  }
  return '<!doctype html>\n' + page.documentElement.outerHTML + '\n';
}
download.onclick = () => {
  try {
    const url = URL.createObjectURL(new Blob([serialize()], {type:'text/html'}));
    const link = document.createElement('a');
    link.href = url; link.download = 'index.html'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    notice.textContent = '请用下载的文件替换网站目录中的 index.html。';
  } catch (error) { notice.textContent = error.message; }
};
save.onclick = async () => {
  try {
    const html = serialize();
    fileHandle ??= (await window.showOpenFilePicker({multiple:false, types:[{description:'首页 HTML',accept:{'text/html':['.html']}}]}))[0];
    const file = await fileHandle.getFile();
    if (file.name !== 'index.html' || (await file.text()) !== original) {
      fileHandle = undefined;
      throw Error('文件与打开编辑器时的首页不同。请选择对应版本，或下载副本。');
    }
    const writer = await fileHandle.createWritable();
    await writer.write(html);
    await writer.close();
    original = html; dirty = false; notice.textContent = '已保存。刷新主页即可查看。';
  } catch (error) { if (error.name !== 'AbortError') notice.textContent = error.message; }
};
window.addEventListener('beforeunload', event => {
  if (dirty) { event.preventDefault(); event.returnValue = ''; }
});
try {
  const response = await fetch('../index.html', {cache:'no-store'});
  if (!response.ok) throw Error('无法读取首页。');
  original = await response.text();
  page = new DOMParser().parseFromString(original, 'text/html');
  blocks.push(...page.querySelectorAll('main > header, main > section'));
  for (const [index, block] of blocks.entries()) {
    modules.add(new Option(block.querySelector('h2')?.textContent || '页首', String(index)));
  }
  modules.onchange = render;
  render();
  save.hidden = !window.showOpenFilePicker;
  save.disabled = false; download.disabled = false;
} catch (error) { notice.textContent = error.message; }
