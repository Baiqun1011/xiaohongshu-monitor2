// 设置控制台编码为UTF-8（Windows系统）
if (process.platform === 'win32') {
    process.stdout.setEncoding('utf8');
}

const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const cron = require('node-cron');

const app = express();
const PORT = 3000;

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SALES_DATA_FILE = path.join(DATA_DIR, 'sales_data.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
    console.log('创建数据目录:', DATA_DIR);
}

// 数据存储
let products = [];
let salesData = [];
let nextId = 1;

// 加载数据
function loadData() {
    try {
        // 加载商品数据
        if (fs.existsSync(PRODUCTS_FILE)) {
            const productsJson = fs.readFileSync(PRODUCTS_FILE, 'utf8');
            products = JSON.parse(productsJson);
            console.log(`加载了 ${products.length} 个商品数据`);
        }

        // 加载销量数据
        if (fs.existsSync(SALES_DATA_FILE)) {
            const salesJson = fs.readFileSync(SALES_DATA_FILE, 'utf8');
            salesData = JSON.parse(salesJson);
            console.log(`加载了 ${salesData.length} 条销量数据`);
        }

        // 加载配置数据
        if (fs.existsSync(CONFIG_FILE)) {
            const configJson = fs.readFileSync(CONFIG_FILE, 'utf8');
            const config = JSON.parse(configJson);
            nextId = config.nextId || 1;
            console.log(`下一个ID: ${nextId}`);
        }

        // 如果有商品但nextId为1，重新计算nextId
        if (products.length > 0 && nextId === 1) {
            nextId = Math.max(...products.map(p => p.id)) + 1;
            console.log(`重新计算nextId: ${nextId}`);
        }

    } catch (error) {
        console.error('加载数据失败:', error);
        console.log('将使用空数据开始');
    }
}

// 保存数据
function saveData() {
    try {
        // 保存商品数据
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));

        // 保存销量数据
        fs.writeFileSync(SALES_DATA_FILE, JSON.stringify(salesData, null, 2));

        // 保存配置数据
        const config = { nextId };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

        console.log('数据保存成功');
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// 启动时加载数据
loadData();

// 使用浏览器解析短链接
async function resolveShortUrl(shortUrl) {
    console.log('开始解析短链接:', shortUrl);

    const browser = await puppeteer.launch({
        headless: 'new', // 使用新的无头模式
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled', // 隐藏自动化标识
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    });

    try {
        const page = await browser.newPage();

        // 设置更真实的浏览器环境
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 设置视口大小
        await page.setViewport({ width: 1366, height: 768 });

        // 设置额外的请求头
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        });

        // 隐藏webdriver属性
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        console.log('正在访问短链接...');

        // 尝试多种方式访问短链接
        let finalUrl = shortUrl;

        try {
            // 方法1: 等待网络空闲
            console.log('尝试方法1: 等待网络空闲...');
            await page.goto(shortUrl, {
                waitUntil: 'networkidle2',
                timeout: 12000
            });
            finalUrl = page.url();
            console.log('方法1成功，获取到URL:', finalUrl);
        } catch (error) {
            console.log('方法1失败，尝试方法2...');
            try {
                // 方法2: 等待加载完成
                console.log('尝试方法2: 等待加载完成...');
                await page.goto(shortUrl, {
                    waitUntil: 'load',
                    timeout: 10000
                });
                finalUrl = page.url();
                console.log('方法2成功，获取到URL:', finalUrl);
            } catch (error2) {
                console.log('方法2失败，尝试方法3...');
                try {
                    // 方法3: 不等待，直接获取重定向
                    console.log('尝试方法3: 快速访问...');
                    await page.goto(shortUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 8000
                    });
                    // 等待一下让重定向完成
                    await page.waitForTimeout(3000);
                    finalUrl = page.url();
                    console.log('方法3成功，获取到URL:', finalUrl);
                } catch (error3) {
                    console.log('方法3失败，尝试方法4...');
                    try {
                        // 方法4: 最简单的访问方式
                        console.log('尝试方法4: 最简单访问...');
                        await page.goto(shortUrl, { timeout: 6000 });
                        await page.waitForTimeout(2000);
                        finalUrl = page.url();
                        console.log('方法4成功，获取到URL:', finalUrl);
                    } catch (error4) {
                        console.log('所有方法都失败，使用原链接');
                        finalUrl = shortUrl;
                    }
                }
            }
        }

        if (finalUrl !== shortUrl) {
            console.log('短链接解析成功:', shortUrl, '->', finalUrl);
        } else {
            console.log('短链接解析失败，使用原链接');
        }

        return finalUrl;

    } catch (error) {
        console.error('短链接解析过程出错:', error);
        // 解析失败时返回原URL
        return shortUrl;
    } finally {
        await browser.close();
    }
}

// 提取和处理小红书链接
async function processXhsUrl(inputText) {
    console.log('处理输入文本:', inputText);

    // 支持的链接格式
    const urlPatterns = [
        // 完整的小红书商品链接
        /https?:\/\/www\.xiaohongshu\.com\/goods-detail\/[^\s]+/g,
        // 小红书短链接
        /https?:\/\/xhslink\.com\/[^\s]+/g,
    ];

    let extractedUrl = null;

    // 尝试提取链接
    for (const pattern of urlPatterns) {
        const matches = inputText.match(pattern);
        if (matches && matches.length > 0) {
            extractedUrl = matches[0].trim();
            break;
        }
    }

    if (!extractedUrl) {
        throw new Error('未找到有效的小红书链接');
    }

    // 如果是短链接，尝试转换为长链接
    if (extractedUrl.includes('xhslink.com')) {
        console.log('检测到短链接，正在转换...');
        extractedUrl = await resolveShortUrl(extractedUrl);
    }

    // 验证最终链接是否为小红书商品链接
    if (!extractedUrl.includes('xiaohongshu.com/goods-detail/')) {
        if (extractedUrl.includes('xhslink.com')) {
            throw new Error('短链接解析失败，请手动转换：\n1. 在浏览器中打开短链接\n2. 复制重定向后的长链接\n3. 使用长链接添加商品\n\n或者检查网络连接后重试');
        } else {
            throw new Error('链接不是小红书商品页面');
        }
    }

    console.log('最终处理的链接:', extractedUrl);
    return extractedUrl;
}

// 解析销量数字（处理万+格式）
function parseSalesNumber(salesText) {
    if (!salesText) return 0;

    const text = salesText.toString().toLowerCase();

    if (text.includes('万')) {
        const number = parseFloat(text.replace('万', '').replace('+', ''));
        return Math.floor(number * 10000);
    }

    return parseInt(text.replace(/[^\d]/g, '')) || 0;
}

// 爬取商品数据
async function scrapeProductData(url) {
    console.log('开始爬取商品数据:', url);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        // 尝试使用系统安装的Chrome
        executablePath: process.env.CHROME_PATH || undefined
    });

    try {
        const page = await browser.newPage();

        // 设置用户代理
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        console.log('正在访问页面...');
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            console.log('页面加载完成');
        } catch (error) {
            console.log('页面加载超时，尝试继续...');
        }

        // 等待页面加载
        console.log('等待页面渲染...');
        await page.waitForTimeout(5000);

        console.log('正在提取数据...');

        // 先截图保存，方便调试
        await page.screenshot({ path: 'debug_screenshot.png', fullPage: true });
        console.log('页面截图已保存为 debug_screenshot.png');

        const data = await page.evaluate(() => {
            // 获取页面所有文本内容用于调试
            const pageText = document.body.innerText;
            console.log('页面文本内容:', pageText.substring(0, 500));

            // 尝试多种选择器来获取商品信息
            const getTextBySelectors = (selectors, description) => {
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        for (const element of elements) {
                            const text = element.textContent.trim();
                            if (text) {
                                console.log(`${description} - 找到 ${selector}: ${text}`);
                                return text;
                            }
                        }
                    }
                }
                console.log(`${description} - 未找到匹配的元素`);
                return '';
            };

            // 商品名称 - 扩展更多选择器
            const name = getTextBySelectors([
                'h1',
                '[class*="title"]',
                '[class*="Title"]',
                '[class*="name"]',
                '[class*="Name"]',
                '.goods-title',
                '.product-title',
                '.item-title',
                '[data-testid*="title"]',
                '[data-testid*="name"]'
            ], '商品名称');

            // 商品价格 - 扩展更多选择器
            const priceText = getTextBySelectors([
                '[class*="price"]',
                '[class*="Price"]',
                '[class*="money"]',
                '[class*="Money"]',
                '[class*="yuan"]',
                '[class*="Yuan"]',
                '.current-price',
                '.sale-price',
                '.price-current',
                '[data-testid*="price"]'
            ], '商品价格');

            // 商品销量 - 扩展更多选择器
            const salesText = getTextBySelectors([
                '[class*="sales"]',
                '[class*="Sales"]',
                '[class*="sold"]',
                '[class*="Sold"]',
                '[class*="sell"]',
                '[class*="Sell"]',
                '[class*="buy"]',
                '[class*="Buy"]',
                '.sales-count',
                '.sold-count',
                '[data-testid*="sales"]',
                '[data-testid*="sold"]'
            ], '商品销量');

            // 店铺名称
            const shopName = getTextBySelectors([
                '[class*="shop"]',
                '[class*="Shop"]',
                '[class*="store"]',
                '[class*="Store"]',
                '[class*="brand"]',
                '[class*="Brand"]',
                '.shop-name',
                '.store-name',
                '[data-testid*="shop"]',
                '[data-testid*="store"]'
            ], '店铺名称');

            // 店铺销量
            const shopSalesText = getTextBySelectors([
                '[class*="shop"][class*="sales"]',
                '[class*="store"][class*="sales"]',
                '.shop-sales',
                '.store-sales'
            ], '店铺销量');

            // 智能从页面文本中提取信息
            let extractedName = '未知商品';
            let extractedPrice = 0;
            let extractedSales = '0';
            let extractedShopName = '未知店铺';
            let extractedShopSales = '0';

            // 从页面文本中直接查找商品名称
            console.log('页面文本前500字符:', pageText.substring(0, 500));

            // 改进的商品名称提取逻辑
            const namePatterns = [
                // 针对果壳铃商品的特殊格式：【云水】三果33颗果壳摇铃 么几果壳铃 · 草绳33颗
                /【[^】]+】[^\n]*(?:果壳|摇铃|风铃)[^\n]*·[^\n]*/,
                // 匹配已售数字后的商品名称（针对果壳铃的格式）
                /已售\d+[万千]?\n([^\n]{8,100}?)(?=\n(?:保障|跨店铺|已选|发货))/,
                // 匹配包含【】或·符号的商品名称
                /([^\n]*(?:【[^】]+】|·)[^\n]{8,}?)(?=\n(?:保障|已选|发货))/,
                // 匹配特定品牌的商品名称（包含云水、果壳等关键词）
                /((?:花栖|森野植愈|么几果壳铃|自明|小飞基|云水|果壳|摇铃)[^\n]{3,}?)(?=\n(?:保障|已选|发货))/,
                // 匹配包含商品特征词的名称
                /([^\n]*(?:果壳|摇铃|风铃|挂件|手铃|种子|白噪音|瑜伽|冥想|三果|颗)[^\n]{3,}?)(?=\n(?:保障|已选|发货))/,
                // 匹配长商品名称（在关键词前）
                /([^\n¥]{12,80}?)(?=\n(?:保障|已选|发货|跨店铺))/,
                // 匹配包含特殊符号的商品名称
                /([^\n]*[｜·][^\n]{6,}?)(?=\n(?:保障|已选|发货))/,
                // 匹配价格后面的商品名称
                /¥\s*\d+(?:\.\d+)?\n([^\n]{8,80}?)(?=\n(?:保障|已选|发货|跨店铺))/,
                // 新增：匹配包含数字+颗的商品名称（针对果壳铃）
                /([^\n]*\d+颗[^\n]{3,}?)(?=\n(?:保障|已选|发货))/,
                // 新增：匹配草绳相关的商品名称
                /([^\n]*(?:草绳|三果)[^\n]{3,}?)(?=\n(?:保障|已选|发货))/,
                // 新增：专门针对【云水】三果33颗果壳摇铃的模式
                /(【云水】[^\n]*(?:果壳|摇铃)[^\n]*)/,
                // 新增：匹配跨店铺优惠后的商品名称
                /跨店铺[^\n]*\n([^\n]{10,}?)(?=\n(?:保障|已选|发货))/
            ];

            // 如果上述模式都没有匹配到，尝试从页面文本中直接提取商品名称
            if (extractedName === '未知商品') {
                // 从你的日志中可以看到，商品名称通常出现在价格和保障之间
                // 尝试更宽松的匹配模式
                const fallbackPatterns = [
                    // 匹配价格后到保障前的内容，过滤掉跨店铺等信息
                    /¥\s*\d+(?:\.\d+)?[^\n]*\n([^\n]+?)(?=\n(?:保障|跨店铺))/,
                    // 匹配已售后到保障前的内容
                    /已售\d+[万千]?[^\n]*\n([^\n]+?)(?=\n保障)/,
                    // 匹配包含中文字符的较长文本行（可能是商品名称）
                    /([^\n]*[\u4e00-\u9fa5]{5,}[^\n]{10,}?)(?=\n(?:保障|已选|发货))/
                ];

                for (const pattern of fallbackPatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        let candidateName = match[1] || match[0];
                        candidateName = candidateName.trim();

                        // 更宽松的过滤条件
                        if (!candidateName.includes('卖家口碑') &&
                            !candidateName.includes('粉丝数') &&
                            !candidateName.includes('进店逛逛') &&
                            !candidateName.includes('已售') &&
                            !candidateName.includes('¥') &&
                            !candidateName.includes('跨店铺') &&
                            candidateName.length > 5 &&
                            candidateName.length < 200) {
                            extractedName = candidateName;
                            console.log('使用备用模式提取到商品名称:', extractedName);
                            break;
                        }
                    }
                }
            }

            for (const pattern of namePatterns) {
                const match = pageText.match(pattern);
                if (match) {
                    let candidateName = match[1] || match[0];
                    candidateName = candidateName.trim();

                    // 过滤掉明显不是商品名称的内容
                    if (!candidateName.includes('卖家口碑') &&
                        !candidateName.includes('粉丝数') &&
                        !candidateName.includes('进店逛逛') &&
                        !candidateName.includes('已售') &&
                        !candidateName.includes('¥') &&
                        candidateName.length > 8 &&
                        candidateName.length < 150) {
                        extractedName = candidateName;
                        console.log('从文本中提取到商品名称:', extractedName);
                        break;
                    }
                }
            }

            // 提取价格（寻找 ¥ 符号后的数字）
            const priceMatch = pageText.match(/¥\s*(\d+(?:\.\d+)?)/);
            if (priceMatch) {
                extractedPrice = parseFloat(priceMatch[1]);
                console.log('从文本中提取到价格:', extractedPrice);
            }

            // 提取商品销量（寻找"已售"后的数字）
            const salesMatch = pageText.match(/已售\s*(\d+(?:\.\d+)?[万千]?)/);
            if (salesMatch) {
                extractedSales = salesMatch[1];
                console.log('从文本中提取到商品销量:', extractedSales);
            }

            // 提取店铺名称（寻找店铺名称模式）
            const shopMatch = pageText.match(/([^¥\n]{3,20}?)(?:的店|店铺)/);
            if (shopMatch) {
                extractedShopName = shopMatch[1].trim();
                console.log('从文本中提取到店铺名称:', extractedShopName);
            }

            // 提取店铺销量（寻找店铺相关的已售数字）
            const shopSalesMatches = pageText.match(/已售\s*(\d+(?:\.\d+)?[万千]?)/g);
            if (shopSalesMatches && shopSalesMatches.length > 1) {
                // 如果有多个"已售"，第二个通常是店铺销量
                const shopSalesMatch = shopSalesMatches[1].match(/(\d+(?:\.\d+)?[万千]?)/);
                if (shopSalesMatch) {
                    extractedShopSales = shopSalesMatch[1];
                    console.log('从文本中提取到店铺销量:', extractedShopSales);
                }
            }

            // 使用提取到的信息，优先使用智能提取的结果
            const finalName = name || extractedName;
            const finalPrice = parseFloat(priceText.replace(/[^\d.]/g, '')) || extractedPrice || 0;
            const finalSales = salesText || extractedSales;
            const finalShopName = shopName || extractedShopName;
            const finalShopSales = shopSalesText || extractedShopSales;

            console.log('最终提取结果:', {
                name: finalName,
                price: finalPrice,
                sales: finalSales,
                shopName: finalShopName,
                shopSales: finalShopSales
            });

            return {
                name: finalName,
                price: finalPrice,
                salesText: finalSales,
                shopName: finalShopName,
                shopSalesText: finalShopSales,
                // 调试信息
                debug: {
                    originalPriceText: priceText,
                    originalSalesText: salesText,
                    pageTextSample: pageText.substring(0, 300),
                    extractedInfo: {
                        name: extractedName,
                        price: extractedPrice,
                        sales: extractedSales,
                        shopName: extractedShopName,
                        shopSales: extractedShopSales
                    }
                }
            };
        });

        console.log('提取到的原始数据:', data);

        const result = {
            name: data.debug.extractedInfo.name || data.name,
            price: data.debug.extractedInfo.price || data.price,
            productSales: parseSalesNumber(data.debug.extractedInfo.sales || data.salesText),
            shopName: data.debug.extractedInfo.shopName || data.shopName,
            shopSales: parseSalesNumber(data.debug.extractedInfo.shopSales || data.shopSalesText)
        };

        console.log('处理后的数据:', result);
        return result;

    } catch (error) {
        console.error('爬取数据失败:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// 添加商品
app.post('/api/products', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: '请提供商品链接或分享文本' });
    }

    try {
        console.log('收到添加商品请求:', url);

        // 处理和提取小红书链接
        const processedUrl = await processXhsUrl(url);

        // 检查是否已存在
        const existingProduct = products.find(p => p.url === processedUrl);
        if (existingProduct) {
            return res.status(400).json({ error: '该商品已存在' });
        }

        // 爬取商品数据
        const productData = await scrapeProductData(processedUrl);

        // 保存商品信息
        const product = {
            id: nextId++,
            url: processedUrl, // 保存处理后的长链接
            ...productData,
            created_at: new Date().toISOString()
        };

        products.push(product);

        // 保存销量数据
        const today = new Date().toISOString().split('T')[0];
        salesData.push({
            product_id: product.id,
            product_sales: productData.productSales,
            shop_sales: productData.shopSales,
            crawl_date: today,
            crawl_time: new Date().toISOString()
        });

        // 保存数据到文件
        saveData();

        console.log('商品添加成功:', product);
        res.json({
            message: '商品添加成功',
            product
        });

    } catch (error) {
        console.error('添加商品失败:', error);
        res.status(500).json({ error: '添加商品失败: ' + error.message });
    }
});

// 获取所有商品数据
app.get('/api/products', (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const result = products.map(product => {
            // 获取今天的数据
            const todayData = salesData.find(s =>
                s.product_id === product.id && s.crawl_date === today
            );

            // 获取昨天的数据
            const yesterdayData = salesData.find(s =>
                s.product_id === product.id && s.crawl_date === yesterday
            );

            const dailyProductSales = todayData && yesterdayData ?
                todayData.product_sales - yesterdayData.product_sales : 0;

            const dailyShopSales = todayData && yesterdayData ?
                todayData.shop_sales - yesterdayData.shop_sales : 0;

            return {
                ...product,
                // 商品总销量（当前销量）
                product_total_sales: todayData ? todayData.product_sales : (product.productSales || 0),
                // 店铺总销量
                shop_total_sales: todayData ? todayData.shop_sales : (product.shopSales || 0),
                // 商品日销量
                daily_product_sales: dailyProductSales,
                // 店铺日销量  
                daily_shop_sales: dailyShopSales,
                // 商品日GMV
                daily_gmv: dailyProductSales * product.price,
                // 最后更新时间
                last_update: todayData ? todayData.crawl_time : product.created_at,
                // 确保店铺名称正确显示
                shop_name: product.shopName || '未知店铺'
            };
        });

        res.json(result);
    } catch (error) {
        console.error('获取商品数据失败:', error);
        res.status(500).json({ error: '获取数据失败' });
    }
});

// 刷新单个商品数据
app.post('/api/products/:id/refresh', async (req, res) => {
    const productId = parseInt(req.params.id);

    const product = products.find(p => p.id === productId);
    if (!product) {
        return res.status(404).json({ error: '商品不存在' });
    }

    try {
        console.log('刷新商品数据:', product.url);
        const productData = await scrapeProductData(product.url);

        // 更新商品基本信息
        Object.assign(product, productData);

        // 添加新的销量数据
        const today = new Date().toISOString().split('T')[0];

        // 删除今天的旧数据（如果存在）
        salesData = salesData.filter(s =>
            !(s.product_id === productId && s.crawl_date === today)
        );

        // 添加新数据
        salesData.push({
            product_id: productId,
            product_sales: productData.productSales,
            shop_sales: productData.shopSales,
            crawl_date: today,
            crawl_time: new Date().toISOString()
        });

        // 保存数据到文件
        saveData();

        res.json({ message: '数据刷新成功', data: productData });

    } catch (error) {
        console.error('刷新数据失败:', error);
        res.status(500).json({ error: '刷新数据失败: ' + error.message });
    }
});

// 获取商品销量趋势数据
app.get('/api/products/:id/trend', (req, res) => {
    const productId = parseInt(req.params.id);

    try {
        // 查找商品
        const product = products.find(p => p.id === productId);
        if (!product) {
            return res.status(404).json({ error: '商品不存在' });
        }

        // 获取该商品的所有历史销量数据
        const productSalesData = salesData
            .filter(s => s.product_id === productId)
            .sort((a, b) => new Date(a.crawl_date) - new Date(b.crawl_date));

        if (productSalesData.length === 0) {
            return res.json({
                productName: product.name,
                totalSales: product.productSales || 0,
                avgDailySales: 0,
                maxDailySales: 0,
                monitorDays: 0,
                chartData: {
                    dates: [],
                    totalSales: [],
                    dailySales: []
                }
            });
        }

        // 准备图表数据
        const chartData = {
            dates: [],
            totalSales: [],
            dailySales: []
        };

        let previousSales = 0;
        let totalDailySales = 0;
        let maxDailySales = 0;

        productSalesData.forEach((data, index) => {
            const date = new Date(data.crawl_date);
            const dateStr = date.toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric'
            });

            chartData.dates.push(dateStr);
            chartData.totalSales.push(data.product_sales);

            // 计算日销量（除了第一天）
            let dailySales = 0;
            if (index > 0) {
                dailySales = Math.max(0, data.product_sales - previousSales);
                totalDailySales += dailySales;
                maxDailySales = Math.max(maxDailySales, dailySales);
            }
            chartData.dailySales.push(dailySales);

            previousSales = data.product_sales;
        });

        // 计算统计数据
        const monitorDays = productSalesData.length;
        const avgDailySales = monitorDays > 1 ? Math.round(totalDailySales / (monitorDays - 1)) : 0;
        const currentTotalSales = productSalesData[productSalesData.length - 1].product_sales;

        res.json({
            productName: product.name,
            totalSales: currentTotalSales,
            avgDailySales: avgDailySales,
            maxDailySales: maxDailySales,
            monitorDays: monitorDays,
            chartData: chartData
        });

    } catch (error) {
        console.error('获取趋势数据失败:', error);
        res.status(500).json({ error: '获取趋势数据失败' });
    }
});

// 删除商品
app.delete('/api/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);

    // 删除商品
    products = products.filter(p => p.id !== productId);

    // 删除相关销量数据
    salesData = salesData.filter(s => s.product_id !== productId);

    // 保存数据到文件
    saveData();

    res.json({ message: '商品删除成功' });
});

// 自动刷新所有商品数据的函数
async function autoRefreshAllProducts() {
    if (products.length === 0) {
        console.log('没有商品需要刷新');
        return;
    }

    console.log(`================================`);
    console.log(`开始自动刷新所有商品数据 (${new Date().toLocaleString()})`);
    console.log(`需要刷新的商品数量: ${products.length}`);
    console.log(`================================`);

    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
        try {
            console.log(`正在刷新商品: ${product.name} (ID: ${product.id})`);

            // 爬取最新数据
            const productData = await scrapeProductData(product.url);

            // 更新商品基本信息
            Object.assign(product, productData);

            // 添加新的销量数据
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentHour = now.getHours();

            // 检查今天是否已有数据
            const existingTodayData = salesData.find(s =>
                s.product_id === product.id && s.crawl_date === today
            );

            // 如果今天还没有数据，或者距离上次更新超过1小时，则添加新数据
            if (!existingTodayData ||
                (new Date() - new Date(existingTodayData.crawl_time)) > 60 * 60 * 1000) {

                salesData.push({
                    product_id: product.id,
                    product_sales: productData.productSales,
                    shop_sales: productData.shopSales,
                    crawl_date: today,
                    crawl_time: now.toISOString()
                });

                console.log(`✅ 商品 ${product.name} 数据更新成功 - 销量: ${productData.productSales}`);
                successCount++;
            } else {
                console.log(`⏭️ 商品 ${product.name} 今天已更新过，跳过`);
            }

            // 避免请求过于频繁，每个商品之间间隔2秒
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`❌ 商品 ${product.name} 刷新失败:`, error.message);
            failCount++;
        }
    }

    // 保存数据
    saveData();

    console.log(`================================`);
    console.log(`自动刷新完成 (${new Date().toLocaleString()})`);
    console.log(`成功: ${successCount} 个, 失败: ${failCount} 个`);
    console.log(`下次自动刷新时间: ${new Date(Date.now() + 60 * 60 * 1000).toLocaleString()}`);
    console.log(`================================`);
}

// 设置定时任务：每小时自动刷新所有商品数据
cron.schedule('0 * * * *', async () => {
    console.log('⏰ 定时任务触发：开始自动刷新商品数据...');
    await autoRefreshAllProducts();
}, {
    timezone: "Asia/Shanghai"
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        products: products.length,
        uptime: process.uptime()
    });
});

// 启动服务器
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`================================`);
    console.log(`小红书监控系统已启动`);
    console.log(`访问地址: http://localhost:${PORT}`);
    console.log(`================================`);
    console.log(`当前商品数量: ${products.length}`);
    console.log(`历史数据记录: ${salesData.length} 条`);
    console.log('数据存储: JSON文件持久化');
    console.log('数据目录:', DATA_DIR);
    console.log(`================================`);
    console.log('⏰ 自动刷新功能已启用');
    console.log('📅 刷新频率: 每小时一次');
    console.log('🕐 下次刷新时间: 每小时的0分');
    console.log(`================================`);

    // 启动后5分钟执行一次初始刷新（可选）
    setTimeout(async () => {
        console.log('🚀 执行启动后的初始数据刷新...');
        await autoRefreshAllProducts();
    }, 5 * 60 * 1000); // 5分钟后执行
});