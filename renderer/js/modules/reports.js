const Reports = {
    async render() {
        const container = document.getElementById('page-content');
        container.innerHTML = `
            <div class="toolbar"><h2>Financial Reports</h2></div>
            <div class="card"><div class="card-body">
                <div class="form-group"><label>From</label><input type="date" id="reportFrom" class="form-control" /></div>
                <div class="form-group"><label>To</label><input type="date" id="reportTo" class="form-control" /></div>
                <button class="btn btn-primary" onclick="Reports.generate()">Generate</button>
                <div id="reportResult" style="margin-top:20px;"></div>
            </div></div>`;
    },
    async generate() {
        const from = document.getElementById('reportFrom').value;
        const to = document.getElementById('reportTo').value;
        const params = new URLSearchParams();
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        const res = await DB._fetch(`/api/reports/sales-summary?${params.toString()}`);
        document.getElementById('reportResult').innerHTML = `
            <h3>Sales Summary</h3>
            <p>Total Sales: ${res.total_sales}</p>
            <p>Total Amount: KES ${Utils.formatCurrency(res.total_amount)}</p>`;
    }
};