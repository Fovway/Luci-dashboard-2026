#!/bin/sh
set -eu

BASE="https://raw.githubusercontent.com/Fovway/Luci-dashboard-2026/main/luci-app-router-dashboard"

echo "Installing LuCI Dashboard 2026..."

mkdir -p /www/luci-static/resources/router-dashboard
mkdir -p /www/luci-static/resources/view/router-dashboard
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d

fetch() {
	url="$1"
	dst="$2"

	if command -v uclient-fetch >/dev/null 2>&1; then
		uclient-fetch -qO "$dst" "$url"
	elif command -v wget >/dev/null 2>&1; then
		wget -qO "$dst" "$url"
	else
		echo "Neither uclient-fetch nor wget is available"
		exit 1
	fi
}

fetch "$BASE/htdocs/luci-static/resources/router-dashboard/dashboard.css" 	/www/luci-static/resources/router-dashboard/dashboard.css

fetch "$BASE/htdocs/luci-static/resources/view/router-dashboard/dashboard.js" 	/www/luci-static/resources/view/router-dashboard/dashboard.js

fetch "$BASE/root/usr/share/luci/menu.d/luci-app-router-dashboard.json" 	/usr/share/luci/menu.d/luci-app-router-dashboard.json

fetch "$BASE/root/usr/share/rpcd/acl.d/luci-app-router-dashboard.json" 	/usr/share/rpcd/acl.d/luci-app-router-dashboard.json

rm -f /tmp/luci-indexcache
rm -rf /tmp/luci-modulecache/* 2>/dev/null || true

/etc/init.d/rpcd restart
/etc/init.d/uhttpd reload 2>/dev/null || true

echo
echo "Installed."
echo "Open LuCI -> Status -> Router Dashboard"
