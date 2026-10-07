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

const callDHCPLeases = rpc.declare({
	object: 'luci-rpc',
	method: 'getDHCPLeases',
	expect: { '': {} }
});

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
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

async function getForkopNativeStatus() {
	try {
		const res = await fs.exec('/usr/bin/forkop', [ 'get_status' ]);
		if (res && res.code === 0 && res.stdout) {
			const data = JSON.parse(res.stdout);
			return {
				running: Number(data.running) === 1,
				enabled: Number(data.enabled) === 1
			};
		}
	} catch (e) {}

	return null;
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
			L.resolveDefault(callRcList(), {}),
			L.resolveDefault(callDHCPLeases(), {})
		]).then(async data => {
			const wifi = data[3] || [];
			const assoc = await Promise.all(wifi.map(net =>
				L.resolveDefault(net.getAssocList(), []).then(list => ({ net, list }))
			));

			const services = {};
			const initList = data[7] || {};
			const aliases = {
				adguardhome: [ 'adguardhome', 'AdGuardHome' ],
				forkop: [ 'forkop' ],
				'sing-box': [ 'sing-box', 'singbox' ]
			};

			for (const key in aliases) {
				const actual = aliases[key].find(name => initList[name] != null);
				if (!actual)
					continue;

				if (key === 'forkop') {
					const native = await getForkopNativeStatus();
					if (native) {
						services[key] = {
							exists: true,
							running: native.running,
							enabled: native.enabled,
							init: actual
						};
						continue;
					}
				}

				const state = await L.resolveDefault(callServiceList(actual), {});
				const entry = state && state[actual];
				const instances = (entry && entry.instances) || {};
				const running = Object.keys(instances).some(name =>
					instances[name] && instances[name].running === true
				);

				services[key] = { exists: true, running: running, init: actual };
			}

			return { board: data[0], info: data[1], wan: data[2], wifi: assoc, hints: data[4], temp: data[5], cpuinfo: data[6], leases: data[8], services };
		});
	},

	handleService(name, initName, action) {
		if (!window.confirm(_('Apply "%s" to %s?').format(action, serviceLabel(name))))
			return;

		ui.showModal(_('Выполнение'), [
			E('p', {}, [ _('Выполняется: %s — %s…').format(serviceLabel(name), action) ])
		]);

		return callRcInit(initName, action).then(ret => {
			ui.hideModal();
			if (ret)
				throw new Error(_('Команда завершилась ошибкой'));
			window.setTimeout(() => window.location.reload(), 700);
		}).catch(err => {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, [ _('Ошибка: %s').format(err.message || err) ]));
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
		const wanProto = online ? (wan.getI18n() || wan.getProtocol() || '-') : _('Нет соединения');
		const uptime = info.uptime ? '%t'.format(info.uptime) : '-';
		const temperature = tempValue(data.temp);

		let localWifiClients = 0;
		const wifiNodes = [];
		for (const item of data.wifi || []) {
			const net = item.net;
			const list = item.list || [];
			localWifiClients += list.length;
			wifiNodes.push(E('div', { 'class': 'rd-pill' }, [
				E('b', {}, [ net.getActiveSSID() || _('Wi-Fi без имени') ]),
				E('span', {}, [
					(net.isDisabled() ? _('Отключена') : _('Активна')) +
					(net.getChannel() ? ' · ch ' + net.getChannel() : '') +
					' · ' + list.length + ' ' + _('локальных клиентов')
				])
			]));
		}

		const leases = Array.isArray(data.leases && data.leases.dhcp_leases)
			? data.leases.dhcp_leases
			: [];
		const seen = {};
		const devices = [];
		for (const lease of leases) {
			const key = (lease.macaddr || lease.ipaddr || '').toLowerCase();
			if (!key || seen[key])
				continue;
			seen[key] = true;
			devices.push(lease);
		}

		devices.sort((a, b) =>
			String(a.hostname || a.ipaddr || '').localeCompare(String(b.hostname || b.ipaddr || ''))
		);

		const deviceNodes = devices.slice(0, 12).map(lease =>
			E('div', { 'class': 'rd-pill' }, [
				E('b', {}, [ lease.hostname || _('Неизвестное устройство') ]),
				E('span', {}, [
					(lease.ipaddr || '-') + (lease.macaddr ? ' · ' + lease.macaddr : '')
				])
			])
		);

		if (devices.length > 12)
			deviceNodes.push(E('div', { 'class': 'rd-pill' }, [
				E('b', {}, [ '+' + (devices.length - 12) ]),
				E('span', {}, [ _('ещё устройств') ])
			]));

		const serviceRows = [];
		const services = data.services || {};
		for (const name of [ 'adguardhome', 'forkop', 'sing-box' ]) {
			if (!services[name])
				continue;

			if (name === 'sing-box' && services.forkop) {
				serviceRows.push(E('div', { 'class': 'rd-row' }, [
					E('div', {}, [
						E('div', { 'class': 'rd-service-name' }, [
							E('span', { 'class': 'rd-dot warn' }),
							serviceLabel(name)
						]),
						E('div', { 'class': 'rd-service-state' }, [ _('Управляется Forkop') ])
					])
				]));
				continue;
			}

			const running = services[name].running;
			serviceRows.push(E('div', { 'class': 'rd-row' }, [
				E('div', {}, [
					E('div', { 'class': 'rd-service-name' }, [
						E('span', { 'class': 'rd-dot ' + (running ? 'good' : 'bad') }),
						serviceLabel(name)
					]),
					E('div', { 'class': 'rd-service-state' }, [ running ? _('Работает') : _('Остановлен') ])
				]),
				E('div', { 'class': 'rd-actions' }, [
					E('button', {
						'class': 'rd-btn',
						'click': ui.createHandlerFn(this, 'handleService', name, services[name].init, running ? 'restart' : 'start')
					}, [ running ? _('Перезапустить') : _('Запустить') ])
				])
			]));
		}
		if (!serviceRows.length)
			serviceRows.push(E('div', { 'class': 'rd-meta' }, [ _('AdGuard Home, Forkop и sing-box не обнаружены.') ]));

		return E('div', { 'class': 'rd-shell' }, [
			E('link', {
				'rel': 'stylesheet',
				'href': L.resource('router-dashboard/dashboard.css')
			}),
			E('div', { 'class': 'rd-head' }, [
				E('div', {}, [
					E('div', { 'class': 'rd-title' }, [ 'Панель OpenWrt' ]),
					E('div', { 'class': 'rd-sub' }, [
						(board.model || _('Роутер')) + ' · ' + (board.release?.description || board.kernel || '')
					])
				]),
				E('div', { 'class': 'rd-sub' }, [ _('Время работы') + ': ' + uptime ])
			]),
			E('main', { 'class': 'rd-grid' }, [
				this.card(
					_('Интернет'),
					online ? _('В сети') : _('Нет соединения'),
					online ? (wanProto + ' · ' + maskIp(wanIp)) : _('WAN не подключён')
				),
				this.progressCard(
					_('Нагрузка CPU'),
					pct(cpuLoad) + '%',
					cpuLoad,
					'Ядер: ' + cores + ' · нагрузка: ' + load1.toFixed(2)
				),
				this.progressCard(
					_('Оперативная память'),
					pct(memPct) + '%',
					memPct,
					bytes(used) + ' / ' + bytes(memory.total || 0)
				),
				this.card(
					_('Температура'),
					temperature != null ? temperature + ' °C' : '-',
					temperature != null ? _('Датчик температуры SoC') : _('Датчик недоступен')
				),
				E('section', { 'class': 'rd-card wide' }, [
					E('div', { 'class': 'rd-kicker' }, [ _('Устройства сети') ]),
					E('div', { 'class': 'rd-value' }, [ devices.length + ' ' + _('устройств') ]),
					E('div', { 'class': 'rd-meta' }, [ _('Активные DHCP-аренды на основном роутере') ]),
					E('div', { 'class': 'rd-wifi' }, deviceNodes.length ? deviceNodes : [
						E('div', { 'class': 'rd-meta' }, [ _('Активные DHCP-аренды не найдены.') ])
					])
				]),
				E('section', { 'class': 'rd-card wide' }, [
					E('div', { 'class': 'rd-kicker' }, [ _('Wi-Fi этого роутера') ]),
					E('div', { 'class': 'rd-value' }, [ localWifiClients + ' ' + _('локальных клиентов') ]),
					E('div', { 'class': 'rd-meta' }, [ _('Устройства через другую точку доступа учитываются в блоке «Устройства сети».') ]),
					E('div', { 'class': 'rd-wifi' }, wifiNodes.length ? wifiNodes : [
						E('div', { 'class': 'rd-meta' }, [ _('Wi-Fi-интерфейсы не обнаружены.') ])
					])
				]),
				E('section', { 'class': 'rd-card full' }, [
					E('div', { 'class': 'rd-kicker' }, [ _('Сервисы') ]),
					E('div', { 'style': 'margin-top:6px' }, serviceRows)
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
