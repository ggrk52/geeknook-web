/**
 * GeekNook to Tilda Catalog CSV Exporter
 * Reads products-data.js and outputs tilda-catalog-import.csv formatted for Tilda Store.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const productsDataPath = path.resolve(__dirname, '../js/products-data.js');
const rawCode = fs.readFileSync(productsDataPath, 'utf8') + '\n;globalThis.GEEKNOOK_DATA = GEEKNOOK_DATA;';

// Execute products-data.js in a safe sandbox context
const sandbox = { window: { location: { hostname: 'localhost', href: 'http://localhost' } }, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(rawCode, sandbox);

const data = sandbox.GEEKNOOK_DATA;
if (!data) {
  console.error('Failed to load GEEKNOOK_DATA from products-data.js');
  process.exit(1);
}

// CSV escaping helper
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Map categories to friendly Russian Tilda catalog categories
const categoryMap = {
  boards: 'Подставки Focus Station',
  accessories: 'Модульные аксессуары T-Track',
  mats: 'Премиальные коврики Desk Mat',
  bundles: 'Инженерные комплекты'
};

const rows = [];
// Headers according to Tilda Catalog specifications
const headers = [
  'Brand',
  'SKU',
  'Category',
  'Title',
  'Description',
  'Text',
  'Photo',
  'Price',
  'Price Old',
  'Quantity',
  'Characteristics:Материал',
  'Characteristics:Крепление',
  'Characteristics:Предельная нагрузка',
  'Characteristics:Габариты',
  'Modifications'
];
rows.push(headers.map(escapeCsv).join(';'));

// Convert local exported Tilda filename to live HTTPS URL on static.tildacdn.com
function convertToTildaCdnUrl(localPath) {
  if (!localPath) return '';
  if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
    return localPath;
  }
  const filename = localPath.replace(/^images[/\\]/, '').replace(/^[/\\]/, '');
  if (filename.startsWith('tild') && filename.includes('__')) {
    const parts = filename.split('__');
    const folder = parts[0];
    let file = parts.slice(1).join('__');
    if (file.toLowerCase().startsWith('dsc_')) {
      file = 'DSC_' + file.slice(4);
    }
    return `https://static.tildacdn.com/${folder}/${file}`;
  }
  return localPath;
}

function formatPhotos(raw) {
  if (!raw) return '';
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(convertToTildaCdnUrl).join(' ');
}

function processProductList(list, catKey, defaultSkuPrefix) {
  if (!Array.isArray(list)) return;
  list.forEach((item, idx) => {
    const sku = `GN-${defaultSkuPrefix}-${String(idx + 1).padStart(3, '0')}`;
    const category = categoryMap[catKey] || catKey;
    const title = item.title || '';
    const descr = item.shortDescr || item.subtitle || '';
    const fullText = item.fullDescr || item.shortDescr || '';
    const photo = formatPhotos(item.images || item.image);
    const price = item.price || 0;
    const priceOld = item.oldPrice || '';
    const quantity = 99;

    const specs = item.specs || {};
    const matChar = item.materials || specs['Материал полки'] || specs['Материал'] || '';
    const mountChar = specs['Система крепления'] || specs['Крепление'] || '';
    const loadChar = specs['Предельная нагрузка'] || '';
    const sizeChar = specs['Габариты'] || specs['Размеры'] || specs['Длина основания'] || '';

    // Format modifications / options
    let modifStr = '';
    if (item.options) {
      if (item.options.lengths) {
        modifStr = `Длина: ${item.options.lengths.join('; ')}`;
      } else if (item.options.finishes) {
        modifStr = `Отделка: ${item.options.finishes.join('; ')}`;
      } else if (item.options.sizes) {
        modifStr = `Размер: ${item.options.sizes.join('; ')}`;
      }
    }

    const row = [
      'GEEK NOOK', // Brand
      sku,
      category,
      title,
      descr,
      fullText,
      photo,
      price,
      priceOld,
      quantity,
      matChar,
      mountChar,
      loadChar,
      sizeChar,
      modifStr
    ];
    rows.push(row.map(escapeCsv).join(';'));
  });
}

// 1. Boards
processProductList(data.boards, 'boards', 'FS');
// 2. Accessories
processProductList(data.accessories, 'accessories', 'ACC');
// 3. Mats
processProductList(data.mats, 'mats', 'MAT');
// 4. Bundles
if (Array.isArray(data.bundles)) {
  data.bundles.forEach((bundle, idx) => {
    const sku = `GN-BDL-${String(idx + 1).padStart(3, '0')}`;
    const category = categoryMap.bundles;
    const title = bundle.title || '';
    const descr = bundle.subtitle || '';
    const fullText = `Состав комплекта:\n${(bundle.items || []).map(i => '• ' + i).join('\n')}\n\n${bundle.badge || ''}`;
    const photo = formatPhotos(bundle.image);
    const price = bundle.price || 0;
    const priceOld = bundle.oldPrice || '';
    const quantity = 50;

    const row = [
      'GEEK NOOK',
      sku,
      category,
      title,
      descr,
      fullText,
      photo,
      price,
      priceOld,
      quantity,
      'Сталь, массив дерева, войлок',
      'T-Track модульная система',
      'до 60 кг',
      bundle.badge || '',
      ''
    ];
    rows.push(row.map(escapeCsv).join(';'));
  });
}

// Write CSV with UTF-8 BOM so Russian characters display properly in Excel and Tilda
const csvContent = '\uFEFF' + rows.join('\r\n');
const outputPath = path.resolve(__dirname, 'tilda-catalog-import.csv');
fs.writeFileSync(outputPath, csvContent, 'utf8');

console.log(`Successfully generated Tilda Catalog CSV: ${outputPath}`);
console.log(`Total exported products: ${rows.length - 1}`);
