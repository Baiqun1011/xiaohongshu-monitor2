let productsData = [];

// 页面加载时获取数据
document.addEventListener('DOMContentLoaded', function() {
    loadProducts();
});

// 显示加载状态
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

// 隐藏加载状态
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// 显示消息
function showMessage(text, type = 'info') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 3000);
}

// 格式化数字
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
}

// 格式化价格
function formatPrice(price) {
    if (price === null || price === undefined) return '¥0';
    return `¥${price.toFixed(2)}`;
}

// 格式化时间
function formatTime(timeString) {
    if (!timeString) return '暂无数据';
    const date = new Date(timeString);
    return date.toLocaleString('zh-CN');
}

// 提取小红书链接
function extractXhsUrl(text) {
    // 支持的链接格式：
    // 1. 完整链接：https://www.xiaohongshu.com/goods-detail/...
    // 2. 短链接：http://xhslink.com/...
    // 3. 分享文本中的链接
    
    const urlPatterns = [
        // 完整的小红书商品链接
        /https?:\/\/www\.xiaohongshu\.com\/goods-detail\/[^\s]+/g,
        // 小红书短链接
        /https?:\/\/xhslink\.com\/[^\s]+/g,
    ];
    
    for (const pattern of urlPatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            return matches[0].trim();
        }
    }
    
    return null;
}

// 切换标签页
function switchTab(tabName) {
    // 更新标签按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    
    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
}

// 添加单个商品
async function addProduct() {
    const urlInput = document.getElementById('productUrl');
    const inputText = urlInput.value.trim();
    
    if (!inputText) {
        showMessage('请输入商品链接', 'error');
        return;
    }
    
    // 提取小红书链接
    const url = extractXhsUrl(inputText);
    if (!url) {
        showMessage('请输入有效的小红书商品链接或分享文本', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('商品添加成功', 'success');
            urlInput.value = '';
            loadProducts();
        } else {
            showMessage(result.error || '添加失败', 'error');
        }
    } catch (error) {
        console.error('添加商品失败:', error);
        showMessage('网络错误，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}

// 批量添加商品
async function addBatchProducts() {
    const batchInput = document.getElementById('batchUrls');
    const urls = batchInput.value.trim().split('\n').filter(url => url.trim());
    
    if (urls.length === 0) {
        showMessage('请输入商品链接', 'error');
        return;
    }
    
    // 提取和验证所有链接
    const extractedUrls = [];
    const invalidUrls = [];
    
    for (const line of urls) {
        const extractedUrl = extractXhsUrl(line);
        if (extractedUrl) {
            extractedUrls.push(extractedUrl);
        } else {
            invalidUrls.push(line);
        }
    }
    
    if (invalidUrls.length > 0) {
        showMessage(`发现 ${invalidUrls.length} 个无效链接，请检查链接格式`, 'error');
        console.log('无效链接:', invalidUrls);
        return;
    }
    
    showLoading();
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    try {
        // 逐个添加商品（避免并发过多）
        for (let i = 0; i < extractedUrls.length; i++) {
            const url = extractedUrls[i];
            
            try {
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                    errors.push(`链接 ${i + 1}: ${result.error}`);
                }
            } catch (error) {
                failCount++;
                errors.push(`链接 ${i + 1}: 网络错误`);
            }
            
            // 添加延迟避免请求过于频繁
            if (i < extractedUrls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // 显示结果
        if (successCount > 0) {
            showMessage(`批量添加完成：成功 ${successCount} 个，失败 ${failCount} 个`, 
                       failCount === 0 ? 'success' : 'info');
            batchInput.value = '';
            loadProducts();
        } else {
            showMessage('所有商品添加失败', 'error');
        }
        
        // 如果有错误，在控制台显示详细信息
        if (errors.length > 0) {
            console.error('批量添加错误详情:', errors);
        }
        
    } catch (error) {
        console.error('批量添加失败:', error);
        showMessage('批量添加过程中发生错误', 'error');
    } finally {
        hideLoading();
    }
}

// 加载商品数据
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const data = await response.json();
        
        if (response.ok) {
            productsData = data;
            renderTable();
        } else {
            showMessage('加载数据失败', 'error');
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        showMessage('网络错误，请稍后重试', 'error');
    }
}

// 渲染表格
function renderTable() {
    const tbody = document.getElementById('productsTableBody');
    
    if (productsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: #6c757d;">
                    暂无数据，请添加商品链接开始监控
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = productsData.map(product => `
        <tr>
            <td>
                <div class="product-name" title="${product.name || '未知商品'}">
                    ${product.name || '未知商品'}
                </div>
            </td>
            <td class="price">${formatPrice(product.price)}</td>
            <td class="sales-number">${formatNumber(product.product_total_sales || product.productSales || 0)}</td>
            <td class="sales-number">${formatNumber(product.daily_product_sales || 0)}</td>
            <td class="gmv">${formatPrice(product.daily_gmv || 0)}</td>
            <td>
                <div class="shop-name" title="${product.shop_name || product.shopName || '未知店铺'}">
                    ${product.shop_name || product.shopName || '未知店铺'}
                </div>
            </td>
            <td class="sales-number">${formatNumber(product.shop_total_sales || product.shopSales || 0)}</td>
            <td class="sales-number">${formatNumber(product.daily_shop_sales || 0)}</td>
            <td class="update-time">${formatTime(product.last_update)}</td>
            <td>
                <button onclick="showTrendChart(${product.id})" class="btn btn-info btn-small">趋势</button>
                <button onclick="refreshProduct(${product.id})" class="btn btn-success btn-small">刷新</button>
                <button onclick="downloadData(${product.id})" class="btn btn-info btn-small">下载</button>
                <button onclick="deleteProduct(${product.id})" class="btn btn-danger btn-small">删除</button>
            </td>
        </tr>
    `).join('');
}

// 排序表格
function sortTable() {
    const sortBy = document.getElementById('sortBy').value;
    const sortOrder = document.getElementById('sortOrder').value;
    
    productsData.sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];
        
        // 处理特殊字段映射
        if (sortBy === 'product_total_sales') {
            aVal = a.product_total_sales || a.productSales || 0;
            bVal = b.product_total_sales || b.productSales || 0;
        } else if (sortBy === 'shop_total_sales') {
            aVal = a.shop_total_sales || a.shopSales || 0;
            bVal = b.shop_total_sales || b.shopSales || 0;
        }
        
        // 处理null/undefined值
        if (aVal === null || aVal === undefined) aVal = 0;
        if (bVal === null || bVal === undefined) bVal = 0;
        
        // 数字比较
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // 字符串比较
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        
        if (sortOrder === 'asc') {
            return aStr.localeCompare(bStr);
        } else {
            return bStr.localeCompare(aStr);
        }
    });
    
    renderTable();
}

// 刷新单个商品数据
async function refreshProduct(productId) {
    showLoading();
    
    try {
        const response = await fetch(`/api/products/${productId}/refresh`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('数据刷新成功', 'success');
            loadProducts();
        } else {
            showMessage(result.error || '刷新失败', 'error');
        }
    } catch (error) {
        console.error('刷新数据失败:', error);
        showMessage('网络错误，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}

// 刷新所有数据
async function refreshAllData() {
    if (productsData.length === 0) {
        showMessage('暂无商品数据', 'info');
        return;
    }
    
    showLoading();
    
    try {
        const promises = productsData.map(product => 
            fetch(`/api/products/${product.id}/refresh`, { method: 'POST' })
        );
        
        await Promise.all(promises);
        showMessage('所有数据刷新完成', 'success');
        loadProducts();
    } catch (error) {
        console.error('批量刷新失败:', error);
        showMessage('部分数据刷新失败', 'error');
        loadProducts();
    } finally {
        hideLoading();
    }
}

// 下载数据
async function downloadData(productId) {
    try {
        const response = await fetch(`/api/products/${productId}/download`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `商品销量数据_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showMessage('数据下载成功', 'success');
        } else {
            const result = await response.json();
            showMessage(result.error || '下载失败', 'error');
        }
    } catch (error) {
        console.error('下载失败:', error);
        showMessage('下载失败，请稍后重试', 'error');
    }
}

// 删除商品
async function deleteProduct(productId) {
    if (!confirm('确定要删除这个商品吗？删除后将无法恢复历史数据。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('商品删除成功', 'success');
            loadProducts();
        } else {
            showMessage(result.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除失败:', error);
        showMessage('网络错误，请稍后重试', 'error');
    }
}

// 回车键添加商品
document.getElementById('productUrl').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addProduct();
    }
});

// 标签页切换功能
function switchTab(tabName) {
    // 移除所有活动状态
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 激活选中的标签页
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}



// 清空批量输入
function clearBatchInput() {
    document.getElementById('batchUrls').value = '';
    document.getElementById('batchProgress').style.display = 'none';
}

// 显示销量趋势图
async function showTrendChart(productId) {
    try {
        showLoading();
        
        // 获取商品历史数据
        const response = await fetch(`/api/products/${productId}/trend`);
        const data = await response.json();
        
        if (!response.ok) {
            showMessage(data.error || '获取趋势数据失败', 'error');
            return;
        }
        
        // 显示模态框
        document.getElementById('trendModal').style.display = 'flex';
        document.getElementById('trendTitle').textContent = `${data.productName} - 销量趋势`;
        
        // 更新统计信息
        document.getElementById('totalSales').textContent = formatNumber(data.totalSales);
        document.getElementById('avgDailySales').textContent = formatNumber(data.avgDailySales);
        document.getElementById('maxDailySales').textContent = formatNumber(data.maxDailySales);
        document.getElementById('monitorDays').textContent = data.monitorDays + ' 天';
        
        // 创建图表
        createTrendChart(data.chartData);
        
    } catch (error) {
        console.error('获取趋势数据失败:', error);
        showMessage('网络错误，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}

// 创建趋势图表
let trendChartInstance = null;

function createTrendChart(chartData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    // 销毁之前的图表实例
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }
    
    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.dates,
            datasets: [{
                label: '商品总销量',
                data: chartData.totalSales,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8
            }, {
                label: '日新增销量',
                data: chartData.dailySales,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: '#28a745',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '销量趋势分析',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNumber(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '日期'
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '销量'
                    },
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// 关闭趋势图模态框
function closeTrendModal() {
    document.getElementById('trendModal').style.display = 'none';
    
    // 销毁图表实例释放内存
    if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
    }
}

// 点击模态框外部关闭
document.getElementById('trendModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeTrendModal();
    }
});

// ESC键关闭模态框
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeTrendModal();
    }
});