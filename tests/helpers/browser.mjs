import http from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const project = fileURLToPath(new URL('../../', import.meta.url));

export async function launchBrowser() {
  const candidates = [process.env.ONBOARDHQ_BROWSER_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  const executable = candidates.find(candidate => candidate && existsSync(candidate));
  if (!executable) throw Error('Install Chrome/Edge/Chromium or set ONBOARDHQ_BROWSER_PATH to its executable. No UI tests were run.');
  if (!existsSync(path.join(project, 'dist/index.html'))) throw Error('Build the app before running browser tests.');
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const root = path.join(project, 'dist');
    const filename = path.resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
    if (!filename.startsWith(root + path.sep)) {response.writeHead(403).end();return;}
    try {
      response.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(readFileSync(filename));
    } catch { if (!path.extname(pathname)) { response.setHeader('Content-Type','text/html'); response.end(readFileSync(path.join(root,'index.html'))); } else response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = mkdtempSync(path.join(tmpdir(), 'onboardhq-regression-'));
  const child = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  let nextId = 0;
  const requests = new Map();
  const errors = [];
  const browser = {
    errors,
    acceptDialog: false,
    async command(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {requests.delete(id);reject(Error(`CDP timed out: ${method}`));}, 10000);
        requests.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({id, method, params}));
      });
    },
    async evaluate(fn, ...args) {
      const result = await this.command('Runtime.evaluate', {expression:`(${fn.toString()})(...${JSON.stringify(args)})`, awaitPromise:true, returnByValue:true});
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    },
    async waitFor(fn) {
      for (let attempt = 0; attempt < 100; attempt++) { if (await this.evaluate(fn)) return; await pause(30); }
      throw Error(`Browser condition timed out: ${fn}`);
    },
    async click(selector) {
      await this.evaluate(selector => {const element = document.querySelector(selector);if(!element)throw Error(`Missing ${selector}`);element.click();}, selector);
      await pause(45);
    },
    async textClick(selector, text) {
      await this.evaluate((selector,text) => {const element = [...document.querySelectorAll(selector)].find(element => element.textContent.trim() === text);if(!element)throw Error(`Missing ${text}`);element.click();},selector,text);
      await pause(45);
    },
    async fill(selector, value) {
      await this.evaluate((selector,value) => {
        const element = document.querySelector(selector);if(!element)throw Error(`Missing ${selector}`);
        const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);
        element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));
      },selector,value);
      await pause(30);
    },
    async key(key, code = key, keyCode = 0, modifiers = 0) {
      await this.command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:keyCode,modifiers});
      await this.command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode,modifiers});
      await pause(45);
    },
    async reset() {
      this.acceptDialog = false;
      await this.evaluate(() => { localStorage.clear(); history.replaceState(null,'','/'); });
      await this.command('Page.reload');
      await this.waitFor(() => document.querySelector('h1')?.textContent === 'Dashboard');

      errors.length = 0;
    },
    async close() {
      try { if(socket?.readyState===1) await this.command('Browser.close'); } catch { /* Browser may close before its final response. */ }
      socket?.close(); child.kill();
      for (const request of requests.values()) {clearTimeout(request.timer);request.reject(Error('Browser closed'));}
      requests.clear(); server.close();
      const tempRoot = path.resolve(tmpdir()) + path.sep;
      const resolvedProfile = path.resolve(profile);
      if (resolvedProfile.startsWith(tempRoot) && path.basename(resolvedProfile).startsWith('onboardhq-regression-')) {
        try {rmSync(resolvedProfile,{recursive:true,force:true,maxRetries:3,retryDelay:100});} catch { /* A browser process may still hold its temporary profile. */ }
      }
    },
  };
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    let port
    for(let attempt=0;attempt<150;attempt++) {
      try { const value=readFileSync(portFile,'utf8').split('\n')[0]; if (/^\d+$/.test(value.trim())) { port=value.trim(); break; } } catch { /* Edge may hold the startup file briefly. */ }
      await pause(100)
    }
    if(!port) throw Error('Browser debugging endpoint did not start.')
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response=>response.json());
    socket = new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    socket.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(message.id){const request=requests.get(message.id);requests.delete(message.id);if(!request)return;clearTimeout(request.timer);if(message.error)request.reject(Error(JSON.stringify(message.error)));else request.resolve(message.result);}
      else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
      else if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params);
      else if(message.method==='Page.javascriptDialogOpening')browser.command('Page.handleJavaScriptDialog',{accept:message.params.type==='beforeunload'||browser.acceptDialog}).catch(error=>errors.push(error.message));
    });
    await browser.command('Runtime.enable');await browser.command('Page.enable');
    await browser.command('Emulation.setTimezoneOverride',{timezoneId:'Asia/Calcutta'});
    await browser.command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await browser.command('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
    await browser.waitFor(()=>!!document.querySelector('h1'));
    return browser;
  } catch(error) {await browser.close();throw error;}
}
