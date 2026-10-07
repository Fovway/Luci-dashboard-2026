#!/bin/sh
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/luci-app-router-dashboard"

if [ ! -d "$APP_DIR" ]; then
	echo "luci-app-router-dashboard directory not found"
	exit 1
fi

echo "Installing LuCI Router Dashboard..."

mkdir -p /www/luci-static/resources/router-dashboard
mkdir -p /www/luci-static/resources/view/router-dashboard
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d

cp "$APP_DIR/htdocs/luci-static/resources/router-dashboard/dashboard.css" 	/www/luci-static/resources/router-dashboard/dashboard.css

cp "$APP_DIR/htdocs/luci-static/resources/view/router-dashboard/dashboard.js" 	/www/luci-static/resources/view/router-dashboard/dashboard.js

cp "$APP_DIR/root/usr/share/luci/menu.d/luci-app-router-dashboard.json" 	/usr/share/luci/menu.d/luci-app-router-dashboard.json

cp "$APP_DIR/root/usr/share/rpcd/acl.d/luci-app-router-dashboard.json" 	/usr/share/rpcd/acl.d/luci-app-router-dashboard.json

rm -f /tmp/luci-indexcache
rm -rf /tmp/luci-modulecache/* 2>/dev/null || true

/etc/init.d/rpcd restart
/etc/init.d/uhttpd reload 2>/dev/null || true

echo
echo "Done."
echo "Open LuCI -> Status -> Router Dashboard"
