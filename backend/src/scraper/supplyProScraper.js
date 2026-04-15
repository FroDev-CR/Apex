import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { Order } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_PATH = path.join(__dirname, '../../.cookies.json');

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

const BASE_URL = 'https://www.hyphensolutions.com/MH2Supply';
const LOGIN_URL = `${BASE_URL}/`;
const ORDERS_URL = `${BASE_URL}/Orders/OrderList.asp?list_view=8`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt) {
  return INITIAL_DELAY * Math.pow(2, attempt);
}

async function loadCookies() {
  try {
    const data = await fs.readFile(COOKIES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveCookies(cookies) {
  try {
    await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('💾 Cookies guardadas para reutilizar sesión');
  } catch (error) {
    console.error('⚠️ No se pudieron guardar las cookies:', error.message);
  }
}

/**
 * Realiza el login en Hyphen Supply Pro
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
async function performLogin(page) {
  const username = process.env.SUPPLYPRO_EMAIL;
  const password = process.env.SUPPLYPRO_PASSWORD;

  if (!username || !password) {
    throw new Error('SUPPLYPRO_EMAIL y SUPPLYPRO_PASSWORD deben estar configurados en .env');
  }

  console.log('🔐 Navegando a la página de login...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Si ya estamos dentro (sesión activa), no hacer login
  if (!page.url().includes('Login') && !page.url().endsWith('/MH2Supply/')) {
    console.log('✅ Sesión activa detectada, no es necesario hacer login');
    return true;
  }

  console.log('🔐 Completando formulario de login...');

  // Esperar a que cargue el formulario de login de Hyphen Solutions
  await page.waitForSelector('input[name="user_name"]', { timeout: 10000 });

  // Selectores exactos del formulario de Hyphen Supply Pro
  await page.fill('input[name="user_name"]', username);
  await page.fill('input[name="password"]', password);

  // Hacer click en el botón de login
  await page.click('input[type="submit"], button[type="submit"]');

  // Esperar navegación post-login
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

  const currentUrl = page.url();
  if (currentUrl.includes('Login') || currentUrl.endsWith('/MH2Supply/')) {
    // Puede que haya un error de credenciales
    const errorMsg = await page.$eval(
      '.error, .Error, font[color="red"], span[style*="red"]',
      el => el.textContent.trim()
    ).catch(() => 'Credenciales incorrectas o página no reconocida');
    throw new Error(`Login fallido: ${errorMsg}`);
  }

  console.log('✅ Login exitoso');
  return true;
}

/**
 * Extrae todos los links de órdenes de la lista paginada
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{href: string, orderId: string}>>}
 */
async function collectOrderLinks(page) {
  const allLinks = [];
  let pageNum = 1;

  console.log('🔍 Navegando a la lista de órdenes recibidas...');
  await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  while (true) {
    console.log(`📄 Recolectando links de la página ${pageNum}...`);

    // Esperar la tabla de órdenes
    await page.waitForSelector('table', { timeout: 10000 });

    // Los links de las órdenes son los "Builder Order #" en la primera columna de datos
    // Tienen formato como "78090448-000" y apuntan a OrderReceive.asp o similar
    const links = await page.$$eval(
      'td a[href*="OrderReceive"], td a[href*="OrderDetail"], td a[href*="ordID"], td a[href*="order_id"]',
      elements => elements.map(el => ({
        href: el.href,
        orderId: el.textContent.trim().replace(/\s+/g, ' ').split('\n')[0].trim()
      })).filter(l => l.orderId && l.orderId.match(/\d{5,}/))
    );

    // Si no encontramos con esos selectores, buscar más ampliamente en la primera columna
    if (links.length === 0) {
      const fallbackLinks = await page.$$eval(
        'table tr td:first-child a',
        elements => elements.map(el => ({
          href: el.href,
          orderId: el.textContent.trim().split('\n')[0].trim()
        })).filter(l => l.href && l.orderId && l.orderId.match(/\d{5,}/))
      );
      allLinks.push(...fallbackLinks);
      console.log(`📋 (fallback) Encontradas ${fallbackLinks.length} órdenes en página ${pageNum}`);
    } else {
      allLinks.push(...links);
      console.log(`📋 Encontradas ${links.length} órdenes en página ${pageNum}`);
    }

    // Buscar link de "siguiente página" — en Hyphen suele ser un link con "Next" o ">"
    const nextLink = await page.$('a:has-text("Next"), a:has-text(">"), a[href*="page="]:last-of-type')
      .catch(() => null);

    if (!nextLink) break;

    const nextHref = await nextLink.getAttribute('href');
    if (!nextHref) break;

    await page.goto(nextHref.startsWith('http') ? nextHref : `${BASE_URL}/Orders/${nextHref}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    pageNum++;
  }

  console.log(`📦 Total de órdenes encontradas: ${allLinks.length}`);
  return allLinks;
}

/**
 * Extrae el detalle completo de una orden individual
 * @param {import('playwright').Page} page
 * @param {{href: string, orderId: string}} orderLink
 * @returns {Promise<Object|null>}
 */
async function extractOrderDetail(page, orderLink) {
  console.log(`🔎 Extrayendo orden ${orderLink.orderId}...`);

  await page.goto(orderLink.href, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const orderData = await page.evaluate(() => {
    // Textos del panel "Additional Views" que hay que ignorar
    const NAV_KEYWORDS = [
      'View Schedule', 'View Documents', 'View Printable', 'View Builder',
      'View Approvals', 'View Job', 'Lennar Options', "EPO's Created",
      'Additional Views', 'Job Repairs', 'CRM'
    ];

    function isNavText(text) {
      return NAV_KEYWORDS.some(kw => text.includes(kw));
    }

    // ---- 1. Order ID: buscar patrón XXXXXXXX-XXX en el texto de la página ----
    const bodyText = document.body.innerText || '';
    const orderIdMatch = bodyText.match(/(\d{7,10}-\d{3})/);
    const orderId = orderIdMatch ? orderIdMatch[1] : '';

    // ---- 2. Customer: buscar el encabezado centrado con el nombre de la empresa ----
    let customer = '';
    const allTds = Array.from(document.querySelectorAll('td'));
    for (const td of allTds) {
      const align = (td.getAttribute('align') || '').toLowerCase();
      const text = td.textContent.trim();
      if (align === 'center' && text.length > 5 && text.length < 120 &&
          !isNavText(text) &&
          /LLC|Inc|Corp|Homes|Services|Company|Cleaning/i.test(text)) {
        customer = text.split('\n')[0].trim();
        break;
      }
    }

    // ---- 3. Extracción label/valor usando etiquetas <b> dentro de <td> ----
    // Hyphen pone varios campos en el mismo <td> separados por <b>Label:</b><br>Valor<br>
    // → Hay que recoger solo los nodos entre el <b> del label y el siguiente <b>
    function getValue(labelText) {
      const bTags = Array.from(document.querySelectorAll('b, strong'));
      for (const b of bTags) {
        const bText = b.textContent.trim().replace(/:$/, '').trim();
        if (bText.toLowerCase() === labelText.toLowerCase() ||
            bText.toLowerCase().includes(labelText.toLowerCase())) {

          // Recorrer los nodos hermanos DESPUÉS del <b> hasta el siguiente <b>
          let result = '';
          let node = b.nextSibling;
          while (node) {
            if (node.nodeType === Node.ELEMENT_NODE &&
                (node.tagName === 'B' || node.tagName === 'STRONG')) break;

            if (node.nodeType === Node.TEXT_NODE) {
              result += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'BR') result += '\n';
              else result += node.textContent; // incluye <a>, <span>, etc.
            }
            node = node.nextSibling;
          }

          const value = result
            .split('\n')
            .map(l => l.trim())
            .find(l => l.length > 0 && !isNavText(l));

          if (value) return value;
        }
      }
      return '';
    }

    const task           = getValue('Task');
    const orderType      = getValue('Order Type');
    const status         = getValue('Order Status');
    const jobAddress     = getValue('Job Address');
    const planElevation  = getValue('Plan / Elevation') || getValue('Plan');
    const subdivision    = getValue('Subdivision');
    const lotBlock       = getValue('Lot / Block') || getValue('Lot');
    const permitNumber   = getValue('Permit Number');
    const supplierOrderNum = getValue("Supplier's Order Number") || getValue('Supplier Order Number');
    const requestedStartDate = getValue('Requested Start Date');
    const jobStartDate   = getValue('Job Start Date');

    // ---- 4. Tabla de líneas de producto ----
    // Columnas: Builder SKU | Description | Order | Received | UOM | Unit Price | Total
    const products = [];
    const detailTable = Array.from(document.querySelectorAll('table')).find(t =>
      t.textContent.includes('Builder SKU') ||
      (t.textContent.includes('Description') && t.textContent.includes('Unit Price'))
    );

    if (detailTable) {
      const rows = Array.from(detailTable.querySelectorAll('tr')).slice(1);
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length >= 4) {
          const sku         = cells[0]?.textContent.trim();
          const description = cells[1]?.textContent.trim();
          const orderQty    = cells[2]?.textContent.trim();
          // Columnas: SKU(0) | Description(1) | Order(2) | Received(3) | UOM(4) | Unit Price(5) | Total(6)
          const uom         = cells[4]?.textContent.trim();
          const unitPrice   = cells[5]?.textContent.trim();

          const skip = ['Description', 'Subtotal', 'Tax', 'Total', ''];
          if (description && !skip.some(s => description.includes(s))) {
            products.push({
              name:  description,
              sku:   sku || '',
              qty:   parseInt((orderQty || '1').replace(/[^0-9-]/g, '')) || 1,
              price: parseFloat((unitPrice || '0').replace(/[$,\s]/g, '')) || 0,
              uom:   uom || ''
            });
          }
        }
      }
    }

    // ---- 5. Total de la orden (puede ser negativo p.ej. Back Charge EPO) ----
    let total = 0;
    for (const el of allTds) {
      if (el.textContent.trim() === 'Total:') {
        const next = el.nextElementSibling;
        if (next) {
          // Eliminar paréntesis de negativos tipo ($1,251.00) → -1251
          const raw = next.textContent.trim()
            .replace(/\(([^)]+)\)/, '-$1')  // (1,251.00) → -1,251.00
            .replace(/[$,\s]/g, '');
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) { total = parsed; break; }
        }
      }
    }

    // ---- 6. Fecha ----
    const rawDate = requestedStartDate || jobStartDate;
    let dateObj = rawDate ? new Date(rawDate) : new Date();
    if (isNaN(dateObj.getTime())) dateObj = new Date();

    return {
      orderId,
      customer,
      task,
      orderType,
      status: status || 'Received',
      jobAddress,
      planElevation,
      subdivision,
      lotBlock,
      permitNumber,
      supplierOrderNum,
      products,
      total,
      date: dateObj.toISOString()
    };
  });

  // Si el orderId extraído no tiene el formato correcto, usar el del link
  if (!orderData.orderId || !/\d{5,}-\d{3}/.test(orderData.orderId)) {
    orderData.orderId = orderLink.orderId;
    console.log(`⚠️ Usando orderId del link: ${orderLink.orderId}`);
  }

  return {
    ...orderData,
    rawUrl: orderLink.href,
    scrapedAt: new Date().toISOString()
  };
}

/**
 * Upserta órdenes en MongoDB — nunca duplica, usa orderId como clave
 * @param {Array} orders
 * @returns {Promise<{inserted: number, updated: number, errors: number, total: number}>}
 */
async function upsertOrders(orders) {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const order of orders) {
    try {
      const result = await Order.findOneAndUpdate(
        { orderId: order.orderId },
        {
          $set: {
            customer: order.customer,
            task: order.task,
            orderType: order.orderType,
            products: order.products,
            total: order.total,
            date: new Date(order.date),
            status: order.status,
            jobAddress: order.jobAddress,
            planElevation: order.planElevation,
            subdivision: order.subdivision,
            lotBlock: order.lotBlock,
            permitNumber: order.permitNumber,
            supplierOrderNum: order.supplierOrderNum,
            rawUrl: order.rawUrl,
            scrapedAt: new Date(order.scrapedAt)
          },
          $setOnInsert: {
            taskStatus: 'unassigned',
            assignedTo: null,
            assignedDate: null
          }
        },
        { upsert: true, new: true, rawResult: true }
      );

      if (result.lastErrorObject?.updatedExisting) {
        updated++;
        console.log(`🔄 Actualizada orden #${order.orderId}`);
      } else {
        inserted++;
        console.log(`✅ Insertada orden #${order.orderId}`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error al guardar orden #${order.orderId}:`, error.message);
    }
  }

  return { inserted, updated, errors, total: orders.length };
}

/**
 * Función principal del scraper con reintentos y backoff exponencial
 * @returns {Promise<Object>}
 */
export async function runScraper() {
  let browser = null;
  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`🔍 Intento de scraping ${attempt + 1}/${MAX_RETRIES}...`);

      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
      });

      // Intentar reutilizar sesión previa con cookies guardadas
      const savedCookies = await loadCookies();
      if (savedCookies) {
        await context.addCookies(savedCookies);
        console.log('🍪 Cookies previas cargadas');
      }

      const page = await context.newPage();

      // Login
      await performLogin(page);

      // Guardar cookies post-login
      const cookies = await context.cookies();
      await saveCookies(cookies);

      // Recolectar todos los links de órdenes
      const orderLinks = await collectOrderLinks(page);

      if (orderLinks.length === 0) {
        console.log('⚠️ No se encontraron órdenes en la lista');
        await browser.close();
        return { success: true, inserted: 0, updated: 0, errors: 0, total: 0, timestamp: new Date().toISOString() };
      }

      // Extraer detalle de cada orden
      const orders = [];
      for (const link of orderLinks) {
        try {
          const detail = await extractOrderDetail(page, link);
          if (detail && detail.orderId) {
            orders.push(detail);
          }
        } catch (err) {
          console.error(`⚠️ Error extrayendo ${link.orderId}:`, err.message);
        }
      }

      console.log(`📦 ${orders.length} órdenes extraídas correctamente`);

      // Guardar en MongoDB
      const stats = await upsertOrders(orders);

      // Cerrar sesión en Hyphen para limpiar la sesión del servidor
      try {
        const logoutHref = await page.$eval(
          'a[href*="xt_logout"]',
          el => el.href
        ).catch(() => null);
        if (logoutHref) {
          await page.goto(logoutHref, { waitUntil: 'domcontentloaded', timeout: 10000 });
          console.log('🚪 Sesión cerrada en Supply Pro');
        }
      } catch {
        console.log('⚠️ No se pudo cerrar sesión (no crítico)');
      }
      // Eliminar cookies guardadas para forzar login limpio la próxima vez
      await fs.unlink(COOKIES_PATH).catch(() => {});

      await browser.close();

      console.log('✅ Scraping completado');
      console.log(`📊 Resultado: ${stats.inserted} nuevas, ${stats.updated} actualizadas, ${stats.errors} errores`);

      return {
        success: true,
        ...stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      lastError = error;
      console.error(`❌ Intento ${attempt + 1} fallido:`, error.message);

      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = getBackoffDelay(attempt);
        console.log(`⏳ Reintentando en ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(`Scraping fallido tras ${MAX_RETRIES} intentos: ${lastError?.message}`);
}

/**
 * Retorna la fecha del último scraping exitoso
 * @returns {Promise<Date|null>}
 */
export async function getLastScrapeTime() {
  const lastOrder = await Order.findOne().sort({ scrapedAt: -1 }).select('scrapedAt');
  return lastOrder?.scrapedAt || null;
}
