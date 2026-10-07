'use strict';
'require view';
'require rpc';
'require network';
'require fs';
'require ui';

const callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board',
	expect: { '': {} }
});

const callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info',
	expect: { '': {} }
});

const callRcList = rpc.declare({
	object: 'rc',
	method: 'list',
	expect: { '': {} }
});

const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ]
});

function pct(value) {
	value = Math.max(0, Math.min(100, Number(value) || 0));
	return Math.round(value);
}

function bytes(value) {
	value = Number(value) || 0;
	if (value >= 1024 * 1024 * 1024)
		return (value / (1024 * 1024 * 1024)).toFixed(1) + ' GiB';
	if (value >= 1024 * 1024)
		return (value / (1024 * 1024)).toFixed(1) + ' MiB';
	if (value >= 1024)
		return (value / 1024).toFixed(1) + ' KiB';
	return value + ' B';
}

function maskIp(ip) {
	if (!ip)
		return '-';
	if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
		const p = ip.split('.');
		return p[0] + '.' + p[1] + '.*.*';
	}
	return ip;
}

function tempValue(raw) {
	const n = parseInt(raw, 10);
	if (!isFinite(n))
		return null;
	return n > 1000 ? (n / 1000).toFixed(1) : n.toFixed(1);
}

function serviceLabel(name) {
	if (name === 'adguardhome') return 'AdGuard Home';
	if (name === 'forkop') return 'Forkop';
	if (name === 'sing-box') return 'sing-box';
	return name;
}

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			L.resolveDefault(network.getWANNetworks(), []),
			L.resolveDefault(network.getWifiNetworks(), []),
			L.resolveDefault(network.getHostHints(), null),
			L.resolveDefault(fs.read('/sys/class/thermal/thermal_zone0/temp'), ''),
			L.resolveDefault(fs.read('/proc/cpuinfo'), ''),
			L.resolveDefault(callRcList(), {})
		]).then(async data => {
			const wifi = data[3] || [];
			const assoc = await Promise.all(wifi.map(net =>
				L.resolveDefault(net.getAssocList(), []).then(list => ({ net, list }))
			));

			const services = {};
			const initList = data[7] || {};
			for (const name of [ 'adguardhome', 'forkop', 'sing-box' ]) {
				if (initList[name] != null) {
					const status = await L.resolveDefault(callRcInit(name, 'status'), 1);
					services[name] = { exists: true, running: status === 0 || status === false };
				}
			}

			return { board: data[0], info: data[1], wan: data[2], wifi: assoc, hints: data[4], temp: data[5], cpuinfo: data[6], services };
		});
	},

	handleService(name, action) {
		if (!window.confirm(_('Apply "%s" to %s?').format(action, serviceLabel(name))))
			return;

		ui.showModal(_('Applying'), [
			E('p', {}, [ _('Running %s %s…').format(name, action) ])
		]);

		return callRcInit(name, action).then(ret => {
			ui.hideModal();
			if (ret)
				throw new Error(_('Command failed'));
			window.setTimeout(() => window.location.reload(), 700);
		}).catch(err => {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, [ _('Failed: %s').format(err.message || err) ]));
		});
	},

	card(title, value, meta, cls) {
		return E('section', { 'class': 'rd-card ' + (cls || '') }, [
			E('div', { 'class': 'rd-kicker' }, [ title ]),
			E('div', { 'class': 'rd-value' }, [ String(value) ]),
			E('div', { 'class': 'rd-meta' }, [ meta || '' ])
		]);
	},

	progressCard(title, value, percent, meta) {
		return E('section', { 'class': 'rd-card' }, [
			E('div', { 'class': 'rd-kicker' }, [ title ]),
			E('div', { 'class': 'rd-value' }, [ String(value) ]),
			E('div', { 'class': 'rd-progress' }, [
				E('i', { 'style': 'width:' + pct(percent) + '%' })
			]),
			E('div', { 'class': 'rd-meta' }, [ meta || '' ])
		]);
	},

	render(data) {
		const info = data.info || {};
		const board = data.board || {};
		const memory = info.memory || {};
		const available = memory.available != null
			? memory.available
			: (memory.free || 0) + (memory.buffered || 0) + (memory.cached || 0);
		const used = Math.max(0, (memory.total || 0) - available);
		const memPct = memory.total ? used * 100 / memory.total : 0;

		const cores = Math.max(1, (data.cpuinfo.match(/^processor\s*:/gm) || []).length || 1);
		const load1 = Array.isArray(info.load) ? (Number(info.load[0]) / 65536) : 0;
		const cpuLoad = Math.min(100, (load1 / cores) * 100);

		let wan = null;
		for (const candidate of data.wan || []) {
			if (!wan || candidate.getMetric() < wan.getMetric())
				wan = candidate;
		}
		const online = !!(wan && wan.isUp());
		const wanIp = online ? ((wan.getIPAddrs() || [])[0] || '-').split('/')[0] : '-';
		const wanProto = online ? (wan.getI18n() || wan.getProtocol() || '-') : _('Disconnected');
		const uptime = info.uptime ? '%t'.format(info.uptime) : '-';
		const temperature = tempValue(data.temp);

		let clientCount = 0;
		const wifiNodes = [];
		for (const item of data.wifi || []) {
			const net = item.net;
			const list = item.list || [];
			clientCount += list.length;
			wifiNodes.push(E('div', { 'class': 'rd-pill' }, [
				E('b', {}, [ net.getActiveSSID() || _('Unnamed Wi-Fi') ]),
				E('span', {}, [
					(net.isDisabled() ? _('Disabled') : _('Active')) + ' · ' +
					list.length + ' ' + _('clients') +
					(net.getChannel() ? ' · ch ' + net.getChannel() : '')
				])
			]));
		}

		const serviceRows = [];
		const services = data.services || {};
		for (const name of [ 'adguardhome', 'forkop', 'sing-box' ]) {
			if (!services[name])
				continue;
			const running = services[name].running;
			serviceRows.push(E('div', { 'class': 'rd-row' }, [
				E('div', {}, [
					E('div', { 'class': 'rd-service-name' }, [
						E('span', { 'class': 'rd-dot ' + (running ? 'good' : 'bad') }),
						serviceLabel(name)
					]),
					E('div', { 'class': 'rd-service-state' }, [ running ? _('Running') : _('Stopped') ])
				]),
				E('div', { 'class': 'rd-actions' }, [
					(name === 'sing-box' && services.forkop)
						? E('span', { 'class': 'rd-service-state' }, [ _('Managed by Forkop') ])
						: E('button', {
							'class': 'rd-btn',
							'click': ui.createHandlerFn(this, 'handleService', name, running ? 'restart' : 'start')
						}, [ running ? _('Restart') : _('Start') ])
				])
			]));
		}
		if (!serviceRows.length)
			serviceRows.push(E('div', { 'class': 'rd-meta' }, [ _('AdGuard Home, Forkop and sing-box were not detected.') ]));

		return E('div', { 'class': 'rd-shell' }, [
			E('link', {
				'rel': 'stylesheet',
				'href': L.resource('router-dashboard/dashboard.css')
			}),
			E('header', { 'class': 'rd-head' }, [
				E('div', {}, [
					E('div', { 'class': 'rd-title' }, [ 'OpenWrt Dashboard' ]),
					E('div', { 'class': 'rd-sub' }, [
						(board.model || _('Router')) + ' · ' + (board.release?.description || board.kernel || '')
					])
				]),
				E('div', { 'class': 'rd-sub' }, [ _('Uptime') + ': ' + uptime ])
			]),
			E('main', { 'class': 'rd-grid' }, [
				this.card(
					_('Internet'),
					online ? _('Online') : _('Offline'),
					online ? (wanProto + ' · ' + maskIp(wanIp)) : _('WAN is not connected')
				),
				this.progressCard(
					_('CPU load'),
					pct(cpuLoad) + '%',
					cpuLoad,
					cores + ' ' + _('cores') + ' · load ' + load1.toFixed(2)
				),
				this.progressCard(
					_('Memory'),
					pct(memPct) + '%',
					memPct,
					bytes(used) + ' / ' + bytes(memory.total || 0)
				),
				this.card(
					_('Temperature'),
					temperature != null ? temperature + ' °C' : '-',
					temperature != null ? _('SoC thermal sensor') : _('Sensor unavailable')
				),
				E('section', { 'class': 'rd-card wide' }, [
					E('div', { 'class': 'rd-kicker' }, [ _('Wi-Fi') ]),
					E('div', { 'class': 'rd-value' }, [ clientCount + ' ' + _('clients') ]),
					E('div', { 'class': 'rd-wifi' }, wifiNodes.length ? wifiNodes : [
						E('div', { 'class': 'rd-meta' }, [ _('No Wi-Fi interfaces detected.') ])
					])
				]),
				E('section', { 'class': 'rd-card wide' }, [
					E('div', { 'class': 'rd-kicker' }, [ _('Services') ]),
					E('div', { 'style': 'margin-top:6px' }, serviceRows)
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
