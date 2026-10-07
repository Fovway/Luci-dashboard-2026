#!/bin/sh
set -eu

BASE="https://raw.githubusercontent.com/Fovway/Luci-dashboard-2026/main/luci-app-router-dashboard"
TMP="/tmp/luci-dashboard-2026.$$"

cleanup() {
	rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

echo "Installing LuCI Dashboard 2026 safely..."

mkdir -p "$TMP/router-dashboard"
mkdir -p "$TMP/view/router-dashboard"
mkdir -p "$TMP/menu.d"
mkdir -p "$TMP/acl.d"

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

	[ -s "$dst" ] || {
		echo "Downloaded file is empty: $url"
		exit 1
	}
}

fetch "$BASE/htdocs/luci-static/resources/router-dashboard/dashboard.css" 	"$TMP/router-dashboard/dashboard.css"

fetch "$BASE/htdocs/luci-static/resources/view/router-dashboard/dashboard.js" 	"$TMP/view/router-dashboard/dashboard.js"

fetch "$BASE/root/usr/share/luci/menu.d/luci-app-router-dashboard.json" 	"$TMP/menu.d/luci-app-router-dashboard.json"

fetch "$BASE/root/usr/share/rpcd/acl.d/luci-app-router-dashboard.json" 	"$TMP/acl.d/luci-app-router-dashboard.json"

grep -q "view.extend" "$TMP/view/router-dashboard/dashboard.js"
grep -q "admin/status/router-dashboard" "$TMP/menu.d/luci-app-router-dashboard.json"
grep -q "luci-app-router-dashboard" "$TMP/acl.d/luci-app-router-dashboard.json"

mkdir -p /www/luci-static/resources/router-dashboard
mkdir -p /www/luci-static/resources/view/router-dashboard
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d

cp "$TMP/router-dashboard/dashboard.css" 	/www/luci-static/resources/router-dashboard/dashboard.css.new
cp "$TMP/view/router-dashboard/dashboard.js" 	/www/luci-static/resources/view/router-dashboard/dashboard.js.new
cp "$TMP/menu.d/luci-app-router-dashboard.json" 	/usr/share/luci/menu.d/luci-app-router-dashboard.json.new
cp "$TMP/acl.d/luci-app-router-dashboard.json" 	/usr/share/rpcd/acl.d/luci-app-router-dashboard.json.new

mv /www/luci-static/resources/router-dashboard/dashboard.css.new 	/www/luci-static/resources/router-dashboard/dashboard.css
mv /www/luci-static/resources/view/router-dashboard/dashboard.js.new 	/www/luci-static/resources/view/router-dashboard/dashboard.js
mv /usr/share/luci/menu.d/luci-app-router-dashboard.json.new 	/usr/share/luci/menu.d/luci-app-router-dashboard.json
mv /usr/share/rpcd/acl.d/luci-app-router-dashboard.json.new 	/usr/share/rpcd/acl.d/luci-app-router-dashboard.json

rm -f /tmp/luci-indexcache
rm -rf /tmp/luci-modulecache/* 2>/dev/null || true

/etc/init.d/rpcd restart
/etc/init.d/uhttpd reload 2>/dev/null || true

echo
echo "Installed."
echo "Open LuCI -> Status -> Router Dashboard"
